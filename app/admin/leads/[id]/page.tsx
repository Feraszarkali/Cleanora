'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { parseArray } from '@/app/admin/helpers'

type LeadRecord = {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  city: string | null
  address?: string | null
  street?: string | null
  house_number?: string | null
  zip_code?: string | null
  service_type?: string | null
  services?: string[] | string | null
  notes?: string | null
  internal_notes?: string | null
  preferred_date?: string | null
  preferred_time?: string | null
  first_date?: string | null
  time_slots?: string[] | string | null
  status: string
  created_at: string
  company_id?: number | string | null
  archived?: boolean | null
  [key: string]: unknown
}

type QuoteRecord = {
  id: string
  lead_id: string
  company_id: number | string
  company_name?: string | null
  price?: number | null
  final_price?: number | null
  proposed_price?: number | null
  message?: string | null
  notes?: string | null
  estimated_duration?: string | null
  status: string
  created_at: string
  updated_at?: string | null
  [key: string]: unknown
}

type CompanyRecord = {
  id: number | string
  company_name: string | null
  city?: string | null
  services?: string[] | string | null
  active?: boolean
  rating?: number | null
  [key: string]: unknown
}

type ActivityRecord = {
  id: string
  action?: string | null
  type?: string | null
  title?: string | null
  message?: string | null
  description?: string | null
  created_at: string
  lead_id?: string | null
  company_id?: string | number | null
  quote_id?: string | null
  metadata?: Record<string, unknown> | null
  [key: string]: unknown
}

const STATUS_OPTIONS = ['new', 'contacted', 'collecting_quotes', 'quote_sent', 'completed', 'cancelled']

function normalizeCompanyId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatStatus(status: string | null | undefined): string {
  if (!status) return '-'
  return status
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function statusBadgeClass(status: string): string {
  if (status === 'new') return 'bg-blue-500/10 text-blue-300 border-blue-500/30'
  if (status === 'collecting_quotes') return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
  if (status === 'contacted') return 'bg-purple-500/10 text-purple-300 border-purple-500/30'
  if (status === 'quote_sent') return 'bg-amber-500/10 text-amber-300 border-amber-500/30'
  if (status === 'completed') return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
  if (status === 'cancelled') return 'bg-red-500/10 text-red-300 border-red-500/30'
  if (status === 'selected' || status === 'accepted') return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
  if (status === 'rejected') return 'bg-rose-500/10 text-rose-300 border-rose-500/30'
  if (status === 'pending') return 'bg-slate-500/10 text-slate-300 border-slate-500/30'
  return 'bg-slate-500/10 text-slate-300 border-slate-500/30'
}

function safeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function quotePrice(quote: QuoteRecord): number | null {
  return safeNumber(quote.price) ?? safeNumber(quote.final_price) ?? safeNumber(quote.proposed_price)
}

function estimateDurationText(quote: QuoteRecord, serviceCount: number): string {
  if (quote.estimated_duration && String(quote.estimated_duration).trim()) {
    return String(quote.estimated_duration)
  }

  const price = quotePrice(quote)
  const baseHours = Math.max(2, serviceCount * 1.5)
  const speedFactor = price == null ? 1.15 : price < 200 ? 1.05 : 0.95
  const hours = Math.max(1.5, baseHours * speedFactor)
  return `${hours.toFixed(1)}h`
}

function durationHours(value: string): number {
  const compact = value.trim().toLowerCase()
  if (!compact) return Number.POSITIVE_INFINITY

  const hourMatch = compact.match(/([0-9]+(?:\.[0-9]+)?)\s*h/)
  if (hourMatch) return Number(hourMatch[1])

  const minuteMatch = compact.match(/([0-9]+(?:\.[0-9]+)?)\s*m/)
  if (minuteMatch) return Number(minuteMatch[1]) / 60

  const parsed = Number(compact)
  if (Number.isFinite(parsed)) return parsed
  return Number.POSITIVE_INFINITY
}

function pickStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item) => typeof item === 'string' && item.trim())
      .map((item) => item.trim())
  }
  if (typeof value === 'string' && value.trim()) {
    return parseArray(value)
  }
  return []
}

function extractFileUrls(lead: LeadRecord | null): string[] {
  if (!lead) return []

  const keys = ['photos', 'photo_urls', 'images', 'files', 'attachments', 'uploaded_files']
  const urls = new Set<string>()

  for (const key of keys) {
    const values = pickStringArray(lead[key])
    for (const value of values) {
      if (/^https?:\/\//i.test(value) || value.startsWith('/')) {
        urls.add(value)
      }
    }
  }

  return Array.from(urls)
}

function isImageFile(url: string): boolean {
  return /\.(png|jpg|jpeg|gif|webp|bmp|svg)(\?.*)?$/i.test(url)
}

export default function AdminLeadDetailsPage(): JSX.Element | null {
  const params = useParams<{ id: string | string[] }>()
  const router = useRouter()
  const leadId = useMemo(() => {
    const raw = params?.id
    if (Array.isArray(raw)) return raw[0] || ''
    return raw || ''
  }, [params])

  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [lead, setLead] = useState<LeadRecord | null>(null)
  const [quotes, setQuotes] = useState<QuoteRecord[]>([])
  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [activities, setActivities] = useState<ActivityRecord[]>([])

  const [selectedStatus, setSelectedStatus] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const [selectedCompanyToAssign, setSelectedCompanyToAssign] = useState('')
  const [busyAction, setBusyAction] = useState<string | null>(null)

  const loadLeadDetail = useCallback(async (): Promise<void> => {
    if (!leadId) return
    setError(null)

    const { data: leadData, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single()

    if (leadError) throw leadError

    let companiesData: CompanyRecord[] = []
    const companiesPrimary = await supabase
      .from('cleaning_companies')
      .select('id, company_name, city, services, active, rating')
      .eq('active', true)
      .order('company_name', { ascending: true })

    if (!companiesPrimary.error) {
      companiesData = (companiesPrimary.data || []) as CompanyRecord[]
    } else {
      const companiesFallback = await supabase
        .from('cleaning_companies')
        .select('id, company_name, city, services, active')
        .eq('active', true)
        .order('company_name', { ascending: true })

      if (!companiesFallback.error) {
        companiesData = (companiesFallback.data || []) as CompanyRecord[]
      }
    }

    const { data: quotesData, error: quotesError } = await supabase
      .from('quotes')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })

    if (quotesError) throw quotesError

    let activityRows: ActivityRecord[] = []
    const activityPrimary = await supabase
      .from('lead_activity')
      .select('id, action, type, title, message, description, created_at, lead_id, company_id, quote_id, metadata')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })

    if (!activityPrimary.error) {
      activityRows = (activityPrimary.data || []) as ActivityRecord[]
    } else {
      const activityFallback = await supabase
        .from('lead_activity')
        .select('id, action, created_at, lead_id, company_id, quote_id, metadata')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })

      if (!activityFallback.error) {
        activityRows = (activityFallback.data || []) as ActivityRecord[]
      }
    }

    const normalizedLead = leadData as LeadRecord
    setLead(normalizedLead)
    setSelectedStatus(normalizedLead.status || 'new')
    setInternalNotes((normalizedLead.internal_notes as string | null) || '')
    setCompanies(companiesData)
    setActivities(activityRows)

    const companyMap = new Map<number, CompanyRecord>()
    for (const company of companiesData) {
      const companyId = normalizeCompanyId(company.id)
      if (companyId != null) companyMap.set(companyId, company)
    }

    const normalizedQuotes = ((quotesData || []) as QuoteRecord[]).map((quote) => {
      const id = normalizeCompanyId(quote.company_id)
      const mapped = id != null ? companyMap.get(id) : undefined
      return {
        ...quote,
        company_name: quote.company_name || mapped?.company_name || 'Unknown company',
      }
    })

    setQuotes(normalizedQuotes)
  }, [leadId])

  useEffect(() => {
    if (!leadId) return

    const checkAuthAndLoad = async (): Promise<void> => {
      setLoading(true)
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.replace('/login')
          return
        }

        setIsAuthenticated(true)
        await loadLeadDetail()
      } catch (err: unknown) {
        const e = err as Error
        setError(e.message || 'Failed to load lead details')
      } finally {
        setLoading(false)
      }
    }

    checkAuthAndLoad()
  }, [leadId, loadLeadDetail, router])

  useEffect(() => {
    if (!successMessage) return
    const timer = setTimeout(() => setSuccessMessage(null), 3000)
    return () => clearTimeout(timer)
  }, [successMessage])

  const refreshAll = useCallback(async () => {
    setRefreshing(true)
    try {
      await loadLeadDetail()
    } catch (err: unknown) {
      const e = err as Error
      setError(e.message || 'Refresh failed')
    } finally {
      setRefreshing(false)
    }
  }, [loadLeadDetail])

  const companyById = useMemo(() => {
    const map = new Map<number, CompanyRecord>()
    for (const company of companies) {
      const id = normalizeCompanyId(company.id)
      if (id != null) map.set(id, company)
    }
    return map
  }, [companies])

  const serviceList = useMemo(() => {
    if (!lead) return []
    const services = pickStringArray(lead.services)
    if (services.length > 0) return services
    if (lead.service_type && String(lead.service_type).trim()) return [String(lead.service_type)]
    return []
  }, [lead])

  const filesAndPhotos = useMemo(() => extractFileUrls(lead), [lead])

  const preferredDates = useMemo(() => {
    if (!lead) return []
    const values = new Set<string>()
    const dateCandidates = [lead.preferred_date, lead.first_date]
    for (const candidate of dateCandidates) {
      if (candidate && String(candidate).trim()) values.add(String(candidate))
    }
    return Array.from(values)
  }, [lead])

  const preferredTimeSlots = useMemo(() => {
    if (!lead) return []
    const slots = new Set<string>()
    for (const slot of pickStringArray(lead.time_slots)) slots.add(slot)
    if (lead.preferred_time && String(lead.preferred_time).trim()) slots.add(String(lead.preferred_time))
    return Array.from(slots)
  }, [lead])

  const matchingCompanies = useMemo(() => {
    if (!lead || !lead.city) return [] as CompanyRecord[]

    return companies.filter((company) => {
      const cityMatches = (company.city || '').toLowerCase() === (lead.city || '').toLowerCase()
      const companyServices = parseArray(company.services)

      const serviceMatches =
        serviceList.length === 0 ||
        serviceList.some((leadService) =>
          companyServices.some((companyService) => {
            const left = companyService.toLowerCase()
            const right = leadService.toLowerCase()
            return left.includes(right) || right.includes(left)
          })
        )

      return cityMatches && serviceMatches
    })
  }, [companies, lead, serviceList])

  const assignedCompanyIds = useMemo(() => {
    const ids = new Set<number>()
    for (const quote of quotes) {
      const companyId = normalizeCompanyId(quote.company_id)
      if (companyId != null) ids.add(companyId)
    }
    return ids
  }, [quotes])

  const assignableCompanies = useMemo(() => {
    return matchingCompanies.filter((company) => {
      const id = normalizeCompanyId(company.id)
      return id != null && !assignedCompanyIds.has(id)
    })
  }, [assignedCompanyIds, matchingCompanies])

  const sortedQuotes = useMemo(() => {
    return [...quotes].sort((left, right) => {
      const leftWinner = left.status === 'selected' || left.status === 'accepted' ? 1 : 0
      const rightWinner = right.status === 'selected' || right.status === 'accepted' ? 1 : 0
      if (leftWinner !== rightWinner) return rightWinner - leftWinner
      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    })
  }, [quotes])

  const durationByQuoteId = useMemo(() => {
    const map = new Map<string, string>()
    for (const quote of sortedQuotes) {
      map.set(quote.id, estimateDurationText(quote, Math.max(1, serviceList.length)))
    }
    return map
  }, [serviceList.length, sortedQuotes])

  const lowestPriceQuoteId = useMemo(() => {
    let lowest: { id: string; value: number } | null = null
    for (const quote of sortedQuotes) {
      const price = quotePrice(quote)
      if (price == null) continue
      if (!lowest || price < lowest.value) lowest = { id: quote.id, value: price }
    }
    return lowest?.id || null
  }, [sortedQuotes])

  const fastestQuoteId = useMemo(() => {
    let fastest: { id: string; value: number } | null = null
    for (const quote of sortedQuotes) {
      const duration = durationHours(durationByQuoteId.get(quote.id) || '')
      if (!Number.isFinite(duration)) continue
      if (!fastest || duration < fastest.value) fastest = { id: quote.id, value: duration }
    }
    return fastest?.id || null
  }, [durationByQuoteId, sortedQuotes])

  const highestRatedQuoteId = useMemo(() => {
    let best: { id: string; rating: number } | null = null
    for (const quote of sortedQuotes) {
      const companyId = normalizeCompanyId(quote.company_id)
      const rating = companyId != null ? safeNumber(companyById.get(companyId)?.rating) : null
      const resolvedRating = rating ?? 0
      if (!best || resolvedRating > best.rating) best = { id: quote.id, rating: resolvedRating }
    }
    return best?.id || null
  }, [companyById, sortedQuotes])

  const bestValueQuoteId = useMemo(() => {
    let best: { id: string; score: number } | null = null
    for (const quote of sortedQuotes) {
      const companyId = normalizeCompanyId(quote.company_id)
      const rating = companyId != null ? safeNumber(companyById.get(companyId)?.rating) ?? 0 : 0
      const price = quotePrice(quote)
      if (price == null || price <= 0) continue
      const score = (rating + 1) / price
      if (!best || score > best.score) best = { id: quote.id, score }
    }
    return best?.id || null
  }, [companyById, sortedQuotes])

  const statusHistory = useMemo(() => {
    const events = activities.filter((item) => {
      const key = `${item.action || ''} ${item.type || ''} ${item.title || ''} ${item.message || ''}`.toLowerCase()
      return key.includes('status') || key.includes('quote_sent') || key.includes('selected')
    })

    if (events.length > 0) {
      return events.map((item) => ({
        id: item.id,
        label: item.title || item.action || item.type || 'Status changed',
        at: item.created_at,
      }))
    }

    if (!lead) return []
    return [
      { id: `created-${lead.id}`, label: 'Lead created', at: lead.created_at },
      { id: `current-${lead.id}`, label: `Current status: ${formatStatus(lead.status)}`, at: lead.created_at },
    ]
  }, [activities, lead])

  const handleLeadStatusSave = useCallback(async () => {
    if (!lead || !selectedStatus || selectedStatus === lead.status) return
    setBusyAction('lead-status')
    setError(null)
    try {
      const { error: updateError } = await supabase
        .from('leads')
        .update({ status: selectedStatus })
        .eq('id', lead.id)

      if (updateError) throw updateError

      setLead((prev) => (prev ? { ...prev, status: selectedStatus } : prev))
      setSuccessMessage('Lead status updated.')
      await refreshAll()
    } catch (err: unknown) {
      const e = err as Error
      setError(e.message || 'Failed to update lead status')
    } finally {
      setBusyAction(null)
    }
  }, [lead, refreshAll, selectedStatus])

  const handleSaveInternalNotes = useCallback(async () => {
    if (!lead) return
    setBusyAction('internal-notes')
    setError(null)
    try {
      const { error: updateError } = await supabase
        .from('leads')
        .update({ internal_notes: internalNotes || null })
        .eq('id', lead.id)

      if (updateError) throw updateError

      setLead((prev) => (prev ? { ...prev, internal_notes: internalNotes || null } : prev))
      setSuccessMessage('Internal notes saved.')
      await refreshAll()
    } catch (err: unknown) {
      const e = err as Error
      setError(e.message || 'Failed to save internal notes')
    } finally {
      setBusyAction(null)
    }
  }, [internalNotes, lead, refreshAll])

  const handleAssignCompany = useCallback(async () => {
    if (!lead || !selectedCompanyToAssign) return
    const companyId = Number(selectedCompanyToAssign)
    if (!Number.isFinite(companyId)) return

    setBusyAction('assign-company')
    setError(null)
    try {
      const alreadyAssigned = quotes.some((quote) => normalizeCompanyId(quote.company_id) === companyId)
      if (alreadyAssigned) {
        setSuccessMessage('Company is already assigned to this lead.')
        return
      }

      const { error: insertError } = await supabase
        .from('quotes')
        .insert({
          lead_id: lead.id,
          company_id: companyId,
          status: 'pending',
          price: null,
          message: null,
        })

      if (insertError) throw insertError

      setSelectedCompanyToAssign('')
      setSuccessMessage('Company assigned successfully.')
      await refreshAll()
    } catch (err: unknown) {
      const e = err as Error
      setError(e.message || 'Failed to assign company')
    } finally {
      setBusyAction(null)
    }
  }, [lead, quotes, refreshAll, selectedCompanyToAssign])

  const handleResendToCompany = useCallback(async (quote: QuoteRecord) => {
    setBusyAction(`resend-${quote.id}`)
    setError(null)
    try {
      const { error: updateError } = await supabase
        .from('quotes')
        .update({ status: 'pending', updated_at: new Date().toISOString() })
        .eq('id', quote.id)

      if (updateError) throw updateError

      setSuccessMessage('Lead resent to company.')
      await refreshAll()
    } catch (err: unknown) {
      const e = err as Error
      setError(e.message || 'Failed to resend lead')
    } finally {
      setBusyAction(null)
    }
  }, [refreshAll])

  const handleRemoveAssignedCompany = useCallback(async (quote: QuoteRecord) => {
    setBusyAction(`remove-${quote.id}`)
    setError(null)
    try {
      const { error: deleteError } = await supabase
        .from('quotes')
        .delete()
        .eq('id', quote.id)

      if (deleteError) throw deleteError

      setSuccessMessage('Assigned company removed.')
      await refreshAll()
    } catch (err: unknown) {
      const e = err as Error
      setError(e.message || 'Failed to remove assigned company')
    } finally {
      setBusyAction(null)
    }
  }, [refreshAll])

  const handleRejectQuote = useCallback(async (quote: QuoteRecord) => {
    setBusyAction(`reject-${quote.id}`)
    setError(null)
    try {
      const { error: updateError } = await supabase
        .from('quotes')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', quote.id)

      if (updateError) throw updateError

      setSuccessMessage('Quote rejected.')
      await refreshAll()
    } catch (err: unknown) {
      const e = err as Error
      setError(e.message || 'Failed to reject quote')
    } finally {
      setBusyAction(null)
    }
  }, [refreshAll])

  const handleSelectWinner = useCallback(async (quote: QuoteRecord) => {
    setBusyAction(`winner-${quote.id}`)
    setError(null)
    try {
      const response = await fetch('/api/quotes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quote_id: quote.id, status: 'selected' }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result?.error || 'Failed to select winner')
      }

      setSuccessMessage('Winner selected. Remaining quotes were rejected automatically.')
      await refreshAll()
    } catch (err: unknown) {
      const e = err as Error
      setError(e.message || 'Failed to select winner')
    } finally {
      setBusyAction(null)
    }
  }, [refreshAll])

  const handleArchiveLead = useCallback(async () => {
    if (!lead || lead.archived) return

    setBusyAction('archive-lead')
    setError(null)
    try {
      const { error: updateError } = await supabase
        .from('leads')
        .update({ archived: true })
        .eq('id', lead.id)

      if (updateError) throw updateError

      setLead((prev) => (prev ? { ...prev, archived: true } : prev))
      setSuccessMessage('Lead archived.')
      await refreshAll()
    } catch (err: unknown) {
      const e = err as Error
      setError(e.message || 'Failed to archive lead')
    } finally {
      setBusyAction(null)
    }
  }, [lead, refreshAll])

  if (isAuthenticated === null) return null

  if (loading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
          <p className="text-sm text-slate-400">Lead Control Center is loading...</p>
        </div>
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-100 p-4 md:p-8">
        <div className="mx-auto max-w-4xl rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
          <p className="text-red-300">Lead not found.</p>
          <Link href="/admin/leads" className="mt-4 inline-flex rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700">
            Back to Leads
          </Link>
        </div>
      </div>
    )
  }

  const assignedQuotes = sortedQuotes
  const leadAddress = [lead.street, lead.house_number].filter(Boolean).join(' ')
  const fullAddress = [leadAddress || lead.address, lead.zip_code, lead.city].filter(Boolean).join(', ')

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black p-4 text-slate-100 md:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="rounded-2xl border border-slate-800/50 bg-slate-900/60 p-6 shadow-lg shadow-black/10 backdrop-blur-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Marketplace Control Center</p>
              <h1 className="mt-1 bg-gradient-to-r from-cyan-400 via-emerald-400 to-violet-500 bg-clip-text text-3xl font-black tracking-tight text-transparent md:text-4xl">
                {lead.full_name || 'Unnamed Lead'}
              </h1>
              <p className="mt-2 text-slate-400">Lead ID: {lead.id}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${statusBadgeClass(lead.status)}`}>
                {formatStatus(lead.status)}
              </span>
              {lead.archived && (
                <span className="inline-flex rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300">
                  Archived
                </span>
              )}
              <button
                type="button"
                onClick={handleArchiveLead}
                disabled={busyAction === 'archive-lead' || Boolean(lead.archived)}
                className="rounded-lg border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-300 transition hover:bg-violet-500/20 disabled:opacity-60"
              >
                {busyAction === 'archive-lead' ? 'Archiving...' : lead.archived ? 'Archived' : 'Archive Lead'}
              </button>
              <button
                type="button"
                onClick={refreshAll}
                disabled={refreshing}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:opacity-60"
              >
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </button>
              <Link
                href="/admin/leads"
                className="rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-700"
              >
                Back to Leads
              </Link>
            </div>
          </div>
        </header>

        {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
        {successMessage && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{successMessage}</div>}

        <section className="grid gap-6 lg:grid-cols-3">
          <article className="rounded-2xl border border-slate-800/50 bg-slate-900/60 p-5 shadow-lg shadow-black/10 backdrop-blur-sm lg:col-span-2">
            <h2 className="text-lg font-semibold text-slate-100">Customer Information</h2>
            <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
              <DataRow label="Name" value={lead.full_name || '-'} />
              <DataRow label="Phone" value={lead.phone || '-'} />
              <DataRow label="Email" value={lead.email || '-'} />
              <DataRow label="Address" value={fullAddress || '-'} />
              <DataRow label="City" value={lead.city || '-'} />
              <DataRow label="Service" value={serviceList.join(', ') || '-'} />
              <DataRow label="Preferred dates" value={preferredDates.map((d) => formatDateTime(d)).join(', ') || '-'} />
              <DataRow label="Preferred time slots" value={preferredTimeSlots.join(', ') || '-'} />
              <DataRow label="Lead created" value={formatDateTime(lead.created_at)} />
              <DataRow label="Customer notes" value={(lead.notes as string | null) || '-'} full />
            </div>
          </article>

          <article className="rounded-2xl border border-slate-800/50 bg-slate-900/60 p-5 shadow-lg shadow-black/10 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-slate-100">Lead Status</h2>
            <div className="mt-4 space-y-3">
              <select
                value={selectedStatus}
                onChange={(event) => setSelectedStatus(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-slate-200"
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {formatStatus(status)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleLeadStatusSave}
                disabled={busyAction === 'lead-status' || selectedStatus === lead.status}
                className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-60"
              >
                {busyAction === 'lead-status' ? 'Saving...' : 'Save Status'}
              </button>
            </div>

            <h3 className="mt-6 text-sm font-semibold uppercase tracking-[0.12em] text-slate-400">Status History</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {activities.length === 0 ? (
                <li className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-4 text-sm text-slate-500">
                  No activity history available for this lead.
                </li>
              ) : (
                activities.map((activity) => (
                  <li key={activity.id} className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
                    <p className="text-slate-200">{activity.title || activity.message || activity.description || activity.action || activity.type || 'Activity event'}</p>
                    <p className="text-xs text-slate-500">{formatDateTime(activity.created_at)}</p>
                  </li>
                ))
              )}
            </ul>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-800/50 bg-slate-900/60 p-5 shadow-lg shadow-black/10 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-slate-100">Assigned Companies</h2>

            <div className="mt-4 space-y-3">
              {assignedQuotes.length === 0 ? (
                <p className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-4 text-sm text-slate-400">No assigned companies yet.</p>
              ) : (
                assignedQuotes.map((quote) => {
                  const companyId = normalizeCompanyId(quote.company_id)
                  const company = companyId != null ? companyById.get(companyId) : null

                  return (
                    <div key={`assigned-${quote.id}`} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-100">{quote.company_name || company?.company_name || 'Unknown company'}</p>
                          <p className="text-xs text-slate-500">Assigned via quote request • {formatDateTime(quote.created_at)}</p>
                        </div>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadgeClass(quote.status)}`}>
                          {formatStatus(quote.status)}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleResendToCompany(quote)}
                          disabled={busyAction === `resend-${quote.id}`}
                          className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-300 disabled:opacity-60"
                        >
                          {busyAction === `resend-${quote.id}` ? 'Resending...' : 'Resend'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveAssignedCompany(quote)}
                          disabled={busyAction === `remove-${quote.id}`}
                          className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-xs text-rose-300 disabled:opacity-60"
                        >
                          {busyAction === `remove-${quote.id}` ? 'Removing...' : 'Remove'}
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="mt-5 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Assign New Company</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <select
                  value={selectedCompanyToAssign}
                  onChange={(event) => setSelectedCompanyToAssign(event.target.value)}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-slate-200"
                >
                  <option value="">Select company</option>
                  {assignableCompanies.map((company) => (
                    <option key={String(company.id)} value={String(company.id)}>
                      {company.company_name || 'Unnamed company'}{company.city ? ` (${company.city})` : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAssignCompany}
                  disabled={!selectedCompanyToAssign || busyAction === 'assign-company'}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-60"
                >
                  {busyAction === 'assign-company' ? 'Assigning...' : 'Assign'}
                </button>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-800/50 bg-slate-900/60 p-5 shadow-lg shadow-black/10 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-slate-100">Internal Admin Notes</h2>
            <textarea
              value={internalNotes}
              onChange={(event) => setInternalNotes(event.target.value)}
              rows={8}
              placeholder="Internal notes for admins..."
              className="mt-4 w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSaveInternalNotes}
              disabled={busyAction === 'internal-notes'}
              className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-60"
            >
              {busyAction === 'internal-notes' ? 'Saving...' : 'Save Internal Notes'}
            </button>
          </article>
        </section>

        <section className="rounded-2xl border border-slate-800/50 bg-slate-900/60 p-5 shadow-lg shadow-black/10 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">Quotes</h2>
            <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-300">{sortedQuotes.length} total</span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-[960px] w-full text-left text-sm">
              <thead className="bg-slate-800/50 text-xs uppercase tracking-[0.12em] text-slate-300">
                <tr>
                  <th className="px-3 py-3 font-medium">Company</th>
                  <th className="px-3 py-3 font-medium">Price</th>
                  <th className="px-3 py-3 font-medium">Message</th>
                  <th className="px-3 py-3 font-medium">Estimated Duration</th>
                  <th className="px-3 py-3 font-medium">Created</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {sortedQuotes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                      No quotes available yet.
                    </td>
                  </tr>
                ) : (
                  sortedQuotes.map((quote) => {
                    const price = quotePrice(quote)
                    const durationText = durationByQuoteId.get(quote.id) || '-'

                    return (
                      <tr key={quote.id} className="hover:bg-slate-800/30 transition">
                        <td className="px-3 py-3 text-slate-100">
                          <div>
                            <p className="font-medium">{quote.company_name || 'Unknown company'}</p>
                            <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                              {lowestPriceQuoteId === quote.id && <Tag text="Lowest price" tone="cyan" />}
                              {fastestQuoteId === quote.id && <Tag text="Fastest" tone="violet" />}
                              {highestRatedQuoteId === quote.id && <Tag text="Highest rated" tone="fuchsia" />}
                              {bestValueQuoteId === quote.id && <Tag text="Best value" tone="amber" />}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-slate-300">{price != null ? `${price.toFixed(2)} EUR` : '-'}</td>
                        <td className="px-3 py-3 text-slate-300">{quote.message || quote.notes || '-'}</td>
                        <td className="px-3 py-3 text-slate-300">{durationText}</td>
                        <td className="px-3 py-3 text-slate-400">{formatDateTime(quote.created_at)}</td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadgeClass(quote.status)}`}>
                            {formatStatus(quote.status)}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex justify-end gap-2 text-xs">
                            <button
                              type="button"
                              onClick={() => handleSelectWinner(quote)}
                              disabled={busyAction === `winner-${quote.id}`}
                              className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-emerald-300 disabled:opacity-60"
                            >
                              {busyAction === `winner-${quote.id}` ? 'Selecting...' : 'Select Winner'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectQuote(quote)}
                              disabled={busyAction === `reject-${quote.id}`}
                              className="rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-rose-300 disabled:opacity-60"
                            >
                              {busyAction === `reject-${quote.id}` ? 'Rejecting...' : 'Reject'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-800/50 bg-slate-900/60 p-5 shadow-lg shadow-black/10 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-slate-100">Activity Timeline</h2>
            <ul className="mt-4 space-y-3">
              {activities.length === 0 ? (
                <li className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-4 text-sm text-slate-500">No activity entries found for this lead.</li>
              ) : (
                activities.map((activity) => (
                  <li key={activity.id} className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-3">
                    <p className="text-sm text-slate-200">{activity.title || activity.message || activity.description || activity.action || activity.type || 'Activity event'}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatDateTime(activity.created_at)}</p>
                  </li>
                ))
              )}
            </ul>
          </article>

          <article className="rounded-2xl border border-slate-800/50 bg-slate-900/60 p-5 shadow-lg shadow-black/10 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-slate-100">Files / Photos</h2>
            <div className="mt-4">
              {filesAndPhotos.length === 0 ? (
                <p className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-4 text-sm text-slate-500">No uploaded files or photos attached to this lead.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {filesAndPhotos.map((url, index) => (
                    <a
                      key={`${url}-${index}`}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/50 p-2 hover:border-slate-600"
                    >
                      {isImageFile(url) ? (
                        <img src={url} alt={`Lead file ${index + 1}`} className="h-28 w-full rounded object-cover" />
                      ) : (
                        <div className="flex h-28 items-center justify-center rounded border border-dashed border-slate-700 text-xs text-slate-400">
                          Open file
                        </div>
                      )}
                      <p className="mt-2 truncate text-xs text-slate-400">{url}</p>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </article>
        </section>
      </div>
    </div>
  )
}

function DataRow({ label, value, full = false }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? 'md:col-span-2' : ''}>
      <p className="text-xs uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className="mt-1 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-slate-200">{value}</p>
    </div>
  )
}

function Tag({ text, tone }: { text: string; tone: 'cyan' | 'violet' | 'fuchsia' | 'amber' }) {
  const style =
    tone === 'cyan'
      ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
      : tone === 'violet'
        ? 'border-violet-500/40 bg-violet-500/10 text-violet-300'
        : tone === 'fuchsia'
          ? 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300'
          : 'border-amber-500/40 bg-amber-500/10 text-amber-300'

  return <span className={`inline-flex rounded-full border px-2 py-0.5 ${style}`}>{text}</span>
}
