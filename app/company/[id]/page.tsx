// app/company/[id]/page.tsx
"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabaseClient"

// --- Types ---
interface Company {
  id: number
  company_name: string | null
  contact_person: string | null
  email: string | null
  phone: string | null
  city: string | null
  active: boolean
}

interface LeadData {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  city: string | null
  services: string | string[] | null
  notes: string | null
  first_date: string | null
  created_at: string | null
}

interface QuoteItem {
  id: string
  lead_id: string
  company_id: number
  price: number | null
  message: string | null
  status: "pending" | "accepted" | "rejected" | "selected" | string
  created_at: string
  lead: LeadData | null
}

interface Toast {
  id: string
  message: string
  type: "success" | "error" | "info"
}

// --- Constants ---
const STATUS_COLORS: Record<string, string> = {
  new: "from-slate-500/20 to-slate-600/10 text-slate-300 border-slate-500/30",
  pending: "from-amber-500/20 to-amber-600/10 text-amber-300 border-amber-500/30",
  sent: "from-blue-500/20 to-blue-600/10 text-blue-300 border-blue-500/30",
  accepted: "from-emerald-500/20 to-emerald-600/10 text-emerald-300 border-emerald-500/30",
  rejected: "from-red-500/20 to-red-600/10 text-red-300 border-red-500/30",
  completed: "from-violet-500/20 to-violet-600/10 text-violet-300 border-violet-500/30",
  selected: "from-emerald-500/20 to-emerald-600/10 text-emerald-300 border-emerald-500/30",
}

const STATUS_LABELS: Record<string, string> = {
  new: "Neu",
  pending: "Ausstehend",
  sent: "Gesendet",
  accepted: "Angenommen",
  rejected: "Abgelehnt",
  completed: "Abgeschlossen",
  selected: "Ausgewählt",
}

const STATUS_ACTIONS: Record<string, { label: string; value: string; color: string }[]> = {
  new: [{ label: "Annehmen", value: "accepted", color: "bg-emerald-600 hover:bg-emerald-500" }],
  pending: [{ label: "Annehmen", value: "accepted", color: "bg-emerald-600 hover:bg-emerald-500" }],
  accepted: [
    { label: "Abschließen", value: "completed", color: "bg-violet-600 hover:bg-violet-500" },
    { label: "Ablehnen", value: "rejected", color: "bg-red-600 hover:bg-red-500" },
  ],
  rejected: [{ label: "Wieder öffnen", value: "new", color: "bg-amber-600 hover:bg-amber-500" }],
  completed: [{ label: "Wieder öffnen", value: "new", color: "bg-amber-600 hover:bg-amber-500" }],
  selected: [],
}

// --- Helper Functions ---
const formatArrayOrString = (val: string | string[] | null | undefined): string => {
  if (!val) return "-"
  if (Array.isArray(val)) return val.filter(Boolean).join(", ") || "-"
  return val.toString().trim() || "-"
}

const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "-"
  try {
    return new Date(dateStr).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  } catch {
    return "-"
  }
}

const generateId = (): string => Math.random().toString(36).substring(2, 9)

// Commission calculation: 10% to Cleanora, rest to company
const calculateCommission = (price: number | null) => {
  if (price == null) return { commission: 0, companyRevenue: 0 }
  const commission = Math.round(price * 0.10 * 100) / 100
  const companyRevenue = Math.round((price - commission) * 100) / 100
  return { commission, companyRevenue }
}

// Safe type guard for nested lead data from Supabase
const parseLeadData = (lead: any): LeadData | null => {
  if (!lead || typeof lead !== 'object') return null
  if (Array.isArray(lead)) {
    if (lead.length === 0) return null
    return parseLeadData(lead[0])
  }
  return {
    id: String(lead.id || ''),
    full_name: lead.full_name ?? null,
    email: lead.email ?? null,
    phone: lead.phone ?? null,
    city: lead.city ?? null,
    services: lead.services ?? null,
    notes: lead.notes ?? null,
    first_date: lead.first_date ?? null,
    created_at: lead.created_at ?? null,
  }
}

// Safe type guard for quote items from Supabase
const parseQuoteItem = (q: any): QuoteItem | null => {
  if (!q) return null
  const lead = parseLeadData(q.lead)
  return {
    id: String(q.id || ''),
    lead_id: String(q.lead_id || ''),
    company_id: Number(q.company_id || 0),
    price: q.price != null ? Number(q.price) : null,
    message: q.message ?? null,
    status: q.status || 'pending',
    created_at: q.created_at || '',
    lead,
  }
}

// --- Main Component ---
export default function CompanyPortalPage(): JSX.Element {
  const params = useParams()
  const router = useRouter()
  const companyIdParam = params?.id as string | undefined
  
  const urlCompanyId = companyIdParam ? Number(companyIdParam) : null
  
  // State
  const [company, setCompany] = useState<Company | null>(null)
  const [quotes, setQuotes] = useState<QuoteItem[]>([])
  const [loadingCompany, setLoadingCompany] = useState<boolean>(true)
  const [loadingQuotes, setLoadingQuotes] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [toasts, setToasts] = useState<Toast[]>([])
  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false)
  const [selectedQuote, setSelectedQuote] = useState<QuoteItem | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Auth check
  useEffect(() => {
    const storedCompanyId = localStorage.getItem("company_id")
    
    if (!urlCompanyId && !storedCompanyId) {
      router.replace("/company/login")
      return
    }
    
    if (urlCompanyId) {
      localStorage.setItem("company_id", String(urlCompanyId))
    }
  }, [urlCompanyId, router])

  // Fetch company by URL ID
  useEffect(() => {
    if (!urlCompanyId) return

    let mounted = true
    const fetchCompany = async (): Promise<void> => {
      try {
        setLoadingCompany(true)
        const { data, error } = await supabase
          .from("cleaning_companies")
          .select("id, company_name, contact_person, email, phone, city, active")
          .eq("id", urlCompanyId)
          .single()
        if (error) throw error
        if (mounted) setCompany(data)
      } catch (err: unknown) {
        if (mounted) setError("Unternehmen nicht gefunden")
      } finally {
        if (mounted) setLoadingCompany(false)
      }
    }
    fetchCompany()
    return () => { mounted = false }
  }, [urlCompanyId])

  // Fetch quotes for this company - FIXED: ensure we fetch by numeric company_id
  const fetchQuotes = useCallback(async (): Promise<void> => {
    if (!urlCompanyId) return

    try {
      setLoadingQuotes(true)
      setError(null)
      
      console.log('[Company] Fetching quotes for company_id:', urlCompanyId)
      
      // Fetch quotes with lead data - use explicit column selection
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          id,
          lead_id,
          company_id,
          price,
          message,
          status,
          created_at,
          lead:leads (
            id,
            full_name,
            email,
            phone,
            city,
            services,
            notes,
            first_date,
            created_at
          )
        `)
        .eq('company_id', urlCompanyId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('[Company] Quote fetch error:', error)
        throw error
      }

      console.log('[Company] Raw quotes data count:', data?.length)
      
      // Safely parse and filter quotes with valid lead data
      const validQuotes = (data || [])
        .map(parseQuoteItem)
        .filter((q): q is QuoteItem => q !== null && q.lead !== null)
      
      console.log('[Company] Parsed valid quotes count:', validQuotes.length)
      console.log('[Company] Quote statuses:', validQuotes.map(q => q.status))
      
      setQuotes(validQuotes)
    } catch (err: unknown) {
      const error = err as Error
      console.error('[Company] Failed to fetch quotes:', error.message)
      setError(error.message || 'Fehler beim Laden der Angebote')
    } finally {
      setLoadingQuotes(false)
    }
  }, [urlCompanyId])

  // Initial fetch and realtime subscription
  useEffect(() => {
    if (!urlCompanyId) return

    let mounted = true
    let channel: ReturnType<typeof supabase.channel> | null = null

    const setupRealtime = (): void => {
      channel = supabase
        .channel(`quotes_company_${urlCompanyId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'quotes',
            filter: `company_id=eq.${urlCompanyId}`,
          },
          () => {
            if (mounted) {
              console.log('[Company] Realtime event triggered, refetching quotes')
              fetchQuotes()
            }
          }
        )
        .subscribe()
    }

    fetchQuotes()
    setupRealtime()

    return () => {
      mounted = false
      if (channel) supabase.removeChannel(channel)
    }
  }, [urlCompanyId, fetchQuotes])

  // Toast system
  const addToast = useCallback((message: string, type: Toast["type"] = "info"): void => {
    const id = generateId()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  const removeToast = useCallback((id: string): void => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // Update quote status
  const updateQuoteStatus = useCallback(async (quoteId: string, newStatus: string): Promise<void> => {
    if (!urlCompanyId) return
    setUpdatingStatus(true)
    try {
      const { error } = await supabase
        .from("quotes")
        .update({ status: newStatus })
        .eq("id", quoteId)
        .eq("company_id", urlCompanyId)
      if (error) throw error
      
      setQuotes((prev) =>
        prev.map((q) => (q.id === quoteId ? { ...q, status: newStatus } : q))
      )
      if (selectedQuote?.id === quoteId) {
        setSelectedQuote((prev) => (prev ? { ...prev, status: newStatus } : null))
      }
      addToast(`Status aktualisiert: ${STATUS_LABELS[newStatus]}`, "success")
    } catch (err: unknown) {
      const error = err as Error
      addToast(error.message || "Status-Update fehlgeschlagen", "error")
    } finally {
      setUpdatingStatus(false)
    }
  }, [urlCompanyId, selectedQuote, addToast])

  // Submit quote price
  const handleSubmitQuote = useCallback(async (quoteId: string, price: number, message: string): Promise<void> => {
    if (!urlCompanyId) return
    setUpdatingStatus(true)
    try {
      const { error } = await supabase
        .from("quotes")
        .update({ 
          price: price,
          message: message || null,
          status: 'pending'
        })
        .eq("id", quoteId)
        .eq("company_id", urlCompanyId)
      if (error) throw error
      
      setQuotes((prev) =>
        prev.map((q) => (q.id === quoteId ? { ...q, price, message: message || null, status: 'pending' } : q))
      )
      if (selectedQuote?.id === quoteId) {
        setSelectedQuote((prev) => (prev ? { ...prev, price, message: message || null, status: 'pending' } : null))
      }
      addToast("Angebot erfolgreich übermittelt", "success")
    } catch (err: unknown) {
      const error = err as Error
      addToast(error.message || "Angebot senden fehlgeschlagen", "error")
    } finally {
      setUpdatingStatus(false)
    }
  }, [urlCompanyId, selectedQuote, addToast])

  // Logout
  const handleLogout = useCallback((): void => {
    localStorage.removeItem("company_id")
    router.replace("/company/login")
  }, [router])

  // Stats
  const stats = useMemo(() => {
    const total = quotes.length
    const byStatus = quotes.reduce((acc, q) => {
      acc[q.status] = (acc[q.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    const revenue = quotes
      .filter((q) => q.status === "accepted" && q.price)
      .reduce((sum, q) => sum + (q.price || 0), 0)
    return { total, ...byStatus, revenue } as Record<string, number> & { total: number; revenue: number }
  }, [quotes])

  // Filtered quotes
  const filteredQuotes = useMemo(() => {
    return quotes.filter((quote) => {
      if (!quote.lead) return false
      const matchesSearch =
        !searchQuery ||
        quote.lead.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        quote.lead.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        quote.lead.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        quote.lead.phone?.includes(searchQuery) ||
        formatArrayOrString(quote.lead.services).toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === "all" || quote.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [quotes, searchQuery, statusFilter])

  // Render helpers
  const StatusBadge = useCallback(({ status }: { status: string | null }): JSX.Element => {
    const key = status?.toLowerCase() || "new"
    const color = STATUS_COLORS[key] || STATUS_COLORS.new
    const label = STATUS_LABELS[key] || "Unbekannt"
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border bg-gradient-to-br ${color}`}>
        {label}
      </span>
    )
  }, [])

  // UI Components
  const SkeletonCard = (): JSX.Element => (
    <div className="bg-slate-900/40 backdrop-blur-sm rounded-2xl border border-slate-800/50 p-6 animate-pulse space-y-4">
      <div className="h-5 bg-slate-800 rounded w-3/4" />
      <div className="grid grid-cols-2 gap-3">
        {[...Array(6)].map((_, i) => <div key={i} className="h-4 bg-slate-800 rounded" />)}
      </div>
      <div className="h-10 bg-slate-800 rounded-xl" />
    </div>
  )

  const EmptyState = (): JSX.Element => (
    <div className="text-center py-16 px-4">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800/50 mb-4">
        <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-slate-200 mb-2">Keine Angebotsanfragen gefunden</h3>
      <p className="text-slate-400 text-sm max-w-sm mx-auto">
        {searchQuery || statusFilter !== "all"
          ? "Passen Sie Ihre Filter an, um mehr Ergebnisse zu sehen."
          : "Sobald Kunden Anfragen stellen, erhalten Sie hier Angebotsanfragen."}
      </p>
    </div>
  )

  // Loading state
  if (loadingCompany) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
      </div>
    )
  }

  // Not found / error state
  if (error || !company) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-200 mb-2">Unternehmen nicht gefunden</h2>
          <p className="text-slate-400 mb-6">Das ausgewählte Unternehmen existiert nicht oder ist nicht aktiv.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={handleLogout}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-medium transition"
            >
              Abmelden
            </button>
            <Link href="/company" className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition">
              Zurück zur Auswahl
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-800/50">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl md:text-4xl font-black tracking-tight bg-gradient-to-r from-cyan-400 via-emerald-400 to-violet-500 bg-clip-text text-transparent">
                {company.company_name || "Unbenannt"}
              </h1>
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                Aktiv
              </span>
            </div>
            <div className="flex flex-wrap gap-2 text-sm text-slate-400">
              {company.city && <span>📍 {company.city}</span>}
              {company.contact_person && <span>👤 {company.contact_person}</span>}
              {company.email && <span>✉️ {company.email}</span>}
              {company.phone && <span>📞 {company.phone}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 text-sm font-medium transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Abmelden
            </button>
            <Link
              href="/company"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-medium transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Zurück
            </Link>
            <button
              onClick={() => {
                setLoadingQuotes(true)
                fetchQuotes()
              }}
              disabled={loadingQuotes}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-medium transition disabled:opacity-50"
            >
              <svg className={`w-4 h-4 ${loadingQuotes ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Aktualisieren
            </button>
          </div>
        </header>

        {/* Toast Container */}
        <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-md animate-slide-in ${
                toast.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : toast.type === "error"
                  ? "bg-red-500/10 border-red-500/30 text-red-300"
                  : "bg-slate-800/80 border-slate-700 text-slate-200"
              }`}
            >
              <span className="text-sm font-medium">{toast.message}</span>
              <button onClick={() => removeToast(toast.id)} className="ml-2 text-lg hover:opacity-70">×</button>
            </div>
          ))}
        </div>

        {/* Error Banner */}
        {error && (
          <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-lg hover:opacity-70">×</button>
          </div>
        )}

        {/* Dashboard Stats */}
        {!loadingQuotes && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Gesamt", value: stats.total, color: "from-slate-600 to-slate-700" },
              { label: "Ausstehend", value: stats["pending"] || 0, color: "from-amber-500 to-amber-600" },
              { label: "Angenommen", value: stats["accepted"] || 0, color: "from-emerald-500 to-emerald-600" },
              { label: "Abgelehnt", value: stats["rejected"] || 0, color: "from-red-500 to-red-600" },
              { label: "Abgeschlossen", value: stats["completed"] || 0, color: "from-violet-500 to-violet-600" },
              { label: "Umsatz", value: `${(stats.revenue || 0).toFixed(0)}€`, color: "from-cyan-500 to-blue-600" },
            ].map((stat) => (
              <div key={stat.label} className="bg-gradient-to-br from-slate-900/60 to-slate-900/30 backdrop-blur-sm p-3 rounded-xl border border-slate-800/50">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{stat.label}</p>
                <p className={`text-xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent mt-1`}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Suche nach Name, Stadt, E-Mail, Telefon oder Service..."
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-900/60 border border-slate-800/50 text-slate-200 placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none transition"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
            className="px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-800/50 text-slate-200 focus:border-cyan-500/50 focus:outline-none transition"
          >
            <option value="all">Alle Status</option>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {/* Quotes Grid */}
        {loadingQuotes ? (
          <div className="grid gap-6 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : filteredQuotes.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {filteredQuotes.map((quote) => {
              if (!quote.lead) return null
              const { commission, companyRevenue } = calculateCommission(quote.price)
              const isSelected = quote.status === "selected"
              const isRejected = quote.status === "rejected"
              const hasPrice = quote.price != null
              
              return (
                <article
                  key={quote.id}
                  className={`group bg-gradient-to-br from-slate-900/80 to-slate-900/40 backdrop-blur-sm rounded-2xl border p-6 hover:shadow-lg transition-all duration-300 ${
                    isSelected 
                      ? "border-emerald-500/50 shadow-emerald-500/10" 
                      : isRejected 
                        ? "border-slate-700 opacity-70" 
                        : "border-slate-800/50 hover:border-cyan-500/30 hover:shadow-cyan-500/5"
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-slate-100 truncate group-hover:text-cyan-300 transition-colors">
                        {quote.lead.full_name || "Unbekannter Kunde"}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {formatDate(quote.created_at)} • {quote.lead.city || "Stadt unbekannt"}
                      </p>
                    </div>
                    <StatusBadge status={quote.status} />
                  </div>

                  {isSelected && (
                    <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm">
                      ✅ Ihr Angebot wurde ausgewählt. Bitte kontaktieren Sie den Kunden.
                    </div>
                  )}

                  {isRejected && (
                    <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                      ❌ Eine andere Firma wurde ausgewählt.
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-5 bg-slate-950/30 p-3 rounded-lg border border-slate-800/30">
                    <p className="text-slate-400"><span className="text-slate-500">E-Mail:</span> <span className="text-slate-200 truncate block">{quote.lead.email || "-"}</span></p>
                    <p className="text-slate-400"><span className="text-slate-500">Telefon:</span> <span className="text-slate-200">{quote.lead.phone || "-"}</span></p>
                    <p className="text-slate-400 col-span-2"><span className="text-slate-500">Leistungen:</span> <span className="text-slate-200">{formatArrayOrString(quote.lead.services)}</span></p>
                    {quote.lead.first_date && (
                      <p className="text-slate-400"><span className="text-slate-500">Wunschdatum:</span> <span className="text-slate-200">{formatDate(quote.lead.first_date)}</span></p>
                    )}
                    {quote.message && (
                      <p className="text-slate-400 col-span-2"><span className="text-slate-500">Nachricht:</span> <span className="text-slate-300 italic">"{quote.message}"</span></p>
                    )}
                  </div>

                  {hasPrice && (
                    <div className="mb-5 p-3 rounded-lg bg-slate-900/50 border border-slate-700/50">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-400">Angebotspreis:</span>
                        <span className="text-slate-200 font-medium">{quote.price!.toFixed(2)} €</span>
                      </div>
                      <div className="flex justify-between text-sm mb-1 text-amber-400">
                        <span>Cleanora Provision (10%):</span>
                        <span>-{commission.toFixed(2)} €</span>
                      </div>
                      <div className="flex justify-between text-sm font-semibold text-emerald-400 border-t border-slate-700 pt-2">
                        <span>Auszahlung an Firma:</span>
                        <span>{companyRevenue.toFixed(2)} €</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-slate-800/50">
                    <div>
                      <p className="text-sm text-slate-300">
                        Preis: <span className="font-semibold text-emerald-400">{hasPrice ? `${quote.price!.toFixed(2)} €` : "—"}</span>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {quote.status === "pending" && !hasPrice && (
                        <button
                          onClick={() => {
                            const priceInput = prompt("Angebotspreis in €:", "")
                            if (priceInput) {
                              const price = parseFloat(priceInput)
                              if (!isNaN(price) && price > 0) {
                                handleSubmitQuote(quote.id, price, "")
                              }
                            }
                          }}
                          disabled={updatingStatus}
                          className="px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition disabled:opacity-50"
                        >
                          Preis eingeben
                        </button>
                      )}
                      {quote.status === "pending" && hasPrice && !isSelected && !isRejected && (
                        <>
                          <button
                            onClick={() => updateQuoteStatus(quote.id, "accepted")}
                            disabled={updatingStatus}
                            className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition disabled:opacity-50"
                          >
                            Annehmen
                          </button>
                          <button
                            onClick={() => updateQuoteStatus(quote.id, "rejected")}
                            disabled={updatingStatus}
                            className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition disabled:opacity-50"
                          >
                            Ablehnen
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => { setSelectedQuote(quote); setDetailModalOpen(true) }}
                        className="px-4 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-sm font-medium transition text-cyan-400 hover:text-cyan-300"
                      >
                        Details
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {/* Quote Detail Modal */}
        {detailModalOpen && selectedQuote && (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={(e: React.MouseEvent<HTMLDivElement>) => e.target === e.currentTarget && setDetailModalOpen(false)}
          >
            <div className="w-full max-w-lg bg-gradient-to-br from-slate-900 to-slate-950 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-slate-800/50 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-100">Angebotsdetails</h3>
                <button onClick={() => setDetailModalOpen(false)} className="text-slate-400 hover:text-white text-xl">×</button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-slate-400">Name:</span><p className="text-slate-200">{selectedQuote.lead?.full_name || "-"}</p></div>
                  <div><span className="text-slate-400">E-Mail:</span><p className="text-slate-200">{selectedQuote.lead?.email || "-"}</p></div>
                  <div><span className="text-slate-400">Telefon:</span><p className="text-slate-200">{selectedQuote.lead?.phone || "-"}</p></div>
                  <div><span className="text-slate-400">Stadt:</span><p className="text-slate-200">{selectedQuote.lead?.city || "-"}</p></div>
                  <div className="col-span-2"><span className="text-slate-400">Leistungen:</span><p className="text-slate-200">{selectedQuote.lead ? formatArrayOrString(selectedQuote.lead.services) : "-"}</p></div>
                  {selectedQuote.lead?.first_date && <div><span className="text-slate-400">Wunschdatum:</span><p className="text-slate-200">{formatDate(selectedQuote.lead.first_date)}</p></div>}
                  
                  {selectedQuote.price != null && (
                    <>
                      <div><span className="text-slate-400">Angebotspreis:</span><p className="text-emerald-400 font-semibold">{selectedQuote.price.toFixed(2)} €</p></div>
                      <div><span className="text-slate-400">Cleanora Provision (10%):</span><p className="text-amber-400">-{calculateCommission(selectedQuote.price).commission.toFixed(2)} €</p></div>
                      <div className="col-span-2"><span className="text-slate-400">Auszahlung an Firma:</span><p className="text-emerald-400 font-semibold">{calculateCommission(selectedQuote.price).companyRevenue.toFixed(2)} €</p></div>
                    </>
                  )}
                  
                  <div className="col-span-2"><span className="text-slate-400">Status:</span><StatusBadge status={selectedQuote.status} /></div>
                  {selectedQuote.message && <div className="col-span-2"><span className="text-slate-400">Nachricht:</span><p className="text-slate-300 italic bg-slate-900/50 p-2 rounded">"{selectedQuote.message}"</p></div>}
                </div>

                {!selectedQuote.status.match(/^(selected|rejected)$/) && (
                  <div className="pt-4 border-t border-slate-800/50">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Status ändern</p>
                    <div className="flex flex-wrap gap-2">
                      {STATUS_ACTIONS[selectedQuote.status]?.map((action) => (
                        <button
                          key={action.value}
                          onClick={() => updateQuoteStatus(selectedQuote.id, action.value)}
                          disabled={updatingStatus}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium text-white transition disabled:opacity-50 ${action.color}`}
                        >
                          {updatingStatus ? "..." : action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-slate-800/50 bg-slate-900/30 flex justify-end">
                <button
                  onClick={() => setDetailModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-medium transition"
                >
                  Schließen
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes slide-in {
          from { opacity: 0; transform: translateX(100%); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-slide-in { animation: slide-in 0.3s ease-out; }
      `}</style>
    </div>
  )
}