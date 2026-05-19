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
  time_slots: string | string[] | null
  created_at: string | null
  company_id: number | null
  status: string
  price: number | null
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
}

const STATUS_LABELS: Record<string, string> = {
  new: "Neu",
  pending: "Ausstehend",
  sent: "Gesendet",
  accepted: "Angenommen",
  rejected: "Abgelehnt",
  completed: "Abgeschlossen",
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

// --- Main Component ---
export default function CompanyPortalPage(): JSX.Element {
  const params = useParams()
  const router = useRouter()
  const companyIdParam = params?.id as string | undefined
  
  // FIXED: Always parse as number for bigint comparison
  const urlCompanyId = companyIdParam ? Number(companyIdParam) : null
  
  // State
  const [company, setCompany] = useState<Company | null>(null)
  const [leads, setLeads] = useState<LeadData[]>([])
  const [loadingCompany, setLoadingCompany] = useState<boolean>(true)
  const [loadingLeads, setLoadingLeads] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [toasts, setToasts] = useState<Toast[]>([])
  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false)
  const [selectedLead, setSelectedLead] = useState<LeadData | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // FIXED: Auth check - verify localStorage company_id matches URL
  useEffect(() => {
    const storedCompanyId = localStorage.getItem("company_id")
    
    if (!storedCompanyId) {
      // No login - redirect to login page
      router.replace("/company/login")
      return
    }
    
    const storedId = Number(storedCompanyId)
    
    // If URL doesn't match stored ID, redirect to correct portal
    if (urlCompanyId && storedId !== urlCompanyId) {
      router.replace(`/company/${storedId}`)
      return
    }
    
    // If no URL param but we have stored ID, redirect to stored ID portal
    if (!urlCompanyId && storedId) {
      router.replace(`/company/${storedId}`)
      return
    }
  }, [urlCompanyId, router])

  // Fetch company - only if we have a valid companyId
  useEffect(() => {
    if (!urlCompanyId) return

    let mounted = true
    const fetchCompany = async (): Promise<void> => {
      try {
        setLoadingCompany(true)
        const { data, error } = await supabase
          .from("cleaning_companies")
          .select("*")
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

  // Fetch leads for this company - FIXED: Use strict company_id filter
  useEffect(() => {
    if (!urlCompanyId) return

    let mounted = true
    let channel: ReturnType<typeof supabase.channel> | null = null

    const fetchLeads = async (): Promise<void> => {
      try {
        setLoadingLeads(true)
        setError(null)
        // FIXED: Query leads where company_id EXACTLY matches the numeric company ID
        const { data, error } = await supabase
          .from("leads")
          .select("*")
          .eq("company_id", urlCompanyId)
          .order("created_at", { ascending: false })
        if (error) throw error
        if (mounted) setLeads(data || [])
      } catch (err: unknown) {
        const error = err as Error
        if (mounted) setError(error.message || "Fehler beim Laden der Anfragen")
      } finally {
        if (mounted) setLoadingLeads(false)
      }
    }

    const setupRealtime = (): void => {
      channel = supabase
        .channel(`leads_company_${urlCompanyId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "leads",
            filter: `company_id=eq.${urlCompanyId}`,
          },
          () => {
            fetchLeads()
          }
        )
        .subscribe()
    }

    fetchLeads()
    setupRealtime()

    return () => {
      mounted = false
      if (channel) supabase.removeChannel(channel)
    }
  }, [urlCompanyId])

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

  // Update lead status
  const updateLeadStatus = useCallback(async (leadId: string, newStatus: string): Promise<void> => {
    if (!urlCompanyId) return
    setUpdatingStatus(true)
    try {
      // FIXED: Ensure we only update leads belonging to this company
      const { error } = await supabase
        .from("leads")
        .update({ status: newStatus })
        .eq("id", leadId)
        .eq("company_id", urlCompanyId)
      if (error) throw error
      // Update local state
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l))
      )
      if (selectedLead?.id === leadId) {
        setSelectedLead((prev) => (prev ? { ...prev, status: newStatus } : null))
      }
      addToast(`Status aktualisiert: ${STATUS_LABELS[newStatus]}`, "success")
    } catch (err: unknown) {
      const error = err as Error
      addToast(error.message || "Status-Update fehlgeschlagen", "error")
    } finally {
      setUpdatingStatus(false)
    }
  }, [urlCompanyId, selectedLead, addToast])

  // FIXED: Logout function
  const handleLogout = useCallback((): void => {
    localStorage.removeItem("company_id")
    router.replace("/company/login")
  }, [router])

  // Stats
  const stats = useMemo(() => {
    const total = leads.length
    const byStatus = leads.reduce((acc, l) => {
      acc[l.status] = (acc[l.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    const revenue = leads
      .filter((l) => l.status === "accepted" && l.price)
      .reduce((sum, l) => sum + (l.price || 0), 0)
    return { total, ...byStatus, revenue } as Record<string, number> & { total: number; revenue: number }
  }, [leads])

  // Filtered leads - FIXED: Extra safety check for company_id
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // Safety: Ensure lead belongs to this company (should already be filtered by query)
      if (lead.company_id && Number(lead.company_id) !== urlCompanyId) return false
      
      const matchesSearch =
        !searchQuery ||
        lead.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.phone?.includes(searchQuery) ||
        formatArrayOrString(lead.services).toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === "all" || lead.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [leads, searchQuery, statusFilter, urlCompanyId])

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
      <h3 className="text-lg font-semibold text-slate-200 mb-2">Keine Anfragen gefunden</h3>
      <p className="text-slate-400 text-sm max-w-sm mx-auto">
        {searchQuery || statusFilter !== "all"
          ? "Passen Sie Ihre Filter an, um mehr Ergebnisse zu sehen."
          : "Sobald Kunden Anfragen stellen, erscheinen sie hier."}
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
                setLoadingLeads(true)
                supabase.from("leads").select("*").eq("company_id", urlCompanyId).order("created_at", { ascending: false }).then(({ data, error }) => {
                  if (!error) setLeads(data || [])
                  setLoadingLeads(false)
                })
              }}
              disabled={loadingLeads}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-medium transition disabled:opacity-50"
            >
              <svg className={`w-4 h-4 ${loadingLeads ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        {!loadingLeads && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Gesamt", value: stats.total, color: "from-slate-600 to-slate-700" },
              { label: "Neu", value: stats["new"] || 0, color: "from-slate-500 to-slate-600" },
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

        {/* Leads Grid */}
        {loadingLeads ? (
          <div className="grid gap-6 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : filteredLeads.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {filteredLeads.map((lead) => (
              <article
                key={lead.id}
                className="group bg-gradient-to-br from-slate-900/80 to-slate-900/40 backdrop-blur-sm rounded-2xl border border-slate-800/50 p-6 hover:border-cyan-500/30 hover:shadow-lg hover:shadow-cyan-500/5 transition-all duration-300"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-slate-100 truncate group-hover:text-cyan-300 transition-colors">
                      {lead.full_name || "Unbekannter Kunde"}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatDate(lead.created_at)} • {lead.city || "Stadt unbekannt"}
                    </p>
                  </div>
                  <StatusBadge status={lead.status} />
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-5 bg-slate-950/30 p-3 rounded-lg border border-slate-800/30">
                  <p className="text-slate-400"><span className="text-slate-500">E-Mail:</span> <span className="text-slate-200 truncate block">{lead.email || "-"}</span></p>
                  <p className="text-slate-400"><span className="text-slate-500">Telefon:</span> <span className="text-slate-200">{lead.phone || "-"}</span></p>
                  <p className="text-slate-400 col-span-2"><span className="text-slate-500">Leistungen:</span> <span className="text-slate-200">{formatArrayOrString(lead.services)}</span></p>
                  {lead.first_date && (
                    <p className="text-slate-400"><span className="text-slate-500">Wunschdatum:</span> <span className="text-slate-200">{formatDate(lead.first_date)}</span></p>
                  )}
                  {lead.notes && (
                    <p className="text-slate-400 col-span-2"><span className="text-slate-500">Hinweise:</span> <span className="text-slate-300 italic">"{lead.notes}"</span></p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800/50">
                  <div>
                    <p className="text-sm text-slate-300">
                      Preis: <span className="font-semibold text-emerald-400">{lead.price ? `${lead.price.toFixed(2)} €` : "—"}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => { setSelectedLead(lead); setDetailModalOpen(true) }}
                    className="px-4 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-sm font-medium transition text-cyan-400 hover:text-cyan-300"
                  >
                    Details
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Lead Detail Modal */}
        {detailModalOpen && selectedLead && (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={(e: React.MouseEvent<HTMLDivElement>) => e.target === e.currentTarget && setDetailModalOpen(false)}
          >
            <div className="w-full max-w-lg bg-gradient-to-br from-slate-900 to-slate-950 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-slate-800/50 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-100">Anfragedetails</h3>
                <button onClick={() => setDetailModalOpen(false)} className="text-slate-400 hover:text-white text-xl">×</button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-slate-400">Name:</span><p className="text-slate-200">{selectedLead.full_name || "-"}</p></div>
                  <div><span className="text-slate-400">E-Mail:</span><p className="text-slate-200">{selectedLead.email || "-"}</p></div>
                  <div><span className="text-slate-400">Telefon:</span><p className="text-slate-200">{selectedLead.phone || "-"}</p></div>
                  <div><span className="text-slate-400">Stadt:</span><p className="text-slate-200">{selectedLead.city || "-"}</p></div>
                  <div className="col-span-2"><span className="text-slate-400">Leistungen:</span><p className="text-slate-200">{formatArrayOrString(selectedLead.services)}</p></div>
                  {selectedLead.first_date && <div><span className="text-slate-400">Wunschdatum:</span><p className="text-slate-200">{formatDate(selectedLead.first_date)}</p></div>}
                  {selectedLead.price != null && <div><span className="text-slate-400">Preis:</span><p className="text-emerald-400 font-semibold">{selectedLead.price.toFixed(2)} €</p></div>}
                  <div className="col-span-2"><span className="text-slate-400">Status:</span><StatusBadge status={selectedLead.status} /></div>
                  {selectedLead.notes && <div className="col-span-2"><span className="text-slate-400">Hinweise:</span><p className="text-slate-300 italic bg-slate-900/50 p-2 rounded">"{selectedLead.notes}"</p></div>}
                </div>

                {/* Status Actions */}
                <div className="pt-4 border-t border-slate-800/50">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Status ändern</p>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_ACTIONS[selectedLead.status]?.map((action) => (
                      <button
                        key={action.value}
                        onClick={() => updateLeadStatus(selectedLead.id, action.value)}
                        disabled={updatingStatus}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium text-white transition disabled:opacity-50 ${action.color}`}
                      >
                        {updatingStatus ? "..." : action.label}
                      </button>
                    ))}
                  </div>
                </div>
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

      {/* Global Styles for Animations */}
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