// app/admin/page.tsx
"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from "@/lib/supabaseClient"

// --- Types ---
interface Lead {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  city: string | null
  services: string[] | string | null
  status: string
  created_at: string
  internal_notes: string | null
  priority: "Normal" | "Urgent" | null
  lead_score: "Low" | "Silver" | "Gold" | null
  archived: boolean
  customer_type: string | null
  company_name: string | null
  street: string | null
  house_number: string | null
  zip_code: string | null
  other_service: string | null
  frequency: string | null
  times_per_week: string | null
  weekdays: string[] | null
  size: string | null
  rooms: string | null
  bathrooms: string | null
  first_date: string | null
  time_slots: string[] | null
  weekend: string | null
  notes: string | null
  company_id: number | null
}

interface Company {
  id: number
  company_name: string | null
  contact_person: string | null
  email: string | null
  phone: string | null
  city: string | null
  address: string | null
  services: string[] | string | null
  rating: number | null
  active: boolean
  notes: string | null
}

interface Quote {
  id: string
  lead_id: string
  company_id: number
  company_name?: string
  price: number | null
  message: string | null
  status: "pending" | "accepted" | "rejected" | "selected" | string
  created_at: string
}

type ViewTab = "leads" | "companies"
type StatusOption = "new" | "contacted" | "quote_sent" | "completed" | "cancelled"
const STATUS_OPTIONS: readonly StatusOption[] = ["new", "contacted", "quote_sent", "completed", "cancelled"] as const

const PRIORITY_OPTIONS: readonly ("Normal" | "Urgent")[] = ["Normal", "Urgent"] as const
const SCORE_OPTIONS: readonly ("Low" | "Silver" | "Gold")[] = ["Low", "Silver", "Gold"] as const
const QUOTE_STATUS_OPTIONS: readonly ("pending" | "accepted" | "rejected" | "selected")[] = ["pending", "accepted", "rejected", "selected"] as const

// --- Helpers ---
const parseArray = (val: string[] | string | null | undefined): string[] => {
  if (Array.isArray(val)) return val
  if (typeof val === "string") return val.split(",").map((s) => s.trim()).filter(Boolean)
  return []
}

// Commission calculation: 10% to Cleanora, rest to company
const calculateCommission = (price: number | null) => {
  if (price == null) return { commission: 0, companyRevenue: 0 }
  const commission = Math.round(price * 0.10 * 100) / 100
  const companyRevenue = Math.round((price - commission) * 100) / 100
  return { commission, companyRevenue }
}

export default function AdminDashboard(): JSX.Element {
  const router = useRouter()
  const [viewTab, setViewTab] = useState<ViewTab>("leads")
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  // Auth check on mount
  useEffect(() => {
    const checkAuth = async (): Promise<void> => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
      } else {
        setIsAuthenticated(true)
      }
    }
    checkAuth()
  }, [router])


  // Leads State
  const [leads, setLeads] = useState<Lead[]>([])
  const [loadingLeads, setLoadingLeads] = useState<boolean>(true)
  const [leadSearch, setLeadSearch] = useState<string>("")
  const [leadStatusFilter, setLeadStatusFilter] = useState<StatusOption | "all">("all")
  const [showArchived, setShowArchived] = useState<boolean>(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [leadSaving, setLeadSaving] = useState<boolean>(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [leadModalTab, setLeadModalTab] = useState<"details" | "quotes">("details")
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [assigningCompany, setAssigningCompany] = useState<boolean>(false)

  // Lead Modal Form State
  const [modalStatus, setModalStatus] = useState<StatusOption | "">("")
  const [modalPriority, setModalPriority] = useState<"Normal" | "Urgent" | "">("")
  const [modalScore, setModalScore] = useState<"Low" | "Silver" | "Gold" | "">("")
  const [modalNotes, setModalNotes] = useState<string>("")
  const [modalCompanyId, setModalCompanyId] = useState<string>("")

  // Companies State
  const [companies, setCompanies] = useState<Company[]>([])
  const [loadingCompanies, setLoadingCompanies] = useState<boolean>(false)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [companySearch, setCompanySearch] = useState<string>("")
  const [companyForm, setCompanyForm] = useState<Partial<Company>>({})
  const [savingCompany, setSavingCompany] = useState<boolean>(false)

  // Quotes State
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loadingQuotes, setLoadingQuotes] = useState<boolean>(false)
  const [quoteForm, setQuoteForm] = useState<{ price: string; message: string; status: string }>({
    price: "",
    message: "",
    status: "pending",
  })
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null)
  const [sendingQuote, setSendingQuote] = useState<string | null>(null)

  // --- Fetch Functions ---
  const fetchLeads = useCallback(async (): Promise<void> => {
    setLoadingLeads(true)
    setFetchError(null)
    try {
      const { data, error } = await supabase
        .from("leads")
        .select(`
          *,
          quotes (
            id,
            company_id,
            price,
            message,
            status,
            created_at
          )
        `)
        .order("created_at", { ascending: false })
      if (error) throw error
      setLeads((data as Lead[]) || [])
      setLastRefresh(new Date())
    } catch (err: unknown) {
      const error = err as Error
      setFetchError(error.message || "Fehler beim Laden der Leads")
    } finally {
      setLoadingLeads(false)
    }
  }, [])

  const fetchCompanies = useCallback(async (): Promise<void> => {
    setLoadingCompanies(true)
    try {
      // Fetch ONLY real columns from cleaning_companies
      const { data, error } = await supabase
        .from("cleaning_companies")
        .select("id, company_name, contact_person, email, phone, city, address, services, active, notes")
        .order("company_name", { ascending: true })
      if (error) throw error
      const companiesData: Company[] = (data || []).map((c: any) => ({
        ...c,
        id: typeof c.id === 'string' ? parseInt(c.id, 10) : c.id
      }))
      setCompanies(companiesData)
    } catch (err: unknown) {
      const error = err as Error
      setFetchError(error.message || "Fehler beim Laden der Firmen")
    } finally {
      setLoadingCompanies(false)
    }
  }, [])

  const fetchQuotes = useCallback(async (leadId: string): Promise<void> => {
    setLoadingQuotes(true)
    try {
      // Fetch quotes with explicit fields, then resolve company_name from local state
      const { data, error } = await supabase
        .from("quotes")
        .select("id, lead_id, company_id, price, message, status, created_at")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
      
      if (error) throw error
      
      const quotesWithCompany = ((data as any[]) || []).map((q) => {
        const matchedCompany = companies.find(c => Number(c.id) === Number(q.company_id))
        return {
          id: q.id,
          lead_id: q.lead_id,
          company_id: q.company_id,
          price: q.price,
          message: q.message,
          status: q.status,
          created_at: q.created_at,
          company_name: matchedCompany?.company_name || "Unbekannt",
        }
      })
      
      setQuotes(quotesWithCompany)
    } catch (err: unknown) {
      console.error("Failed to fetch quotes for lead:", leadId, err)
    } finally {
      setLoadingQuotes(false)
    }
  }, [companies])

  // --- Effects ---
  useEffect(() => {
    fetchCompanies()
  }, [fetchCompanies])

  useEffect(() => {
    fetchLeads()
    const leadInterval = setInterval(fetchLeads, 10000)
    return () => clearInterval(leadInterval)
  }, [fetchLeads])

  useEffect(() => {
    if (viewTab === "companies" && companies.length === 0) fetchCompanies()
  }, [viewTab, companies.length, fetchCompanies])

  useEffect(() => {
    if (selectedLead) {
      setModalStatus((selectedLead.status as StatusOption) || "new")
      setModalPriority(selectedLead.priority || "Normal")
      setModalScore(selectedLead.lead_score || "Low")
      setModalNotes(selectedLead.internal_notes || "")
      setModalCompanyId(selectedLead.company_id != null ? String(selectedLead.company_id) : "")
      fetchQuotes(selectedLead.id)
      setLeadModalTab("details")
    }
  }, [selectedLead, fetchQuotes])

  // Clear success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  // --- Handlers ---
  const handleSaveLeadModal = async (): Promise<void> => {
    if (!selectedLead || leadSaving) return
    setLeadSaving(true)
    try {
      const { error } = await supabase
        .from("leads")
        .update({
          status: modalStatus,
          priority: modalPriority || null,
          lead_score: modalScore || null,
          internal_notes: modalNotes,
        })
        .eq("id", selectedLead.id)
      if (error) throw error
      
      setLeads((prev) =>
        prev.map((l) =>
          l.id === selectedLead.id
            ? { ...l, status: modalStatus, priority: modalPriority || null, lead_score: modalScore || null, internal_notes: modalNotes }
            : l
        )
      )
      setSelectedLead((prev) =>
        prev
          ? { ...prev, status: modalStatus, priority: modalPriority || null, lead_score: modalScore || null, internal_notes: modalNotes }
          : null
      )
      
      setSuccessMessage("Lead erfolgreich aktualisiert")
    } catch (err: unknown) {
      const error = err as Error
      setFetchError(error.message || "Speichern fehlgeschlagen")
    } finally {
      setLeadSaving(false)
    }
  }

  const handleAssignCompany = async (): Promise<void> => {
    if (!selectedLead || assigningCompany) return
    setAssigningCompany(true)
    try {
      let companyId: number | null = null
      if (modalCompanyId) {
        const selectedCompany = companies.find(c => String(c.id) === modalCompanyId)
        if (selectedCompany) {
          companyId = selectedCompany.id
        } else {
          const parsedId = Number(modalCompanyId)
          if (!isNaN(parsedId) && parsedId > 0) {
            companyId = parsedId
          }
        }
      }
      
      const { error } = await supabase
        .from("leads")
        .update({ company_id: companyId })
        .eq("id", selectedLead.id)
      
      if (error) throw error
      
      setLeads((prev) =>
        prev.map((l) =>
          l.id === selectedLead.id
            ? { ...l, company_id: companyId }
            : l
        )
      )
      setSelectedLead((prev) =>
        prev
          ? { ...prev, company_id: companyId }
          : null
      )
      
      await fetchLeads()
      setSuccessMessage(companyId ? "Firma zugewiesen" : "Zuweisung entfernt")
    } catch (err: unknown) {
      const error = err as Error
      console.error("Failed to assign company:", error)
      setFetchError(error.message || "Zuweisung fehlgeschlagen")
    } finally {
      setAssigningCompany(false)
    }
  }

  const handleArchiveLead = async (): Promise<void> => {
    if (!selectedLead) return
    if (!window.confirm("Möchten Sie diesen Lead wirklich archivieren?")) return
    
    try {
      const { error } = await supabase.from("leads").update({ archived: true }).eq("id", selectedLead.id)
      if (error) throw error
      setLeads((prev) => prev.map((l) => (l.id === selectedLead.id ? { ...l, archived: true } : l)))
      setSelectedLead(null)
      setSuccessMessage("Lead archiviert")
    } catch (err: unknown) {
      const error = err as Error
      setFetchError(error.message || "Archivieren fehlgeschlagen")
    }
  }

  const openCompanyModal = (company?: Company): void => {
    if (company) {
      setSelectedCompany(company)
      setCompanyForm({ ...company })
    } else {
      setSelectedCompany({} as Company)
      setCompanyForm({
        company_name: "",
        contact_person: "",
        email: "",
        phone: "",
        city: "",
        address: "",
        services: [],
        rating: 0,
        active: true,
        notes: "",
      })
    }
  }

  const saveCompany = async (): Promise<void> => {
    if (!companyForm.company_name?.trim()) return
    setSavingCompany(true)
    try {
      const payload = {
        company_name: companyForm.company_name,
        contact_person: companyForm.contact_person || null,
        email: companyForm.email || null,
        phone: companyForm.phone || null,
        city: companyForm.city || null,
        address: companyForm.address || null,
        services: Array.isArray(companyForm.services) ? companyForm.services : [],
        rating: Number(companyForm.rating) || 0,
        active: companyForm.active ?? true,
        notes: companyForm.notes || null,
      }

      const isEdit = Boolean(selectedCompany && "id" in selectedCompany && selectedCompany.id)
      const res = isEdit
        ? await supabase.from("cleaning_companies").update(payload).eq("id", selectedCompany!.id)
        : await supabase.from("cleaning_companies").insert(payload)

      if (res.error) throw res.error

      await fetchCompanies()
      setSelectedCompany(null)
      setCompanyForm({})
      setSuccessMessage("Firma erfolgreich gespeichert")
    } catch (err: unknown) {
      const error = err as Error
      console.error("Failed to save company", error)
      setFetchError(error.message || "Firmendaten speichern fehlgeschlagen")
    } finally {
      setSavingCompany(false)
    }
  }

  const toggleCompanyActive = async (id: number, currentActive: boolean): Promise<void> => {
    try {
      const { error } = await supabase.from("cleaning_companies").update({ active: !currentActive }).eq("id", id)
      if (error) throw error
      setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, active: !currentActive } : c)))
      setSuccessMessage(`Firma ${!currentActive ? 'aktiviert' : 'deaktiviert'}`)
    } catch (err: unknown) {
      const error = err as Error
      setFetchError(error.message)
    }
  }

  const handleCreateQuote = async (companyId: number): Promise<void> => {
    if (!selectedLead) return
    setSendingQuote(String(companyId))
    try {
      const { error } = await supabase.from("quotes").insert({
        lead_id: selectedLead.id,
        company_id: companyId,
        status: "pending",
        price: null,
        message: null,
      })
      if (error) throw error
      await fetchQuotes(selectedLead.id)
      setSuccessMessage("Anfrage an Firma gesendet")
    } catch (err: unknown) {
      const error = err as Error
      setFetchError(error.message || "Anfrage senden fehlgeschlagen")
    } finally {
      setSendingQuote(null)
    }
  }

  const handleUpdateQuote = async (quoteId: string): Promise<void> => {
    if (!selectedLead || !quoteId) return
    try {
      const payload = {
        price: quoteForm.price ? parseFloat(quoteForm.price) : null,
        message: quoteForm.message || null,
        status: quoteForm.status,
      }
      const { error } = await supabase.from("quotes").update(payload).eq("id", quoteId)
      if (error) throw error
      setEditingQuoteId(null)
      await fetchQuotes(selectedLead.id)
      setSuccessMessage("Angebot aktualisiert")
    } catch (err: unknown) {
      const error = err as Error
      setFetchError(error.message || "Angebot aktualisieren fehlgeschlagen")
    }
  }

  // Handle selecting a quote winner
  const handleSelectQuoteWinner = async (selectedQuoteId: string): Promise<void> => {
    if (!selectedLead) return
    if (!window.confirm("Dieses Angebot auswählen und alle anderen ablehnen?")) return

    try {
      // Update selected quote to "selected"
      const { error: updateSelectedError } = await supabase
        .from("quotes")
        .update({ status: "selected" })
        .eq("id", selectedQuoteId)
      
      if (updateSelectedError) throw updateSelectedError

      // Update all other quotes for this lead to "rejected"
      const { error: updateOthersError } = await supabase
        .from("quotes")
        .update({ status: "rejected" })
        .eq("lead_id", selectedLead.id)
        .neq("id", selectedQuoteId)
      
      if (updateOthersError) throw updateOthersError

      // Update lead status
      const { error: updateLeadError } = await supabase
        .from("leads")
        .update({ status: "quote_sent" })
        .eq("id", selectedLead.id)
      
      if (updateLeadError) throw updateLeadError

      // Refresh data
      await fetchLeads()
      await fetchQuotes(selectedLead.id)
      setSuccessMessage("Angebot ausgewählt und Lead aktualisiert")
    } catch (err: unknown) {
      const error = err as Error
      setFetchError(error.message || "Auswahl fehlgeschlagen")
    }
  }

  const closeLeadModal = (): void => {
    setSelectedLead(null)
    setLeadModalTab("details")
    setModalStatus("")
    setModalPriority("")
    setModalScore("")
    setModalNotes("")
    setModalCompanyId("")
    setEditingQuoteId(null)
    setQuoteForm({ price: "", message: "", status: "pending" })
  }

  const closeCompanyModal = (): void => {
    setSelectedCompany(null)
    setCompanyForm({})
  }

  // --- Matching Logic ---
  const getMatchingCompanies = (lead: Lead): Company[] => {
    if (!lead.city) return []
    const leadServices = parseArray(lead.services)
    return companies.filter((c) => {
      const companyServices = parseArray(c.services)
      const matchesCity = c.city?.toLowerCase() === lead.city?.toLowerCase()
      const matchesService = leadServices.length === 0 || leadServices.some((s) => companyServices.includes(s))
      return matchesCity && matchesService
    })
  }

  const getCompanyNameById = (companyId: number | null): string => {
    if (!companyId) return "-"
    const company = companies.find(c => c.id === companyId || String(c.id) === String(companyId))
    return company?.company_name || "Unbekannt"
  }

  // --- UI Helpers ---
  const filteredLeads = useMemo(() => leads.filter((lead) => {
    if (!showArchived && lead.archived) return false
    const q = leadSearch.toLowerCase()
    const matchesSearch =
      !q ||
      lead.full_name?.toLowerCase().includes(q) ||
      lead.email?.toLowerCase().includes(q) ||
      lead.phone?.includes(q) ||
      lead.city?.toLowerCase().includes(q)
    const matchesStatus = leadStatusFilter === "all" || lead.status === leadStatusFilter
    return matchesSearch && matchesStatus
  }), [leads, showArchived, leadSearch, leadStatusFilter])

  const filteredCompanies = useMemo(() => companies.filter((c) =>
    !companySearch ||
    c.company_name?.toLowerCase().includes(companySearch.toLowerCase()) ||
    c.city?.toLowerCase().includes(companySearch.toLowerCase())
  ), [companies, companySearch])

  const formatServices = (s: Lead["services"]): string => parseArray(s).join(", ") || "-"
  const formatDate = (d: string): string => new Date(d).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
  const formatVal = (v: any): string => (v ? String(v) : "-")

  if (isAuthenticated === null) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-[1400px] mx-auto">
        {/* Header & Tabs */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent">
            Admin Dashboard
          </h1>
          <div className="flex gap-2 items-center">
            <Link href="/admin/leads" className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-400 text-sm font-medium transition">
              View Leads
            </Link>
            <div className="flex gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
              {(["leads", "companies"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setViewTab(tab)}
                  className={`px-5 py-2 rounded-lg text-sm font-medium transition ${
                    viewTab === tab ? "bg-slate-800 text-emerald-400 shadow-sm" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {tab === "leads" ? "Leads" : "Firmen"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {successMessage && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm animate-pulse">
            {successMessage}
          </div>
        )}

        {fetchError && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
            {fetchError}
          </div>
        )}

        {/* --- LEADS TAB --- */}
        {viewTab === "leads" && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <input
                type="text"
                placeholder="Suche (Name, E-Mail, Telefon, Stadt)..."
                value={leadSearch}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLeadSearch(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:outline-none transition text-sm"
              />
              <select
                value={leadStatusFilter}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setLeadStatusFilter(e.target.value as StatusOption | "all")}
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:outline-none transition text-sm appearance-none cursor-pointer"
              >
                <option value="all">Alle Status</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
              <label className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                <input type="checkbox" checked={showArchived} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShowArchived(e.target.checked)} className="w-4 h-4 accent-emerald-500 rounded" />
                <span className="text-sm text-slate-300">Archivierte anzeigen</span>
              </label>
              <div className="flex items-center justify-end text-xs text-slate-500">
                Aktualisiert: {lastRefresh.toLocaleTimeString("de-DE")}
                <button onClick={fetchLeads} disabled={loadingLeads} className="ml-2 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 transition disabled:opacity-50">
                  {loadingLeads ? "..." : "Refresh"}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-800/50 text-slate-400 uppercase tracking-wider text-xs">
                    <tr>
                      <th className="px-6 py-4 font-medium">Name</th>
                      <th className="px-6 py-4 font-medium">E-Mail</th>
                      <th className="px-6 py-4 font-medium hidden md:table-cell">Telefon</th>
                      <th className="px-6 py-4 font-medium hidden md:table-cell">Stadt</th>
                      <th className="px-6 py-4 font-medium">Reinigungsarten</th>
                      <th className="px-6 py-4 font-medium">Zugewiesen</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium hidden lg:table-cell">Eingegangen</th>
                      <th className="px-6 py-4 font-medium w-24">Aktion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {loadingLeads && filteredLeads.length === 0 ? (
                      <tr><td colSpan={9} className="px-6 py-12 text-center text-slate-500">Lade Leads...</td></tr>
                    ) : filteredLeads.length === 0 ? (
                      <tr><td colSpan={9} className="px-6 py-12 text-center text-slate-500">Keine Leads gefunden.</td></tr>
                    ) : (
                      filteredLeads.map((lead) => (
                        <tr
                          key={lead.id}
                          className={`hover:bg-slate-800/30 transition cursor-pointer ${lead.archived ? "opacity-70 bg-slate-900/40" : ""}`}
                          onClick={() => setSelectedLead(lead)}
                        >
                          <td className="px-6 py-4 font-medium text-slate-200">{lead.full_name || "-"}</td>
                          <td className="px-6 py-4 text-slate-300">{lead.email || "-"}</td>
                          <td className="px-6 py-4 text-slate-300 hidden md:table-cell">{lead.phone || "-"}</td>
                          <td className="px-6 py-4 text-slate-300 hidden md:table-cell">{lead.city || "-"}</td>
                          <td className="px-6 py-4 max-w-[200px] truncate text-slate-400">{formatServices(lead.services)}</td>
                          <td className="px-6 py-4">
                            {lead.company_id ? (
                              <span className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded-md text-xs font-medium border border-blue-500/30">
                                {getCompanyNameById(lead.company_id)}
                              </span>
                            ) : (
                              <span className="text-slate-500 text-xs">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4"><StatusBadge status={lead.status} archived={lead.archived} /></td>
                          <td className="px-6 py-4 text-slate-400 hidden lg:table-cell whitespace-nowrap">{formatDate(lead.created_at)}</td>
                          <td className="px-6 py-4">
                            <button className="text-emerald-400 hover:text-emerald-300 text-xs font-semibold">Details</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* LEAD DETAILS MODAL */}
            {selectedLead && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" onClick={(e: React.MouseEvent<HTMLDivElement>) => e.target === e.currentTarget && closeLeadModal()}>
                <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl">
                  <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-start gap-4 sticky top-0 bg-slate-900/95 backdrop-blur z-10">
                    <div>
                      <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        {selectedLead.full_name}
                        {selectedLead.archived && <span className="text-xs font-medium px-2 py-1 rounded bg-slate-700 text-slate-300">Archiviert</span>}
                      </h2>
                      <p className="text-slate-400 text-sm mt-1">Eingegangen: {formatDate(selectedLead.created_at)}</p>
                    </div>
                    <div className="flex gap-2">
                      {!selectedLead.archived && (
                        <button onClick={handleArchiveLead} className="px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 text-sm font-medium transition">Archivieren</button>
                      )}
                      <button onClick={closeLeadModal} className="text-slate-400 hover:text-white text-2xl leading-none transition">×</button>
                    </div>
                  </div>

                  <div className="flex gap-2 p-6 pb-2 border-b border-slate-800">
                    {(["details", "quotes"] as const).map((t) => (
                      <button key={t} onClick={() => setLeadModalTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${leadModalTab === t ? "bg-slate-800 text-emerald-400" : "text-slate-400 hover:text-slate-200"}`}>
                        {t === "details" ? "Details & Bearbeiten" : "Firmen & Angebote"}
                      </button>
                    ))}
                  </div>

                  <div className="p-6">
                    {leadModalTab === "details" ? (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-800/40 rounded-xl border border-slate-700/50 mb-6">
                          <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</label>
                            <select value={modalStatus} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setModalStatus(e.target.value as StatusOption)} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:border-emerald-500 focus:outline-none">
                              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Priorität</label>
                            <select value={modalPriority} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setModalPriority(e.target.value as "Normal" | "Urgent" | "")} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:border-emerald-500 focus:outline-none">
                              {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Lead Score</label>
                            <select value={modalScore} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setModalScore(e.target.value as "Low" | "Silver" | "Gold" | "")} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:border-emerald-500 focus:outline-none">
                              {SCORE_OPTIONS.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                            </select>
                          </div>
                        </div>
                        
                        <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-700/50 mb-6">
                          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Firma zuweisen</label>
                          <div className="flex gap-2">
                            <select 
                              value={modalCompanyId} 
                              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setModalCompanyId(e.target.value)}
                              className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:border-emerald-500 focus:outline-none"
                            >
                              <option value="">-- Keine Firma --</option>
                              {companies.filter(c => c.active).map((c) => (
                                <option key={c.id} value={String(c.id)}>{c.company_name} {c.city ? `(${c.city})` : ''}</option>
                              ))}
                            </select>
                            <button 
                              onClick={handleAssignCompany}
                              disabled={assigningCompany}
                              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition disabled:opacity-50 whitespace-nowrap"
                            >
                              {assigningCompany ? "Speichere..." : "Zuweisen"}
                            </button>
                          </div>
                          {selectedLead.company_id && (
                            <p className="text-xs text-slate-400 mt-2">
                              Aktuell: <span className="text-emerald-400">{getCompanyNameById(selectedLead.company_id)}</span>
                            </p>
                          )}
                        </div>

                        <div className="space-y-2 mb-6">
                          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Interne Notizen</label>
                          <textarea value={modalNotes} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setModalNotes(e.target.value)} placeholder="Notizen für das Team..." className="w-full min-h-[100px] px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 focus:border-emerald-500 focus:outline-none transition text-sm text-slate-200 placeholder-slate-500 resize-y" />
                        </div>
                        <button onClick={handleSaveLeadModal} disabled={leadSaving} className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition disabled:opacity-50 mb-8">
                          {leadSaving ? "Speichere..." : "Änderungen speichern"}
                        </button>

                        <div className="border-t border-slate-800 pt-6 space-y-4">
                          <h3 className="text-lg font-semibold text-slate-200">Kundendaten</h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            {[["Kundentyp", selectedLead.customer_type], ["Firma", selectedLead.company_name], ["E-Mail", selectedLead.email], ["Telefon", selectedLead.phone], ["Straße", selectedLead.street], ["Hausnummer", selectedLead.house_number], ["PLZ", selectedLead.zip_code], ["Stadt", selectedLead.city]].map(([l,v],i)=>(
                              <DetailItem key={i} label={l!} value={formatVal(v)} />
                            ))}
                          </div>
                          <h3 className="text-lg font-semibold text-slate-200 mt-6">Objekt & Reinigung</h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            {[["Fläche (m²)", selectedLead.size], ["Räume", selectedLead.rooms], ["Bäder/Toiletten", selectedLead.bathrooms], ["Reinigungsarten", formatServices(selectedLead.services)], ["Sonstiges", selectedLead.other_service], ["Häufigkeit", selectedLead.frequency], ["Mal/Woche", selectedLead.times_per_week], ["Wochentage", parseArray(selectedLead.weekdays).join(", ")]].map(([l,v],i)=>(
                              <DetailItem key={i+10} label={l!} value={formatVal(v)} />
                            ))}
                          </div>
                          <h3 className="text-lg font-semibold text-slate-200 mt-6">Zeitplan & Hinweise</h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <DetailItem label="Erster Tag" value={formatVal(selectedLead.first_date)} />
                            <DetailItem label="Uhrzeiten" value={parseArray(selectedLead.time_slots).join(", ")} />
                            <DetailItem label="Wochenende" value={formatVal(selectedLead.weekend)} />
                            <DetailItem label="Kundentext" value={formatVal(selectedLead.notes)} full />
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* LEFT COLUMN: Summary of priced offers only - NO select button */}
                          <div>
                            <h3 className="text-lg font-semibold text-emerald-400 mb-4">Angebote mit Preis</h3>
                            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                              {quotes.filter(q => q.price != null).length === 0 ? (
                                <p className="text-slate-500 text-sm italic">Noch keine Angebote mit Preis.</p>
                              ) : (
                                quotes.filter(q => q.price != null).map((q) => {
                                  const { commission, companyRevenue } = calculateCommission(q.price)
                                  const isSelected = q.status === "selected"
                                  const isRejected = q.status === "rejected"
                                  return (
                                    <div 
                                      key={q.id} 
                                      className={`p-4 rounded-xl border ${
                                        isSelected 
                                          ? "bg-emerald-900/20 border-emerald-500/50" 
                                          : isRejected 
                                            ? "bg-slate-800/30 border-slate-700 opacity-60" 
                                            : "bg-slate-800/40 border-slate-700"
                                      }`}
                                    >
                                      <div className="flex items-start justify-between gap-2 mb-2">
                                        <p className="font-semibold text-slate-200">{q.company_name}</p>
                                        {isSelected && (
                                          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded">Ausgewählt</span>
                                        )}
                                        {isRejected && (
                                          <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs font-medium rounded">Abgelehnt</span>
                                        )}
                                      </div>
                                      <p className="text-xs text-slate-400">
                                        Status: <span className="capitalize font-medium text-blue-300">{q.status}</span> • {q.price != null ? `${q.price.toFixed(2)} €` : "Kein Preis"}
                                      </p>
                                      {q.price != null && (
                                        <div className="mt-2 text-xs text-slate-300 space-y-1 bg-slate-900/50 p-2 rounded">
                                          <div className="flex justify-between">
                                            <span>Angebotspreis:</span>
                                            <span>{q.price.toFixed(2)} €</span>
                                          </div>
                                          <div className="flex justify-between text-amber-400">
                                            <span>Cleanora Provision (10%):</span>
                                            <span>-{commission.toFixed(2)} €</span>
                                          </div>
                                          <div className="flex justify-between text-emerald-400 font-medium border-t border-slate-700 pt-1">
                                            <span>Auszahlung an Firma:</span>
                                            <span>{companyRevenue.toFixed(2)} €</span>
                                          </div>
                                        </div>
                                      )}
                                      {q.message && <p className="text-xs text-slate-500 mt-2 italic bg-slate-900/50 p-2 rounded">"{q.message}"</p>}
                                    </div>
                                  )
                                })
                              )}
                            </div>
                          </div>

                          {/* RIGHT COLUMN: Full management list */}
                          <div>
                            <h3 className="text-lg font-semibold text-blue-400 mb-4">Anfragen verwalten</h3>
                            {loadingQuotes && <p className="text-slate-500 text-sm">Lade Angebote...</p>}
                            {!loadingQuotes && quotes.length === 0 && <p className="text-slate-500 text-sm">Noch keine Angebote erstellt.</p>}
                            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                              
                              {/* Section 1: Angebote mit Preis */}
                              <div>
                                <h4 className="text-sm font-semibold text-emerald-400 mb-2">Angebote mit Preis</h4>
                                <div className="space-y-3">
                                  {quotes.filter(q => q.price != null).map((q) => {
                                    const { commission, companyRevenue } = calculateCommission(q.price)
                                    const isSelected = q.status === "selected"
                                    const isRejected = q.status === "rejected"
                                    return (
                                      <div 
                                        key={q.id} 
                                        className={`p-4 rounded-xl border ${
                                          isSelected 
                                            ? "bg-emerald-900/20 border-emerald-500/50" 
                                            : isRejected 
                                              ? "bg-slate-800/30 border-slate-700 opacity-60" 
                                              : "bg-slate-800/40 border-slate-700"
                                        }`}
                                      >
                                        {editingQuoteId === q.id ? (
                                          <div className="space-y-2">
                                            <div className="grid grid-cols-2 gap-2">
                                              <input type="number" placeholder="Preis (€)" value={quoteForm.price} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuoteForm({...quoteForm, price: e.target.value})} className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-sm text-slate-200 focus:border-emerald-500 focus:outline-none" />
                                              <select value={quoteForm.status} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setQuoteForm({...quoteForm, status: e.target.value})} className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-sm text-slate-200 focus:border-emerald-500 focus:outline-none">
                                                {QUOTE_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                                              </select>
                                            </div>
                                            <textarea placeholder="Nachricht an Firma..." value={quoteForm.message} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setQuoteForm({...quoteForm, message: e.target.value})} className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-sm text-slate-200 h-16 focus:border-emerald-500 focus:outline-none" />
                                            <div className="flex gap-2 pt-1">
                                              <button onClick={() => handleUpdateQuote(q.id)} className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 rounded text-xs font-medium transition">Speichern</button>
                                              <button onClick={() => setEditingQuoteId(null)} className="px-2 py-1 bg-slate-600 hover:bg-slate-500 rounded text-xs font-medium transition">Abbrechen</button>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="flex justify-between items-start gap-3">
                                            <div className="flex-1">
                                              <div className="flex items-center gap-2 mb-1">
                                                <p className="font-semibold text-slate-200">{q.company_name}</p>
                                                {isSelected && (
                                                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded">Ausgewählt</span>
                                                )}
                                                {isRejected && (
                                                  <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs font-medium rounded">Abgelehnt</span>
                                                )}
                                              </div>
                                              <p className="text-xs text-slate-400">Status: <span className="capitalize font-medium text-blue-300">{q.status}</span> • {q.price != null ? `${q.price.toFixed(2)} €` : "Kein Preis"}</p>
                                              {q.price != null && (
                                                <div className="mt-2 text-xs text-slate-300 space-y-0.5 bg-slate-900/50 p-2 rounded">
                                                  <div className="flex justify-between">
                                                    <span>Angebot:</span>
                                                    <span>{q.price.toFixed(2)} €</span>
                                                  </div>
                                                  <div className="flex justify-between text-amber-400">
                                                    <span>Provision:</span>
                                                    <span>-{commission.toFixed(2)} €</span>
                                                  </div>
                                                  <div className="flex justify-between text-emerald-400 font-medium">
                                                    <span>Auszahlung:</span>
                                                    <span>{companyRevenue.toFixed(2)} €</span>
                                                  </div>
                                                </div>
                                              )}
                                              {q.message && <p className="text-xs text-slate-500 mt-2 italic">"{q.message}"</p>}
                                            </div>
                                            <div className="flex flex-col gap-1 items-end">
                                              <button onClick={() => { setEditingQuoteId(q.id); setQuoteForm({ price: String(q.price || ""), message: q.message || "", status: q.status }); }} className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition whitespace-nowrap">Bearbeiten</button>
                                              {q.status === "pending" && (
                                                <button 
                                                  onClick={() => handleSelectQuoteWinner(q.id)}
                                                  className="text-xs text-cyan-400 hover:text-cyan-300 font-medium transition whitespace-nowrap mt-1"
                                                >
                                                  Angebot auswählen
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>

                              {/* Separator */}
                              <div className="border-t border-slate-700 my-4"></div>

                              {/* Section 2: Wartet auf Angebot */}
                              <div>
                                <h4 className="text-sm font-semibold text-amber-400 mb-2">Wartet auf Angebot</h4>
                                <div className="space-y-3">
                                  {quotes.filter(q => q.price == null).map((q) => {
                                    const isRejected = q.status === "rejected"
                                    return (
                                      <div 
                                        key={q.id} 
                                        className={`p-4 rounded-xl border ${
                                          isRejected 
                                            ? "bg-slate-800/30 border-slate-700 opacity-60" 
                                            : "bg-slate-800/40 border-slate-700"
                                        }`}
                                      >
                                        {editingQuoteId === q.id ? (
                                          <div className="space-y-2">
                                            <div className="grid grid-cols-2 gap-2">
                                              <input type="number" placeholder="Preis (€)" value={quoteForm.price} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuoteForm({...quoteForm, price: e.target.value})} className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-sm text-slate-200 focus:border-emerald-500 focus:outline-none" />
                                              <select value={quoteForm.status} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setQuoteForm({...quoteForm, status: e.target.value})} className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-sm text-slate-200 focus:border-emerald-500 focus:outline-none">
                                                {QUOTE_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                                              </select>
                                            </div>
                                            <textarea placeholder="Nachricht an Firma..." value={quoteForm.message} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setQuoteForm({...quoteForm, message: e.target.value})} className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-sm text-slate-200 h-16 focus:border-emerald-500 focus:outline-none" />
                                            <div className="flex gap-2 pt-1">
                                              <button onClick={() => handleUpdateQuote(q.id)} className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 rounded text-xs font-medium transition">Speichern</button>
                                              <button onClick={() => setEditingQuoteId(null)} className="px-2 py-1 bg-slate-600 hover:bg-slate-500 rounded text-xs font-medium transition">Abbrechen</button>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="flex justify-between items-start gap-3">
                                            <div className="flex-1">
                                              <div className="flex items-center gap-2 mb-1">
                                                <p className="font-semibold text-slate-200">{q.company_name}</p>
                                                {isRejected && (
                                                  <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs font-medium rounded">Abgelehnt</span>
                                                )}
                                              </div>
                                              <p className="text-xs text-slate-400">Status: <span className="capitalize font-medium text-blue-300">{q.status}</span> • Kein Preis</p>
                                              {q.message && <p className="text-xs text-slate-500 mt-2 italic">"{q.message}"</p>}
                                            </div>
                                            <div className="flex flex-col gap-1 items-end">
                                              <button onClick={() => { setEditingQuoteId(q.id); setQuoteForm({ price: String(q.price || ""), message: q.message || "", status: q.status }); }} className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition whitespace-nowrap">Bearbeiten</button>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                  {quotes.filter(q => q.price == null).length === 0 && (
                                    <p className="text-slate-500 text-sm italic">Alle Firmen haben ein Angebot abgegeben.</p>
                                  )}
                                </div>
                              </div>

                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* --- COMPANIES TAB --- */}
        {viewTab === "companies" && (
          <>
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <input
                type="text"
                placeholder="Firmen suchen..."
                value={companySearch}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCompanySearch(e.target.value)}
                className="flex-1 px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:outline-none transition text-sm"
              />
              <button onClick={() => openCompanyModal()} className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold transition whitespace-nowrap">
                + Neue Firma
              </button>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-800/50 text-slate-400 uppercase tracking-wider text-xs">
                    <tr>
                      <th className="px-6 py-4 font-medium">Name</th>
                      <th className="px-6 py-4 font-medium hidden md:table-cell">Kontakt</th>
                      <th className="px-6 py-4 font-medium hidden md:table-cell">Stadt</th>
                      <th className="px-6 py-4 font-medium">Leistungen</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium w-32 text-right">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {loadingCompanies ? (
                      <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">Lade Firmen...</td></tr>
                    ) : filteredCompanies.length === 0 ? (
                      <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">Keine Firmen gefunden.</td></tr>
                    ) : (
                      filteredCompanies.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-800/30 transition">
                          <td className="px-6 py-4 font-medium text-slate-200">{c.company_name}</td>
                          <td className="px-6 py-4 text-slate-400 hidden md:table-cell">{c.contact_person || "-"}<br/><span className="text-xs text-slate-500">{c.email || c.phone}</span></td>
                          <td className="px-6 py-4 text-slate-400 hidden md:table-cell">{c.city || "-"}</td>
                          <td className="px-6 py-4 text-slate-400 max-w-[200px] truncate">{parseArray(c.services).slice(0,3).join(", ")}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${c.active ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-slate-700/30 text-slate-500 border-slate-600/30"}`}>
                              {c.active ? "Aktiv" : "Inaktiv"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right space-x-2">
                            <button onClick={() => openCompanyModal(c)} className="text-blue-400 hover:underline text-xs">Bearbeiten</button>
                            <button onClick={() => toggleCompanyActive(c.id, c.active)} className="text-amber-400 hover:underline text-xs">{c.active ? "Deaktivieren" : "Aktivieren"}</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* COMPANY MODAL */}
            {selectedCompany !== null && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" onClick={(e: React.MouseEvent<HTMLDivElement>) => e.target === e.currentTarget && closeCompanyModal()}>
                <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6">
                  <h2 className="text-xl font-bold mb-4">{selectedCompany?.id ? "Firma bearbeiten" : "Neue Firma"}</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <input placeholder="Firmenname *" value={companyForm.company_name || ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCompanyForm({...companyForm, company_name: e.target.value})} className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 focus:border-emerald-500 focus:outline-none" />
                    <input placeholder="Kontaktperson" value={companyForm.contact_person || ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCompanyForm({...companyForm, contact_person: e.target.value})} className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 focus:border-emerald-500 focus:outline-none" />
                    <input placeholder="E-Mail" type="email" value={companyForm.email || ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCompanyForm({...companyForm, email: e.target.value})} className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 focus:border-emerald-500 focus:outline-none" />
                    <input placeholder="Telefon" value={companyForm.phone || ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCompanyForm({...companyForm, phone: e.target.value})} className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 focus:border-emerald-500 focus:outline-none" />
                    <input placeholder="Stadt" value={companyForm.city || ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCompanyForm({...companyForm, city: e.target.value})} className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 focus:border-emerald-500 focus:outline-none" />
                    <input placeholder="Adresse" value={companyForm.address || ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCompanyForm({...companyForm, address: e.target.value})} className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 focus:border-emerald-500 focus:outline-none" />
                    <input placeholder="Bewertung (0-5)" type="number" min="0" max="5" step="0.1" value={companyForm.rating || ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCompanyForm({...companyForm, rating: parseFloat(e.target.value) || 0})} className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 focus:border-emerald-500 focus:outline-none" />
                    <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700">
                      <input type="checkbox" checked={companyForm.active ?? true} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCompanyForm({...companyForm, active: e.target.checked})} className="w-4 h-4 accent-emerald-500" />
                      <span className="text-sm text-slate-300">Aktiv</span>
                    </div>
                  </div>
                  <textarea placeholder="Leistungen (Komma-getrennt)" value={parseArray(companyForm.services).join(", ")} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCompanyForm({...companyForm, services: e.target.value})} className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 focus:border-emerald-500 focus:outline-none mb-4 h-16" />
                  <textarea placeholder="Interne Notizen" value={companyForm.notes || ""} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCompanyForm({...companyForm, notes: e.target.value})} className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 focus:border-emerald-500 focus:outline-none mb-4 h-16" />
                  
                  <div className="flex justify-end gap-3">
                    <button onClick={closeCompanyModal} className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-medium transition">Abbrechen</button>
                    <button onClick={saveCompany} disabled={savingCompany || !companyForm.company_name} className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition disabled:opacity-50">
                      {savingCompany ? "Speichere..." : "Speichern"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// Sub-components
function StatusBadge({ status, archived }: { status: string; archived: boolean }): JSX.Element {
  const colors: Record<string, string> = {
    new: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    contacted: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    quote_sent: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    cancelled: "bg-red-500/10 text-red-400 border-red-500/30",
    selected: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    rejected: "bg-red-500/10 text-red-400 border-red-500/30",
  }
  const colorClass = colors[status] || "bg-slate-500/10 text-slate-400 border-slate-500/30"
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClass} ${archived ? "opacity-60" : ""}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function DetailItem({ label, value, full }: { label: string; value: string; full?: boolean }): JSX.Element {
  return (
    <div className={`space-y-1 ${full ? "md:col-span-3" : ""}`}>
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</span>
      <p className="text-sm text-slate-200 bg-slate-800/40 rounded-lg px-3 py-2 border border-slate-700/30 break-words whitespace-pre-wrap">
        {value}
      </p>
    </div>
  )
}