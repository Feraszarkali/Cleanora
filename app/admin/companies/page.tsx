'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { parseArray } from '../helpers'

interface Company {
  id: number
  company_name: string | null
  contact_person: string | null
  email: string | null
  phone: string | null
  city: string | null
  address: string | null
  services: string[] | string | null
  rating?: number | null
  active: boolean
  notes: string | null
}

interface Lead {
  id: string
  full_name: string | null
  city: string | null
  services?: string[] | string | null
  service_type?: string | null
  status: string
  company_id: number | null
  created_at: string
}

interface Quote {
  id: string
  lead_id: string
  company_id: number
  price: number | null
  status: string
  message?: string | null
  created_at: string
}

type DetailsTab = 'profile' | 'leads' | 'quotes' | 'activity'
type CompanySortField = 'company_name' | 'city' | 'active' | 'assigned_leads' | 'submitted_quotes' | 'rating'
type SortDirection = 'asc' | 'desc'

type CompanyWithStats = Company & {
  assignedLeadsCount: number | null
  submittedQuotesCount: number | null
  averageRating: number | null
}

export default function AdminCompaniesPage(): JSX.Element {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [companies, setCompanies] = useState<Company[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [cityFilter, setCityFilter] = useState('all')
  const [sortField, setSortField] = useState<CompanySortField>('company_name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)
  const [detailsTab, setDetailsTab] = useState<DetailsTab>('profile')

  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [companyForm, setCompanyForm] = useState<Partial<Company>>({})
  const [savingCompany, setSavingCompany] = useState(false)

  const fetchCompanies = useCallback(async (): Promise<Company[]> => {
    const primary = await supabase
      .from('cleaning_companies')
      .select('id, company_name, contact_person, email, phone, city, address, services, active, notes, rating')
      .order('company_name', { ascending: true })

    if (!primary.error) {
      return ((primary.data as Company[]) || []).map((c) => ({
        ...c,
        id: typeof c.id === 'string' ? parseInt(c.id, 10) : c.id,
      }))
    }

    const fallback = await supabase
      .from('cleaning_companies')
      .select('id, company_name, contact_person, email, phone, city, address, services, active, notes')
      .order('company_name', { ascending: true })

    if (fallback.error) throw fallback.error

    return ((fallback.data as Company[]) || []).map((c) => ({
      ...c,
      id: typeof c.id === 'string' ? parseInt(c.id, 10) : c.id,
      rating: null,
    }))
  }, [])

  const fetchLeads = useCallback(async (): Promise<Lead[]> => {
    const primary = await supabase
      .from('leads')
      .select('id, full_name, city, services, service_type, status, company_id, created_at')
      .order('created_at', { ascending: false })

    if (!primary.error) return (primary.data as Lead[]) || []

    const fallback = await supabase
      .from('leads')
      .select('id, full_name, city, services, status, company_id, created_at')
      .order('created_at', { ascending: false })

    if (fallback.error) throw fallback.error

    return (fallback.data as Lead[]) || []
  }, [])

  const fetchQuotes = useCallback(async (): Promise<Quote[]> => {
    const primary = await supabase
      .from('quotes')
      .select('id, lead_id, company_id, price, status, message, created_at')
      .order('created_at', { ascending: false })

    if (!primary.error) return (primary.data as Quote[]) || []

    const fallback = await supabase
      .from('quotes')
      .select('id, lead_id, company_id, price, status, created_at')
      .order('created_at', { ascending: false })

    if (fallback.error) throw fallback.error

    return ((fallback.data as Quote[]) || []).map((q) => ({ ...q, message: null }))
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [companiesData, leadsData, quotesData] = await Promise.all([
        fetchCompanies(),
        fetchLeads(),
        fetchQuotes(),
      ])

      setCompanies(companiesData)
      setLeads(leadsData)
      setQuotes(quotesData)
    } catch (err: any) {
      setError(err.message || 'Failed to load companies module')
    } finally {
      setLoading(false)
    }
  }, [fetchCompanies, fetchLeads, fetchQuotes])

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/login')
      } else {
        setIsAuthenticated(true)
        loadData()
      }
    }

    checkAuth()
  }, [router, loadData])

  useEffect(() => {
    if (!successMessage) return
    const timer = setTimeout(() => setSuccessMessage(null), 3000)
    return () => clearTimeout(timer)
  }, [successMessage])

  const companiesWithStats = useMemo<CompanyWithStats[]>(() => {
    return companies.map((company) => {
      const assignedLeadsCount = leads.filter((lead) => Number(lead.company_id) === Number(company.id)).length
      const submittedQuotesCount = quotes.filter((quote) => Number(quote.company_id) === Number(company.id)).length
      const averageRating = typeof company.rating === 'number' ? company.rating : null

      return {
        ...company,
        assignedLeadsCount,
        submittedQuotesCount,
        averageRating,
      }
    })
  }, [companies, leads, quotes])

  const cityOptions = useMemo(() => {
    const values = new Set<string>()
    companies.forEach((company) => {
      if (company.city && company.city.trim()) values.add(company.city.trim())
    })
    return ['all', ...Array.from(values).sort((a, b) => a.localeCompare(b, 'de'))]
  }, [companies])

  const filteredCompanies = useMemo(() => {
    const q = search.trim().toLowerCase()

    return companiesWithStats.filter((company) => {
      const matchesSearch =
        !q ||
        company.company_name?.toLowerCase().includes(q) ||
        company.contact_person?.toLowerCase().includes(q) ||
        company.email?.toLowerCase().includes(q) ||
        company.phone?.toLowerCase().includes(q) ||
        company.city?.toLowerCase().includes(q) ||
        parseArray(company.services).join(' ').toLowerCase().includes(q)

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && company.active) ||
        (statusFilter === 'inactive' && !company.active)

      const matchesCity = cityFilter === 'all' || (company.city || '').toLowerCase() === cityFilter.toLowerCase()

      return matchesSearch && matchesStatus && matchesCity
    })
  }, [companiesWithStats, search, statusFilter, cityFilter])

  const sortedCompanies = useMemo(() => {
    const list = [...filteredCompanies]

    list.sort((a, b) => {
      const getSortable = (company: CompanyWithStats): string | number => {
        switch (sortField) {
          case 'company_name':
            return company.company_name || ''
          case 'city':
            return company.city || ''
          case 'active':
            return company.active ? 1 : 0
          case 'assigned_leads':
            return company.assignedLeadsCount ?? -1
          case 'submitted_quotes':
            return company.submittedQuotesCount ?? -1
          case 'rating':
            return company.averageRating ?? -1
          default:
            return company.company_name || ''
        }
      }

      const left = getSortable(a)
      const right = getSortable(b)

      if (left < right) return sortDirection === 'asc' ? -1 : 1
      if (left > right) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return list
  }, [filteredCompanies, sortField, sortDirection])

  const totalPages = Math.max(1, Math.ceil(sortedCompanies.length / pageSize))
  const paginatedCompanies = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedCompanies.slice(start, start + pageSize)
  }, [sortedCompanies, currentPage, pageSize])

  useEffect(() => {
    setCurrentPage(1)
  }, [search, statusFilter, cityFilter, sortField, sortDirection, pageSize])

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  const selectedCompany = useMemo(
    () => companiesWithStats.find((company) => company.id === selectedCompanyId) || null,
    [companiesWithStats, selectedCompanyId]
  )

  const selectedCompanyLeads = useMemo(() => {
    if (!selectedCompany) return []
    return leads.filter((lead) => Number(lead.company_id) === Number(selectedCompany.id))
  }, [selectedCompany, leads])

  const selectedCompanyQuotes = useMemo(() => {
    if (!selectedCompany) return []
    return quotes.filter((quote) => Number(quote.company_id) === Number(selectedCompany.id))
  }, [selectedCompany, quotes])

  const leadMap = useMemo(() => {
    const map = new Map<string, Lead>()
    leads.forEach((lead) => map.set(lead.id, lead))
    return map
  }, [leads])

  const relatedActivity = useMemo(() => {
    if (!selectedCompany) return [] as Array<{ id: string; label: string; created_at: string }>

    const leadActivity = selectedCompanyLeads.map((lead) => ({
      id: `lead-${lead.id}`,
      label: `Lead zugewiesen: ${lead.full_name || 'Unbekannter Kunde'} (${lead.status})`,
      created_at: lead.created_at,
    }))

    const quoteActivity = selectedCompanyQuotes.map((quote) => ({
      id: `quote-${quote.id}`,
      label: `Angebot ${quote.status}: ${formatPrice(quote.price)}`,
      created_at: quote.created_at,
    }))

    return [...leadActivity, ...quoteActivity]
      .filter((item) => !!item.created_at)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 20)
  }, [selectedCompany, selectedCompanyLeads, selectedCompanyQuotes])

  const openCompanyDetails = (companyId: number, tab: DetailsTab = 'profile') => {
    setSelectedCompanyId(companyId)
    setDetailsTab(tab)
  }

  const openEditCompanyModal = (company: Company) => {
    setEditingCompany(company)
    setCompanyForm({ ...company })
  }

  const closeEditCompanyModal = () => {
    setEditingCompany(null)
    setCompanyForm({})
  }

  const handleToggleCompanyActive = useCallback(async (id: number, currentActive: boolean): Promise<void> => {
    try {
      const { error: toggleError } = await supabase
        .from('cleaning_companies')
        .update({ active: !currentActive })
        .eq('id', id)

      if (toggleError) throw toggleError

      setCompanies((prev) => prev.map((company) => (company.id === id ? { ...company, active: !currentActive } : company)))
      setSuccessMessage(`Firma ${!currentActive ? 'aktiviert' : 'deaktiviert'}`)
    } catch (err: any) {
      setError(err.message || 'Failed to update company status')
    }
  }, [])

  const handleSaveCompany = useCallback(async (): Promise<void> => {
    if (!companyForm.company_name?.trim() || !editingCompany) return

    setSavingCompany(true)
    setError(null)

    try {
      const payload = {
        company_name: companyForm.company_name,
        contact_person: companyForm.contact_person || null,
        email: companyForm.email || null,
        phone: companyForm.phone || null,
        city: companyForm.city || null,
        address: companyForm.address || null,
        services: Array.isArray(companyForm.services)
          ? companyForm.services
          : parseArray(companyForm.services || ''),
        rating: companyForm.rating === undefined || companyForm.rating === null ? null : Number(companyForm.rating),
        active: companyForm.active ?? true,
        notes: companyForm.notes || null,
      }

      const { error: saveError } = await supabase
        .from('cleaning_companies')
        .update(payload)
        .eq('id', editingCompany.id)

      if (saveError) throw saveError

      await loadData()
      setSuccessMessage('Firma erfolgreich gespeichert')
      closeEditCompanyModal()
    } catch (err: any) {
      setError(err.message || 'Failed to save company')
    } finally {
      setSavingCompany(false)
    }
  }, [companyForm, editingCompany, loadData])

  const handleSort = (field: CompanySortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  if (isAuthenticated === null) return <></>

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="rounded-2xl border border-slate-800/50 bg-slate-900/60 p-6 shadow-lg shadow-black/10 backdrop-blur-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight bg-gradient-to-r from-cyan-400 via-emerald-400 to-violet-500 bg-clip-text text-transparent">
                Admin Companies
              </h1>
              <p className="mt-2 text-slate-400">Firmenprofile, Status und Aktivitäten verwalten</p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/admin/dashboard"
                className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-700"
              >
                Dashboard
              </Link>
              <Link
                href="/admin/leads"
                className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-700"
              >
                Leads
              </Link>
            </div>
          </div>
        </header>

        {successMessage && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{successMessage}</div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
        )}

        <section className="rounded-2xl border border-slate-800/50 bg-slate-900/60 p-4 md:p-5 shadow-lg shadow-black/10 backdrop-blur-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
            <input
              type="text"
              placeholder="Suche nach Firma, Kontakt, E-Mail, Stadt..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-800/50 bg-slate-900/70 px-4 py-3 text-sm focus:border-emerald-500/50 focus:outline-none"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              className="w-full rounded-xl border border-slate-800/50 bg-slate-900/70 px-4 py-3 text-sm focus:border-emerald-500/50 focus:outline-none"
            >
              <option value="all">Alle Status</option>
              <option value="active">Aktiv</option>
              <option value="inactive">Inaktiv</option>
            </select>

            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-800/50 bg-slate-900/70 px-4 py-3 text-sm focus:border-emerald-500/50 focus:outline-none"
            >
              {cityOptions.map((city) => (
                <option key={city} value={city}>
                  {city === 'all' ? 'Alle Städte' : city}
                </option>
              ))}
            </select>

            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as CompanySortField)}
              className="w-full rounded-xl border border-slate-800/50 bg-slate-900/70 px-4 py-3 text-sm focus:border-emerald-500/50 focus:outline-none"
            >
              <option value="company_name">Sortierung: Name</option>
              <option value="city">Sortierung: Stadt</option>
              <option value="active">Sortierung: Status</option>
              <option value="assigned_leads">Sortierung: Zugewiesene Leads</option>
              <option value="submitted_quotes">Sortierung: Angebote</option>
              <option value="rating">Sortierung: Bewertung</option>
            </select>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-sm text-slate-200 transition hover:bg-slate-700"
              >
                {sortDirection === 'asc' ? 'Aufsteigend' : 'Absteigend'}
              </button>
              <button
                type="button"
                onClick={loadData}
                className="rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-sm text-slate-200 transition hover:bg-slate-700"
              >
                Aktualisieren
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800/50 bg-slate-900/40 shadow-lg shadow-black/10 backdrop-blur-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-800/50 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-4 font-medium">
                    <button type="button" onClick={() => handleSort('company_name')} className="hover:text-slate-200">
                      Firmenname
                    </button>
                  </th>
                  <th className="px-4 py-4 font-medium hidden md:table-cell">Kontaktperson</th>
                  <th className="px-4 py-4 font-medium hidden md:table-cell">Telefon</th>
                  <th className="px-4 py-4 font-medium hidden lg:table-cell">E-Mail</th>
                  <th className="px-4 py-4 font-medium">Stadt / Service Area</th>
                  <th className="px-4 py-4 font-medium hidden lg:table-cell">Services</th>
                  <th className="px-4 py-4 font-medium">Status</th>
                  <th className="px-4 py-4 font-medium text-right">Leads</th>
                  <th className="px-4 py-4 font-medium text-right">Quotes</th>
                  <th className="px-4 py-4 font-medium text-right">Rating</th>
                  <th className="px-4 py-4 font-medium text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-slate-500">
                      Firmen werden geladen...
                    </td>
                  </tr>
                ) : paginatedCompanies.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-slate-500">
                      Keine Firmen für die aktuelle Suche oder Filter gefunden.
                    </td>
                  </tr>
                ) : (
                  paginatedCompanies.map((company) => (
                    <tr key={company.id} className="transition hover:bg-slate-800/30">
                      <td className="px-4 py-4 font-medium text-slate-200">{company.company_name || '-'}</td>
                      <td className="px-4 py-4 text-slate-300 hidden md:table-cell">{company.contact_person || '-'}</td>
                      <td className="px-4 py-4 text-slate-300 hidden md:table-cell">{company.phone || '-'}</td>
                      <td className="px-4 py-4 text-slate-300 hidden lg:table-cell">{company.email || '-'}</td>
                      <td className="px-4 py-4 text-slate-300">
                        <div className="max-w-[180px] truncate">{company.city || '-'}</div>
                      </td>
                      <td className="px-4 py-4 text-slate-400 hidden lg:table-cell">
                        <div className="max-w-[220px] truncate">{formatServices(company.services)}</div>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                            company.active
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                              : 'border-slate-600/30 bg-slate-700/40 text-slate-400'
                          }`}
                        >
                          {company.active ? 'Aktiv' : 'Inaktiv'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right text-slate-300">{displayNullableCount(company.assignedLeadsCount)}</td>
                      <td className="px-4 py-4 text-right text-slate-300">{displayNullableCount(company.submittedQuotesCount)}</td>
                      <td className="px-4 py-4 text-right text-slate-300">{displayRating(company.averageRating)}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap justify-end gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => openCompanyDetails(company.id, 'profile')}
                            className="text-cyan-400 transition hover:text-cyan-300"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditCompanyModal(company)}
                            className="text-emerald-400 transition hover:text-emerald-300"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleCompanyActive(company.id, company.active)}
                            className="text-amber-400 transition hover:text-amber-300"
                          >
                            {company.active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            onClick={() => openCompanyDetails(company.id, 'leads')}
                            className="text-blue-400 transition hover:text-blue-300"
                          >
                            Leads
                          </button>
                          <button
                            type="button"
                            onClick={() => openCompanyDetails(company.id, 'quotes')}
                            className="text-violet-400 transition hover:text-violet-300"
                          >
                            Quotes
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-800 bg-slate-900/40 px-4 py-4 md:flex-row md:items-center md:justify-between">
            <div className="text-xs text-slate-400">
              {sortedCompanies.length} Firmen gesamt • Seite {currentPage} von {totalPages}
            </div>

            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200"
              >
                {[10, 20, 50].map((size) => (
                  <option key={size} value={size}>
                    {size} / Seite
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage <= 1}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 disabled:opacity-50"
              >
                Zurueck
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage >= totalPages}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 disabled:opacity-50"
              >
                Weiter
              </button>
            </div>
          </div>
        </section>

        {selectedCompany && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedCompanyId(null)
            }}
          >
            <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 shadow-2xl">
              <div className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900/95 p-6 backdrop-blur">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white">{selectedCompany.company_name || 'Unbekannte Firma'}</h2>
                    <p className="mt-1 text-sm text-slate-400">ID: {selectedCompany.id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${
                        selectedCompany.active
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                          : 'border-slate-600/30 bg-slate-700/40 text-slate-400'
                      }`}
                    >
                      {selectedCompany.active ? 'Aktiv' : 'Inaktiv'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedCompanyId(null)}
                      className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
                    >
                      Schliessen
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {(['profile', 'leads', 'quotes', 'activity'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setDetailsTab(tab)}
                      className={`rounded-lg px-3 py-2 text-sm transition ${
                        detailsTab === tab ? 'bg-slate-800 text-emerald-300' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tab === 'profile' ? 'Profil' : tab === 'leads' ? 'Assigned Leads' : tab === 'quotes' ? 'Submitted Quotes' : 'Activity'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-6">
                {detailsTab === 'profile' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <StatCard label="Assigned Leads" value={displayNullableCount(selectedCompany.assignedLeadsCount)} />
                      <StatCard label="Submitted Quotes" value={displayNullableCount(selectedCompany.submittedQuotesCount)} />
                      <StatCard label="Average Rating" value={displayRating(selectedCompany.averageRating)} />
                    </div>

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Company Profile</h3>
                        <DetailsRow label="Company Name" value={selectedCompany.company_name || '-'} />
                        <DetailsRow label="Current Status" value={selectedCompany.active ? 'Aktiv' : 'Inaktiv'} />
                        <DetailsRow label="Address" value={selectedCompany.address || '-'} />
                        <DetailsRow label="Notes" value={selectedCompany.notes || '-'} />
                      </div>

                      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Contact Information</h3>
                        <DetailsRow label="Contact Person" value={selectedCompany.contact_person || '-'} />
                        <DetailsRow label="Phone" value={selectedCompany.phone || '-'} />
                        <DetailsRow label="Email" value={selectedCompany.email || '-'} />
                        <DetailsRow label="City" value={selectedCompany.city || '-'} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Services</h3>
                        {parseArray(selectedCompany.services).length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {parseArray(selectedCompany.services).map((service) => (
                              <span key={service} className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-300">
                                {service}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500">Keine Services vorhanden.</p>
                        )}
                      </div>

                      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Cities Served</h3>
                        {selectedCompany.city ? (
                          <div className="flex flex-wrap gap-2">
                            {selectedCompany.city
                              .split(',')
                              .map((city) => city.trim())
                              .filter(Boolean)
                              .map((city) => (
                                <span key={city} className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
                                  {city}
                                </span>
                              ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500">Keine Staedte hinterlegt.</p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Staff</h3>
                      <p className="text-sm text-slate-500">Keine Staff-Daten im aktuellen Datensatz verfuegbar.</p>
                    </div>
                  </div>
                )}

                {detailsTab === 'leads' && (
                  <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                    <h3 className="mb-4 text-lg font-semibold text-slate-100">Assigned Leads</h3>
                    {selectedCompanyLeads.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-500">
                        Keine zugewiesenen Leads vorhanden.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {selectedCompanyLeads.map((lead) => (
                          <div key={lead.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm">
                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                              <div>
                                <p className="font-medium text-slate-200">{lead.full_name || 'Unbekannter Kunde'}</p>
                                <p className="text-xs text-slate-500">
                                  {lead.city || 'Unbekannte Stadt'} • {lead.service_type || formatServices(lead.services)}
                                </p>
                              </div>
                              <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300">{lead.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {detailsTab === 'quotes' && (
                  <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                    <h3 className="mb-4 text-lg font-semibold text-slate-100">Submitted Quotes</h3>
                    {selectedCompanyQuotes.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-500">
                        Keine Angebote vorhanden.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {selectedCompanyQuotes.map((quote) => {
                          const lead = leadMap.get(quote.lead_id)
                          return (
                            <div key={quote.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm">
                              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                <div>
                                  <p className="font-medium text-slate-200">
                                    Lead: {lead?.full_name || quote.lead_id}
                                  </p>
                                  <p className="text-xs text-slate-500">{formatDate(quote.created_at)}</p>
                                  {quote.message && <p className="mt-1 text-xs italic text-slate-500">&quot;{quote.message}&quot;</p>}
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold text-emerald-400">{formatPrice(quote.price)}</p>
                                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${statusClass(quote.status)}`}>
                                    {quote.status}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {detailsTab === 'activity' && (
                  <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                    <h3 className="mb-4 text-lg font-semibold text-slate-100">Related Activity</h3>
                    {relatedActivity.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-500">
                        Keine Aktivitaet verfuegbar.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {relatedActivity.map((item) => (
                          <div key={item.id} className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm">
                            <p className="text-slate-200">{item.label}</p>
                            <p className="text-xs text-slate-500">{formatDate(item.created_at)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {editingCompany && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeEditCompanyModal()
            }}
          >
            <div className="w-full max-w-3xl rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl">
              <h2 className="mb-4 text-xl font-bold text-white">Firma bearbeiten</h2>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <input
                  placeholder="Firmenname *"
                  value={companyForm.company_name || ''}
                  onChange={(e) => setCompanyForm({ ...companyForm, company_name: e.target.value })}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
                <input
                  placeholder="Kontaktperson"
                  value={companyForm.contact_person || ''}
                  onChange={(e) => setCompanyForm({ ...companyForm, contact_person: e.target.value })}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
                <input
                  placeholder="E-Mail"
                  type="email"
                  value={companyForm.email || ''}
                  onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
                <input
                  placeholder="Telefon"
                  value={companyForm.phone || ''}
                  onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
                <input
                  placeholder="Stadt"
                  value={companyForm.city || ''}
                  onChange={(e) => setCompanyForm({ ...companyForm, city: e.target.value })}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
                <input
                  placeholder="Adresse"
                  value={companyForm.address || ''}
                  onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
                <input
                  placeholder="Bewertung"
                  type="number"
                  min="0"
                  max="5"
                  step="0.1"
                  value={companyForm.rating ?? ''}
                  onChange={(e) => setCompanyForm({ ...companyForm, rating: e.target.value ? Number(e.target.value) : null })}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
                <label className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-slate-200">
                  <input
                    type="checkbox"
                    checked={companyForm.active ?? true}
                    onChange={(e) => setCompanyForm({ ...companyForm, active: e.target.checked })}
                    className="h-4 w-4 accent-emerald-500"
                  />
                  Aktiv
                </label>
              </div>

              <textarea
                placeholder="Leistungen (Komma-getrennt)"
                value={Array.isArray(companyForm.services) ? companyForm.services.join(', ') : companyForm.services || ''}
                onChange={(e) => setCompanyForm({ ...companyForm, services: e.target.value })}
                className="mt-4 h-20 w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
              />

              <textarea
                placeholder="Interne Notizen"
                value={companyForm.notes || ''}
                onChange={(e) => setCompanyForm({ ...companyForm, notes: e.target.value })}
                className="mt-4 h-20 w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
              />

              <div className="mt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeEditCompanyModal}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={handleSaveCompany}
                  disabled={savingCompany || !companyForm.company_name}
                  className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                >
                  {savingCompany ? 'Speichere...' : 'Speichern'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function formatServices(value: string[] | string | null | undefined): string {
  const list = parseArray(value)
  return list.length > 0 ? list.join(', ') : '-'
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatPrice(price: number | null): string {
  return typeof price === 'number' ? `${price.toFixed(2)} EUR` : '-'
}

function displayNullableCount(value: number | null): string {
  return typeof value === 'number' ? String(value) : '-'
}

function displayRating(value: number | null): string {
  return typeof value === 'number' ? value.toFixed(1) : '-'
}

function statusClass(status: string): string {
  if (status === 'pending') return 'border-amber-500/30 bg-amber-500/10 text-amber-300'
  if (status === 'accepted' || status === 'selected') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
  if (status === 'rejected') return 'border-red-500/30 bg-red-500/10 text-red-300'
  return 'border-slate-600/30 bg-slate-700/40 text-slate-400'
}

function DetailsRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="mb-3">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-sm text-slate-200">{value}</p>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <p className="text-xs uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-100">{value}</p>
    </div>
  )
}
