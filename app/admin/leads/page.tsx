// app/admin/leads/page.tsx
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import LeadDetailsModal from '@/components/admin/LeadDetailsModal'

interface Lead {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  city: string | null
  services: string[] | string | null
  status: string
  created_at: string
  company_id: number | null
  archived: boolean
  quotes?: Array<{
    id: string
    company_id: number
    status: string | null
  }>
}

interface Quote {
  id: string
  lead_id: string
  company_id: number
  company_name: string
  price: number | null
  status: string
  created_at: string
}

interface Company {
  id: number
  company_name: string | null
  city: string | null
  services: string[] | string | null
  active: boolean
}

type SortField = 'created_at' | 'full_name' | 'city' | 'status'
type SortDirection = 'asc' | 'desc'

const PAGE_SIZE_OPTIONS = [10, 20, 50]

function parseServices(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
  }
  return []
}

function statusBadgeClass(status: string): string {
  if (status === 'new') return 'bg-blue-500/10 text-blue-300 border-blue-500/30'
  if (status === 'collecting_quotes') return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
  if (status === 'contacted') return 'bg-purple-500/10 text-purple-300 border-purple-500/30'
  if (status === 'quote_sent') return 'bg-amber-500/10 text-amber-300 border-amber-500/30'
  if (status === 'completed') return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
  if (status === 'cancelled') return 'bg-red-500/10 text-red-300 border-red-500/30'
  return 'bg-slate-500/10 text-slate-300 border-slate-500/30'
}

function formatStatus(status: string): string {
  if (!status) return '-'
  return status
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export default function AdminLeadsPage() {
  const router = useRouter()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [cityFilter, setCityFilter] = useState<string>('all')
  const [serviceFilter, setServiceFilter] = useState<string>('all')
  const [archiveFilter, setArchiveFilter] = useState<'active' | 'archived' | 'all'>('active')
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loadingQuotes, setLoadingQuotes] = useState(false)
  const [loadingCompanies, setLoadingCompanies] = useState(false)
  const [modalTab, setModalTab] = useState<'details' | 'quotes'>('details')

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*, quotes(id, company_id, status)')
        .order('created_at', { ascending: false })
      if (error) throw error
      setLeads(data || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load leads')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchCompanies = useCallback(async () => {
    setLoadingCompanies(true)
    try {
      const { data, error } = await supabase
        .from('cleaning_companies')
        .select('id, company_name, city, services, active')
        .eq('active', true)
        .order('company_name')
      if (error) throw error
      setCompanies(data || [])
    } catch (err: any) {
      console.error('Failed to fetch companies:', err)
    } finally {
      setLoadingCompanies(false)
    }
  }, [])

  const fetchQuotes = useCallback(async (leadId: string) => {
    setLoadingQuotes(true)
    try {
      // Fetch all quotes for this lead with company names
      const { data: quotesData, error: quotesError } = await supabase
        .from('quotes')
        .select('id, lead_id, company_id, price, status, created_at')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })

      if (quotesError) throw quotesError

      // Fetch company names for each quote
      const quotesWithCompany = await Promise.all(
        (quotesData || []).map(async (q: any) => {
          const { data: company, error: companyError } = await supabase
            .from('cleaning_companies')
            .select('company_name')
            .eq('id', q.company_id)
            .single()
          
          if (companyError) {
            console.error('Failed to fetch company:', companyError)
            return { ...q, company_name: 'Unknown' }
          }
          return { ...q, company_name: company?.company_name || 'Unknown' }
        })
      )

      setQuotes(quotesWithCompany)
    } catch (err: any) {
      console.error('Failed to fetch quotes:', err)
      setError(err.message || 'Failed to load quotes')
    } finally {
      setLoadingQuotes(false)
    }
  }, [])

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
      } else {
        fetchLeads()
        fetchCompanies()
      }
    }
    checkAuth()
  }, [router, fetchLeads, fetchCompanies])

  useEffect(() => {
    if (selectedLead) {
      fetchQuotes(selectedLead.id)
    }
  }, [selectedLead, fetchQuotes])

  useEffect(() => {
    if (!successMessage) return
    const timer = setTimeout(() => setSuccessMessage(null), 3000)
    return () => clearTimeout(timer)
  }, [successMessage])

  const cityOptions = useMemo(() => {
    const cities = new Set<string>()
    for (const lead of leads) {
      if (lead.city && lead.city.trim()) cities.add(lead.city.trim())
    }
    return ['all', ...Array.from(cities).sort((a, b) => a.localeCompare(b, 'de'))]
  }, [leads])

  const serviceOptions = useMemo(() => {
    const services = new Set<string>()
    for (const lead of leads) {
      for (const service of parseServices(lead.services)) {
        services.add(service)
      }
    }
    return ['all', ...Array.from(services).sort((a, b) => a.localeCompare(b, 'de'))]
  }, [leads])

  const statusOptions = useMemo(() => {
    const statuses = new Set<string>()
    for (const lead of leads) {
      if (lead.status) statuses.add(lead.status)
    }
    return ['all', ...Array.from(statuses).sort((a, b) => a.localeCompare(b, 'de'))]
  }, [leads])

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase()

    return leads.filter((lead) => {
      const searchable = [
        lead.id,
        lead.full_name || '',
        lead.email || '',
        lead.phone || '',
        lead.city || '',
        ...parseServices(lead.services),
      ]
        .join(' ')
        .toLowerCase()

      const matchesSearch = !q || searchable.includes(q)
      const matchesStatus = statusFilter === 'all' || lead.status === statusFilter
      const matchesCity = cityFilter === 'all' || (lead.city || '').toLowerCase() === cityFilter.toLowerCase()
      const leadServices = parseServices(lead.services)
      const matchesService = serviceFilter === 'all' || leadServices.some((service) => service.toLowerCase() === serviceFilter.toLowerCase())
      const isArchived = Boolean(lead.archived)
      const matchesArchive =
        archiveFilter === 'all' ||
        (archiveFilter === 'archived' && isArchived) ||
        (archiveFilter === 'active' && !isArchived)

      return matchesSearch && matchesStatus && matchesCity && matchesService && matchesArchive
    })
  }, [leads, search, statusFilter, cityFilter, serviceFilter, archiveFilter])

  const sortedLeads = useMemo(() => {
    const list = [...filteredLeads]

    list.sort((a, b) => {
      let left: string | number = ''
      let right: string | number = ''

      if (sortField === 'created_at') {
        left = new Date(a.created_at || 0).getTime()
        right = new Date(b.created_at || 0).getTime()
      }

      if (sortField === 'full_name') {
        left = (a.full_name || '').toLowerCase()
        right = (b.full_name || '').toLowerCase()
      }

      if (sortField === 'city') {
        left = (a.city || '').toLowerCase()
        right = (b.city || '').toLowerCase()
      }

      if (sortField === 'status') {
        left = (a.status || '').toLowerCase()
        right = (b.status || '').toLowerCase()
      }

      if (left < right) return sortDirection === 'asc' ? -1 : 1
      if (left > right) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return list
  }, [filteredLeads, sortField, sortDirection])

  const totalPages = Math.max(1, Math.ceil(sortedLeads.length / pageSize))

  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedLeads.slice(start, start + pageSize)
  }, [sortedLeads, currentPage, pageSize])

  useEffect(() => {
    setCurrentPage(1)
  }, [search, statusFilter, cityFilter, serviceFilter, archiveFilter, sortField, sortDirection, pageSize])

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  // Get matching companies for a lead (by city and services)
  const getMatchingCompanies = useCallback((lead: Lead): Company[] => {
    if (!lead.city) return []
    const leadServices = Array.isArray(lead.services) ? lead.services : (lead.services ? [lead.services] : [])
    return companies.filter((c) => {
      const companyServices = Array.isArray(c.services) ? c.services : (c.services ? [c.services] : [])
      const matchesCity = c.city?.toLowerCase() === lead.city?.toLowerCase()
      const matchesService = leadServices.length === 0 || leadServices.some((s) => 
        companyServices.some((cs) => cs.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(cs.toLowerCase()))
      )
      return matchesCity && matchesService
    })
  }, [companies])

  // Check if a company already has a quote for this lead
  const hasQuoteForCompany = useCallback((companyId: number, quotes: Quote[]): boolean => {
    return quotes.some((q) => q.company_id === companyId)
  }, [])

  // Create a new quote request for a company
  const handleCreateQuote = useCallback(async (companyId: number) => {
    if (!selectedLead) return
    try {
      const { error } = await supabase
        .from('quotes')
        .insert({
          lead_id: selectedLead.id,
          company_id: companyId,
          price: null,
          status: 'pending',
        })
      if (error) throw error
      // Refresh quotes
      await fetchQuotes(selectedLead.id)
    } catch (err: any) {
      console.error('Failed to create quote:', err)
      setError(err.message || 'Failed to send request')
    }
  }, [selectedLead, fetchQuotes])

  // Update quote price/status
  const handleUpdateQuote = useCallback(async (quoteId: string, updates: { price?: number | null; status?: string }) => {
    if (!selectedLead) return
    try {
      const { error } = await supabase
        .from('quotes')
        .update(updates)
        .eq('id', quoteId)
      if (error) throw error
      // Refresh quotes
      await fetchQuotes(selectedLead.id)
    } catch (err: any) {
      console.error('Failed to update quote:', err)
      setError(err.message || 'Failed to update quote')
    }
  }, [selectedLead, fetchQuotes])

  const handleViewLead = useCallback((lead: Lead) => {
    setModalTab('quotes')
    setSelectedLead(lead)
  }, [])

  const handleAssignCompanies = useCallback((lead: Lead) => {
    setModalTab('details')
    setSelectedLead(lead)
  }, [])

  const handleResendLead = useCallback(async (lead: Lead) => {
    setActionLoadingId(`resend-${lead.id}`)
    setError(null)
    try {
      const matched = getMatchingCompanies(lead)
      const fallbackAssigned = lead.company_id != null ? companies.filter((c) => Number(c.id) === Number(lead.company_id)) : []
      const targets = matched.length > 0 ? matched : fallbackAssigned

      if (targets.length === 0) {
        setError('No matching or assigned companies available for resend.')
        return
      }

      const targetCompanyIds = targets.map((company) => Number(company.id))

      const { data: existingQuotes, error: existingError } = await supabase
        .from('quotes')
        .select('company_id')
        .eq('lead_id', lead.id)
        .in('company_id', targetCompanyIds)

      if (existingError) throw existingError

      const existing = new Set((existingQuotes || []).map((row: any) => Number(row.company_id)))

      const inserts = targetCompanyIds
        .filter((companyId) => !existing.has(companyId))
        .map((companyId) => ({
          lead_id: lead.id,
          company_id: companyId,
          price: null,
          status: 'pending',
        }))

      if (inserts.length > 0) {
        const { error: insertError } = await supabase.from('quotes').insert(inserts)
        if (insertError) throw insertError
      }

      setSuccessMessage(inserts.length > 0 ? `Resent to ${inserts.length} company(s).` : 'All matching companies already have quote requests.')
      await fetchLeads()
      if (selectedLead?.id === lead.id) {
        await fetchQuotes(lead.id)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to resend lead request')
    } finally {
      setActionLoadingId(null)
    }
  }, [companies, fetchLeads, fetchQuotes, getMatchingCompanies, selectedLead?.id])

  const handleArchiveLead = useCallback(async (lead: Lead) => {
    setActionLoadingId(`archive-${lead.id}`)
    setError(null)
    try {
      const nextArchived = !Boolean(lead.archived)
      const { error: updateError } = await supabase
        .from('leads')
        .update({ archived: nextArchived })
        .eq('id', lead.id)

      if (updateError) throw updateError

      setLeads((prev) => prev.map((item) => (item.id === lead.id ? { ...item, archived: nextArchived } : item)))
      setSuccessMessage(nextArchived ? 'Lead archived.' : 'Lead restored to active list.')
    } catch (err: any) {
      setError(err.message || 'Failed to update archive status')
    } finally {
      setActionLoadingId(null)
    }
  }, [])

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortField(field)
    setSortDirection('asc')
  }, [sortField])

  const leadStats = useMemo(() => {
    const total = leads.length
    const active = leads.filter((lead) => !lead.archived).length
    const archived = leads.filter((lead) => Boolean(lead.archived)).length
    const waitingQuotes = leads.filter((lead) => lead.status === 'collecting_quotes').length
    return { total, active, archived, waitingQuotes }
  }, [leads])

  if (loading) {
    return <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent">
            Admin Leads
          </h1>
          <div className="flex gap-2">
            <Link href="/admin" className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-medium transition">
              ← Dashboard
            </Link>
            <button 
              onClick={fetchLeads}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition"
            >
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm">
            {successMessage}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
          <StatCard label="Total Leads" value={String(leadStats.total)} />
          <StatCard label="Active" value={String(leadStats.active)} />
          <StatCard label="Archived" value={String(leadStats.archived)} />
          <StatCard label="Collecting Quotes" value={String(leadStats.waitingQuotes)} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3 mb-6">
          <input
            type="text"
            placeholder="Search by customer, lead ID, email, phone, city, service..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="xl:col-span-2 px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:outline-none transition text-sm"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:outline-none transition text-sm"
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status === 'all' ? 'All Statuses' : formatStatus(status)}
              </option>
            ))}
          </select>
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:outline-none transition text-sm"
          >
            {cityOptions.map((city) => (
              <option key={city} value={city}>
                {city === 'all' ? 'All Cities' : city}
              </option>
            ))}
          </select>
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:outline-none transition text-sm"
          >
            {serviceOptions.map((service) => (
              <option key={service} value={service}>
                {service === 'all' ? 'All Services' : service}
              </option>
            ))}
          </select>
          <select
            value={archiveFilter}
            onChange={(e) => setArchiveFilter(e.target.value as 'active' | 'archived' | 'all')}
            className="px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:outline-none transition text-sm"
          >
            <option value="active">Active Only</option>
            <option value="archived">Archived Only</option>
            <option value="all">Active + Archived</option>
          </select>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-800/50 text-slate-400 uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-6 py-4 font-medium min-w-[170px]">Lead ID</th>
                  <th className="px-6 py-4 font-medium min-w-[180px]">
                    <button type="button" onClick={() => handleSort('full_name')} className="hover:text-slate-200">
                      Customer {sortField === 'full_name' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                    </button>
                  </th>
                  <th className="px-6 py-4 font-medium">Email</th>
                  <th className="px-6 py-4 font-medium hidden md:table-cell">Phone</th>
                  <th className="px-6 py-4 font-medium hidden md:table-cell">
                    <button type="button" onClick={() => handleSort('city')} className="hover:text-slate-200">
                      City {sortField === 'city' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                    </button>
                  </th>
                  <th className="px-6 py-4 font-medium hidden xl:table-cell">Assigned</th>
                  <th className="px-6 py-4 font-medium hidden xl:table-cell">Quotes</th>
                  <th className="px-6 py-4 font-medium">
                    <button type="button" onClick={() => handleSort('status')} className="hover:text-slate-200">
                      Status {sortField === 'status' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                    </button>
                  </th>
                  <th className="px-6 py-4 font-medium hidden lg:table-cell">
                    <button type="button" onClick={() => handleSort('created_at')} className="hover:text-slate-200">
                      Created {sortField === 'created_at' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                    </button>
                  </th>
                  <th className="px-6 py-4 font-medium w-[320px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {paginatedLeads.length === 0 ? (
                  <tr><td colSpan={11} className="px-6 py-12 text-center text-slate-500">No leads found.</td></tr>
                ) : (
                  paginatedLeads.map((lead) => {
                    const quoteCount = lead.quotes?.length || 0
                    const assignedCount = lead.company_id ? 1 : 0

                    return (
                    <tr key={lead.id} className="hover:bg-slate-800/30 transition">
                      <td className="px-6 py-4 text-slate-400 font-mono text-xs">{lead.id}</td>
                      <td className="px-6 py-4 font-medium text-slate-200">{lead.full_name || '-'}</td>
                      <td className="px-6 py-4 text-slate-300">{lead.email || '-'}</td>
                      <td className="px-6 py-4 text-slate-300 hidden md:table-cell">{lead.phone || '-'}</td>
                      <td className="px-6 py-4 text-slate-300 hidden md:table-cell">{lead.city || '-'}</td>
                      <td className="px-6 py-4 text-slate-300 hidden xl:table-cell">{assignedCount}</td>
                      <td className="px-6 py-4 text-slate-300 hidden xl:table-cell">{quoteCount}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusBadgeClass(lead.status)}`}>
                          {formatStatus(lead.status)}
                        </span>
                        {lead.archived && (
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border border-slate-600 bg-slate-700/40 text-slate-300">
                            Archived
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-400 hidden lg:table-cell whitespace-nowrap">
                        {new Date(lead.created_at).toLocaleDateString('de-DE')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleViewLead(lead)}
                            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAssignCompanies(lead)}
                            disabled={loadingCompanies}
                            className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 disabled:opacity-50"
                          >
                            Assign Companies
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResendLead(lead)}
                            disabled={actionLoadingId === `resend-${lead.id}`}
                            className="text-xs font-semibold text-amber-400 hover:text-amber-300 disabled:opacity-50"
                          >
                            {actionLoadingId === `resend-${lead.id}` ? 'Resending...' : 'Resend'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleArchiveLead(lead)}
                            disabled={actionLoadingId === `archive-${lead.id}`}
                            className="text-xs font-semibold text-violet-400 hover:text-violet-300 disabled:opacity-50"
                          >
                            {actionLoadingId === `archive-${lead.id}`
                              ? 'Saving...'
                              : lead.archived
                                ? 'Restore'
                                : 'Archive'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )})
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-800 bg-slate-900/40 px-4 py-4 md:flex-row md:items-center md:justify-between">
            <div className="text-xs text-slate-400">
              {sortedLeads.length} results • Page {currentPage} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>{size} / page</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage <= 1}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage >= totalPages}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {selectedLead && (
          <LeadDetailsModal
            selectedLead={selectedLead}
            modalTab={modalTab}
            setModalTab={setModalTab}
            setSelectedLead={setSelectedLead}
            quotes={quotes}
            loadingQuotes={loadingQuotes}
            getMatchingCompanies={getMatchingCompanies}
            hasQuoteForCompany={hasQuoteForCompany}
            handleCreateQuote={handleCreateQuote}
            handleUpdateQuote={handleUpdateQuote}
          />
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <p className="text-[11px] uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-100">{value}</p>
    </div>
  )
}
