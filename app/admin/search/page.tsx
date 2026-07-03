'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { parseArray } from '../helpers'

type LeadRow = {
  id: string
  full_name: string | null
  phone: string | null
  city: string | null
  service_type?: string | null
  services?: string[] | string | null
  status: string | null
  created_at: string | null
}

type CompanyRow = {
  id: number | string
  company_name: string | null
  phone: string | null
  city: string | null
  services?: string[] | string | null
  active?: boolean | null
}

type QuoteRow = {
  id: string
  lead_id: string | null
  company_id: number | string | null
  status: string | null
  price?: number | null
  proposed_price?: number | null
  created_at: string | null
}

export default function AdminGlobalSearchPage(): JSX.Element | null {
  const router = useRouter()

  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [leads, setLeads] = useState<LeadRow[]>([])
  const [companies, setCompanies] = useState<CompanyRow[]>([])
  const [quotes, setQuotes] = useState<QuoteRow[]>([])

  useEffect(() => {
    const checkAuth = async (): Promise<void> => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/login')
        return
      }

      setIsAuthenticated(true)
    }

    checkAuth()
  }, [router])

  const runSearch = useCallback(async (): Promise<void> => {
    const q = query.trim()

    if (!q) {
      setLeads([])
      setCompanies([])
      setQuotes([])
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const leadsRes = await supabase
        .from('leads')
        .select('id, full_name, phone, city, service_type, services, status, created_at')
        .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,city.ilike.%${q}%,id.ilike.%${q}%,service_type.ilike.%${q}%,status.ilike.%${q}%`)
        .order('created_at', { ascending: false })
        .limit(50)

      if (leadsRes.error) throw leadsRes.error

      const companiesRes = await supabase
        .from('cleaning_companies')
        .select('id, company_name, phone, city, services, active')
        .or(`company_name.ilike.%${q}%,phone.ilike.%${q}%,city.ilike.%${q}%`)
        .order('company_name', { ascending: true })
        .limit(50)

      if (companiesRes.error) throw companiesRes.error

      const quotesPrimary = await supabase
        .from('quotes')
        .select('id, lead_id, company_id, status, price, proposed_price, created_at')
        .or(`status.ilike.%${q}%,id.ilike.%${q}%,lead_id.ilike.%${q}%`)
        .order('created_at', { ascending: false })
        .limit(50)

      let quotesData: QuoteRow[] = []
      if (!quotesPrimary.error) {
        quotesData = (quotesPrimary.data || []) as QuoteRow[]
      } else {
        const quotesFallback = await supabase
          .from('quotes')
          .select('id, lead_id, company_id, status, price, created_at')
          .or(`status.ilike.%${q}%,id.ilike.%${q}%,lead_id.ilike.%${q}%`)
          .order('created_at', { ascending: false })
          .limit(50)

        if (quotesFallback.error) throw quotesFallback.error
        quotesData = (quotesFallback.data || []) as QuoteRow[]
      }

      const leadRows = (leadsRes.data || []) as LeadRow[]
      let companyRows = (companiesRes.data || []) as CompanyRow[]

      const numericCompanyId = Number(q)
      if (Number.isInteger(numericCompanyId) && numericCompanyId > 0) {
        const companyById = await supabase
          .from('cleaning_companies')
          .select('id, company_name, phone, city, services, active')
          .eq('id', numericCompanyId)
          .limit(1)

        if (!companyById.error) {
          companyRows = uniqueById([...companyRows, ...((companyById.data || []) as CompanyRow[])])
        }

        const quotesByCompanyId = await supabase
          .from('quotes')
          .select('id, lead_id, company_id, status, price, created_at')
          .eq('company_id', numericCompanyId)
          .order('created_at', { ascending: false })
          .limit(50)

        if (!quotesByCompanyId.error) {
          quotesData = uniqueById([...quotesData, ...((quotesByCompanyId.data || []) as QuoteRow[])])
        }
      }

      // Include services field matches even when backend OR filters cannot inspect arrays.
      const qLower = q.toLowerCase()
      const serviceMatchedLeads = leadRows.filter((lead) => parseArray(lead.services).join(' ').toLowerCase().includes(qLower))
      const serviceMatchedCompanies = companyRows.filter((company) => parseArray(company.services).join(' ').toLowerCase().includes(qLower))

      setLeads(uniqueById([...leadRows, ...serviceMatchedLeads]))
      setCompanies(uniqueById([...companyRows, ...serviceMatchedCompanies]))
      setQuotes(uniqueById(quotesData))
    } catch (err: any) {
      setError(err.message || 'Suche konnte nicht ausgefuehrt werden.')
      setLeads([])
      setCompanies([])
      setQuotes([])
    } finally {
      setLoading(false)
    }
  }, [query])

  const totalResults = useMemo(() => leads.length + companies.length + quotes.length, [leads, companies, quotes])

  if (isAuthenticated === null) return null

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black p-4 text-slate-100 md:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="rounded-2xl border border-slate-800/50 bg-slate-900/60 p-6 shadow-lg shadow-black/10 backdrop-blur-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="bg-gradient-to-r from-cyan-400 via-emerald-400 to-violet-500 bg-clip-text text-3xl font-black tracking-tight text-transparent md:text-4xl">
                Admin Global Search
              </h1>
              <p className="mt-2 text-slate-400">Suche ueber Kunden, Firmen und Angebote in bestehenden Daten</p>
            </div>
            <Link
              href="/admin/dashboard"
              className="inline-flex items-center rounded-full border border-slate-700 bg-slate-800/80 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-700"
            >
              Zurueck zum Dashboard
            </Link>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-800/50 bg-slate-900/60 p-5 shadow-lg shadow-black/10 backdrop-blur-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Suche nach Kunde, Firma, Telefon, Lead ID, Stadt, Service, Quote Status"
              className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={runSearch}
              disabled={loading}
              className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Suche...' : 'Suchen'}
            </button>
          </div>

          <p className="mt-3 text-sm text-slate-400">Ergebnisse: {totalResults}</p>

          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        </section>

        <div className="grid gap-6 xl:grid-cols-3">
          <section className="rounded-2xl border border-slate-800/50 bg-slate-900/60 p-5 shadow-lg shadow-black/10 backdrop-blur-sm">
            <h3 className="text-lg font-semibold text-slate-100">Leads</h3>
            <p className="mb-4 text-xs text-slate-400">Name, Telefon, Lead ID, Stadt, Service</p>

            <div className="space-y-3">
              {leads.map((lead) => (
                <div key={lead.id} className="rounded-xl border border-slate-800/60 bg-slate-950/40 px-4 py-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-slate-200">{lead.full_name || 'Unbekannter Kunde'}</p>
                    <Link
                      href={`/admin/leads`}
                      className="shrink-0 text-xs text-cyan-400 hover:text-cyan-300 transition"
                    >
                      Open Leads →
                    </Link>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {lead.phone || '-'} • {lead.city || '-'} • {lead.service_type || parseArray(lead.services).join(', ') || '-'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">ID: {lead.id}</p>
                </div>
              ))}

              {!loading && leads.length === 0 && <p className="text-sm text-slate-500">Keine Leads gefunden.</p>}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800/50 bg-slate-900/60 p-5 shadow-lg shadow-black/10 backdrop-blur-sm">
            <h3 className="text-lg font-semibold text-slate-100">Companies</h3>
            <p className="mb-4 text-xs text-slate-400">Firmenname, Telefon, Stadt, Service</p>

            <div className="space-y-3">
              {companies.map((company) => (
                <div key={String(company.id)} className="rounded-xl border border-slate-800/60 bg-slate-950/40 px-4 py-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-slate-200">{company.company_name || 'Unbekannte Firma'}</p>
                    <Link
                      href={`/admin/companies`}
                      className="shrink-0 text-xs text-violet-400 hover:text-violet-300 transition"
                    >
                      Open Companies →
                    </Link>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {company.phone || '-'} • {company.city || '-'} • {parseArray(company.services).join(', ') || '-'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">ID: {String(company.id)}</p>
                </div>
              ))}

              {!loading && companies.length === 0 && <p className="text-sm text-slate-500">Keine Firmen gefunden.</p>}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800/50 bg-slate-900/60 p-5 shadow-lg shadow-black/10 backdrop-blur-sm">
            <h3 className="text-lg font-semibold text-slate-100">Quotes</h3>
            <p className="mb-4 text-xs text-slate-400">Quote Status, Lead ID, Company ID</p>

            <div className="space-y-3">
              {quotes.map((quote) => (
                <div key={quote.id} className="rounded-xl border border-slate-800/60 bg-slate-950/40 px-4 py-3 text-sm">
                  <p className="font-medium text-slate-200">Quote ID: {quote.id}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Status: {quote.status || '-'} • Lead: {quote.lead_id || '-'} • Company: {quote.company_id != null ? String(quote.company_id) : '-'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Preis: {formatQuotePrice(quote)}</p>
                </div>
              ))}

              {!loading && quotes.length === 0 && <p className="text-sm text-slate-500">Keine Angebote gefunden.</p>}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function formatQuotePrice(quote: QuoteRow): string {
  const price = typeof quote.price === 'number' ? quote.price : typeof quote.proposed_price === 'number' ? quote.proposed_price : null
  return price == null ? '-' : `${price.toFixed(2)} EUR`
}

function uniqueById<T extends { id: string | number }>(rows: T[]): T[] {
  const map = new Map<string, T>()
  for (const row of rows) {
    map.set(String(row.id), row)
  }
  return Array.from(map.values())
}
