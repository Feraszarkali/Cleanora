'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type ActivityRow = {
  id: string
  action: string | null
  type?: string | null
  title?: string | null
  message?: string | null
  description?: string | null
  created_at: string
  lead_id?: string | null
  company_id?: string | number | null
  quote_id?: string | null
  user_id?: string | null
  admin_id?: string | null
  actor_id?: string | null
  actor_name?: string | null
  entity_type?: string | null
  entity_id?: string | null
  metadata?: Record<string, unknown> | null
}

type ParsedActivity = ActivityRow & {
  eventType: string
  eventLabel: string
  content: string
  relatedLead: string | null
  relatedCompany: string | null
  relatedQuote: string | null
  actor: string | null
}

const PAGE_SIZE_OPTIONS = [10, 20, 50]

export default function AdminActivityLogPage(): JSX.Element | null {
  const router = useRouter()

  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [activities, setActivities] = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [leadFilter, setLeadFilter] = useState<string>('all')
  const [companyFilter, setCompanyFilter] = useState<string>('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const fetchActivity = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)

    try {
      const rich = await supabase
        .from('lead_activity')
        .select(
          'id, action, type, title, message, description, created_at, lead_id, company_id, quote_id, user_id, admin_id, actor_id, actor_name, entity_type, entity_id, metadata'
        )
        .order('created_at', { ascending: false })

      if (!rich.error) {
        setActivities((rich.data || []) as ActivityRow[])
        return
      }

      const base = await supabase
        .from('lead_activity')
        .select('id, action, created_at, lead_id, company_id, quote_id, user_id, admin_id, metadata')
        .order('created_at', { ascending: false })

      if (!base.error) {
        setActivities((base.data || []) as ActivityRow[])
        return
      }

      throw base.error
    } catch (err: any) {
      setError(err.message || 'Aktivitaetsprotokoll konnte nicht geladen werden.')
      setActivities([])
    } finally {
      setLoading(false)
    }
  }, [])

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
      await fetchActivity()
    }

    checkAuth()
  }, [fetchActivity, router])

  const parsedActivities = useMemo<ParsedActivity[]>(() => {
    return activities.map((activity) => {
      const metadata = isRecord(activity.metadata) ? activity.metadata : null

      const relatedLead =
        stringOrNull(activity.lead_id) ||
        stringOrNull(metadata?.lead_id) ||
        stringOrNull(metadata?.leadId) ||
        (isLeadEntity(activity.entity_type) ? stringOrNull(activity.entity_id) : null)

      const relatedCompany =
        stringOrNull(activity.company_id) ||
        stringOrNull(metadata?.company_id) ||
        stringOrNull(metadata?.companyId) ||
        (isCompanyEntity(activity.entity_type) ? stringOrNull(activity.entity_id) : null)

      const relatedQuote =
        stringOrNull(activity.quote_id) ||
        stringOrNull(metadata?.quote_id) ||
        stringOrNull(metadata?.quoteId) ||
        (isQuoteEntity(activity.entity_type) ? stringOrNull(activity.entity_id) : null)

      const actor =
        stringOrNull(activity.actor_name) ||
        stringOrNull(activity.admin_id) ||
        stringOrNull(activity.user_id) ||
        stringOrNull(activity.actor_id) ||
        stringOrNull(metadata?.admin_id) ||
        stringOrNull(metadata?.adminId) ||
        stringOrNull(metadata?.user_id) ||
        stringOrNull(metadata?.userId)

      const eventType =
        stringOrNull(activity.type) ||
        stringOrNull(activity.action) ||
        stringOrNull(activity.entity_type) ||
        stringOrNull(metadata?.type) ||
        stringOrNull(metadata?.action) ||
        'unknown'

      const eventLabel = formatEventLabel(eventType)

      const content =
        stringOrNull(activity.message) ||
        stringOrNull(activity.description) ||
        stringOrNull(activity.title) ||
        stringOrNull(activity.action) ||
        stringOrNull(metadata?.message) ||
        stringOrNull(metadata?.description) ||
        '-'

      return {
        ...activity,
        eventType,
        eventLabel,
        content,
        relatedLead,
        relatedCompany,
        relatedQuote,
        actor,
      }
    })
  }, [activities])

  const availableTypes = useMemo(() => {
    const set = new Set<string>()
    for (const item of parsedActivities) {
      if (item.eventType && item.eventType !== 'unknown') {
        set.add(item.eventType)
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [parsedActivities])

  const availableLeads = useMemo(() => {
    const set = new Set<string>()
    for (const item of parsedActivities) {
      if (item.relatedLead) set.add(item.relatedLead)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [parsedActivities])

  const availableCompanies = useMemo(() => {
    const set = new Set<string>()
    for (const item of parsedActivities) {
      if (item.relatedCompany) set.add(item.relatedCompany)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [parsedActivities])

  const filteredActivities = useMemo(() => {
    const q = search.trim().toLowerCase()
    const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null
    const to = toDate ? new Date(`${toDate}T23:59:59`) : null

    return parsedActivities.filter((item) => {
      const matchesSearch =
        !q ||
        [item.eventLabel, item.content, item.eventType, item.relatedLead || '', item.relatedCompany || '', item.relatedQuote || '', item.actor || '']
          .join(' ')
          .toLowerCase()
          .includes(q)

      const matchesType = typeFilter === 'all' || item.eventType === typeFilter
      const matchesLead = leadFilter === 'all' || item.relatedLead === leadFilter
      const matchesCompany = companyFilter === 'all' || item.relatedCompany === companyFilter

      const ts = item.created_at ? new Date(item.created_at) : null
      const hasValidDate = Boolean(ts && !Number.isNaN(ts.getTime()))
      const matchesFrom = !from || (hasValidDate && ts! >= from)
      const matchesTo = !to || (hasValidDate && ts! <= to)

      return matchesSearch && matchesType && matchesLead && matchesCompany && matchesFrom && matchesTo
    })
  }, [parsedActivities, search, typeFilter, leadFilter, companyFilter, fromDate, toDate])

  const totalPages = Math.max(1, Math.ceil(filteredActivities.length / pageSize))

  const paginatedActivities = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredActivities.slice(start, start + pageSize)
  }, [filteredActivities, currentPage, pageSize])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  if (isAuthenticated === null) return null

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black p-4 text-slate-100 md:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="rounded-2xl border border-slate-800/50 bg-slate-900/60 p-6 shadow-lg shadow-black/10 backdrop-blur-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="bg-gradient-to-r from-cyan-400 via-emerald-400 to-violet-500 bg-clip-text text-3xl font-black tracking-tight text-transparent md:text-4xl">
                Admin Activity Log
              </h1>
              <p className="mt-2 text-slate-400">Marketplace-Aktivitaetsverlauf mit Lead-, Firmen- und Angebotsbezug</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={fetchActivity}
                disabled={loading}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:opacity-60"
              >
                {loading ? 'Aktualisiere...' : 'Aktualisieren'}
              </button>
              <Link
                href="/admin/dashboard"
                className="rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-700"
              >
                Zurueck zum Dashboard
              </Link>
            </div>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-slate-800/50 bg-slate-900/60 p-5 shadow-lg shadow-black/10 backdrop-blur-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setCurrentPage(1)
              }}
              placeholder="Suche in Aktivitaeten"
              className="xl:col-span-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
            />

            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value)
                setCurrentPage(1)
              }}
              className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
            >
              <option value="all">Alle Typen</option>
              {availableTypes.map((type) => (
                <option key={type} value={type}>
                  {formatEventLabel(type)}
                </option>
              ))}
            </select>

            <select
              value={leadFilter}
              onChange={(e) => {
                setLeadFilter(e.target.value)
                setCurrentPage(1)
              }}
              className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
            >
              <option value="all">Alle Leads</option>
              {availableLeads.map((leadId) => (
                <option key={leadId} value={leadId}>
                  {leadId}
                </option>
              ))}
            </select>

            <select
              value={companyFilter}
              onChange={(e) => {
                setCompanyFilter(e.target.value)
                setCurrentPage(1)
              }}
              className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
            >
              <option value="all">Alle Firmen</option>
              {availableCompanies.map((companyId) => (
                <option key={companyId} value={companyId}>
                  {companyId}
                </option>
              ))}
            </select>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setTypeFilter('all')
                  setLeadFilter('all')
                  setCompanyFilter('all')
                  setFromDate('')
                  setToDate('')
                  setCurrentPage(1)
                }}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-300 transition hover:bg-slate-700"
              >
                Zuruecksetzen
              </button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-slate-400">
              Von Datum
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value)
                  setCurrentPage(1)
                }}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-slate-400">
              Bis Datum
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value)
                  setCurrentPage(1)
                }}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
              />
            </label>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/60 shadow-lg shadow-black/10 backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[1200px] w-full text-left text-sm">
              <thead className="bg-slate-800/50 text-xs uppercase tracking-[0.14em] text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-medium">Aktivitaet</th>
                  <th className="px-4 py-3 font-medium">Typ</th>
                  <th className="px-4 py-3 font-medium">Nachricht</th>
                  <th className="px-4 py-3 font-medium">Zeitstempel</th>
                  <th className="px-4 py-3 font-medium">User/Admin</th>
                  <th className="px-4 py-3 font-medium">Related Lead</th>
                  <th className="px-4 py-3 font-medium">Related Company</th>
                  <th className="px-4 py-3 font-medium">Related Quote</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                      Aktivitaetsdaten werden geladen...
                    </td>
                  </tr>
                )}

                {!loading && paginatedActivities.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                      Keine Aktivitaetsdaten fuer die aktuelle Suche/Filter vorhanden.
                    </td>
                  </tr>
                )}

                {!loading &&
                  paginatedActivities.map((item) => (
                    <tr key={item.id} className="transition hover:bg-slate-800/30">
                      <td className="px-4 py-3 text-slate-100">{item.eventLabel}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${eventBadge(item.eventType)}`}>
                          {formatEventType(item.eventType)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        <p className="max-w-xl truncate" title={item.content}>
                          {item.content}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{formatDate(item.created_at)}</td>
                      <td className="px-4 py-3 text-slate-300">{item.actor || '-'}</td>
                      <td className="px-4 py-3 text-slate-300">
                        {item.relatedLead ? (
                          <Link href="/admin/leads" className="text-cyan-400 hover:text-cyan-300 transition truncate block max-w-[120px]" title={item.relatedLead}>
                            {item.relatedLead.slice(0, 8)}…
                          </Link>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {item.relatedCompany ? (
                          <Link href="/admin/companies" className="text-violet-400 hover:text-violet-300 transition truncate block max-w-[120px]" title={item.relatedCompany}>
                            {item.relatedCompany}
                          </Link>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {item.relatedQuote ? (
                          <span className="truncate block max-w-[120px]" title={item.relatedQuote}>
                            {item.relatedQuote.slice(0, 8)}…
                          </span>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-800 px-4 py-3 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <div>
              Seite {currentPage} von {totalPages} • {filteredActivities.length} Eintraege
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs">Pro Seite</label>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setCurrentPage(1)
                }}
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="rounded border border-slate-700 bg-slate-800 px-3 py-1 text-xs transition hover:bg-slate-700 disabled:opacity-50"
              >
                Zurueck
              </button>

              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="rounded border border-slate-700 bg-slate-800 px-3 py-1 text-xs transition hover:bg-slate-700 disabled:opacity-50"
              >
                Weiter
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatEventType(type: string | null | undefined): string {
  const key = String(type || '').trim().toLowerCase()
  if (!key) return '-'

  return key
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatEventLabel(type: string | null | undefined): string {
  const key = String(type || '').trim().toLowerCase()

  const labels: Record<string, string> = {
    lead_created: 'Lead created',
    company_assigned: 'Company assigned',
    request_resent: 'Request resent',
    company_viewed_request: 'Company viewed request',
    quote_submitted: 'Quote submitted',
    quote_accepted: 'Quote accepted',
    quote_rejected: 'Quote rejected',
    customer_notified: 'Customer notified',
    admin_action: 'Admin action',
  }

  return labels[key] || formatEventType(key)
}

function eventBadge(type: string | null | undefined): string {
  const key = String(type || '').trim().toLowerCase()

  if (key.includes('created') || key.includes('submitted') || key.includes('resent') || key.includes('viewed')) {
    return 'border-blue-500/30 bg-blue-500/10 text-blue-300'
  }

  if (key.includes('accepted') || key.includes('assigned') || key.includes('notified')) {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
  }

  if (key.includes('rejected')) {
    return 'border-red-500/30 bg-red-500/10 text-red-300'
  }

  if (key.includes('admin')) {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-300'
  }

  return 'border-slate-700 bg-slate-800/60 text-slate-300'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function stringOrNull(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number') return String(value)
  return null
}

function isLeadEntity(entityType: string | null | undefined): boolean {
  const key = String(entityType || '').trim().toLowerCase()
  return key === 'lead' || key === 'leads'
}

function isCompanyEntity(entityType: string | null | undefined): boolean {
  const key = String(entityType || '').trim().toLowerCase()
  return key === 'company' || key === 'companies' || key === 'cleaning_company' || key === 'cleaning_companies'
}

function isQuoteEntity(entityType: string | null | undefined): boolean {
  const key = String(entityType || '').trim().toLowerCase()
  return key === 'quote' || key === 'quotes'
}