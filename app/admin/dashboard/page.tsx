// app/admin/dashboard/page.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Lead, Quote } from '@/lib/types/marketplace'

interface Stats {
  totalLeads: number
  pendingLeads: number
  offersWaiting: number
  acceptedOffers: number
  rejectedOffers: number
  activeCompanies: number
  revenue: number
  todaysLeads: number
  weeklyLeads: number
  monthlyLeads: number
}

interface ActivityRow {
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
  user_id?: string | null
  admin_id?: string | null
  actor_name?: string | null
}

export default function AdminDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats>({
    totalLeads: 0,
    pendingLeads: 0,
    offersWaiting: 0,
    acceptedOffers: 0,
    rejectedOffers: 0,
    activeCompanies: 0,
    revenue: 0,
    todaysLeads: 0,
    weeklyLeads: 0,
    monthlyLeads: 0,
  })
  const [recentLeads, setRecentLeads] = useState<Lead[]>([])
  const [recentQuotes, setRecentQuotes] = useState<Quote[]>([])
  const [latestActivity, setLatestActivity] = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.replace('/login')
          return
        }

        const [leadsRes, quotesRes] = await Promise.all([
          supabase.from('leads').select('id, status, created_at', { count: 'exact' }),
          supabase.from('quotes').select('id, price, status', { count: 'exact' }),
        ])

        if (leadsRes.error) throw leadsRes.error
        if (quotesRes.error) throw quotesRes.error

        const companiesPrimary = await supabase
          .from('cleaning_companies')
          .select('id', { count: 'exact', head: true })
          .eq('active', true)

        let activeCompanies = companiesPrimary.count || 0
        if (companiesPrimary.error) {
          const companiesFallback = await supabase
            .from('companies')
            .select('id', { count: 'exact', head: true })
            .eq('active', true)

          if (companiesFallback.error) throw companiesFallback.error
          activeCompanies = companiesFallback.count || 0
        }

        const leads = (leadsRes.data || []) as Array<{ status?: string | null; created_at?: string | null }>
        const quotes = (quotesRes.data || []) as Array<{ status?: string | null; price?: number | null }>

        const now = new Date()
        const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const startWeek = new Date(startToday)
        startWeek.setDate(startWeek.getDate() - 6)
        const startMonth = new Date(startToday)
        startMonth.setDate(startMonth.getDate() - 29)

        const totalLeads = leadsRes.count || 0
        const pendingLeads = leads.filter((lead) => lead.status === 'new').length
        const offersWaiting = quotes.filter((quote) => quote.status === 'pending').length
        const acceptedOffers = quotes.filter((quote) => quote.status === 'accepted').length
        const rejectedOffers = quotes.filter((quote) => quote.status === 'rejected').length

        const revenue = quotes
          .filter((quote) => quote.status === 'accepted' && typeof quote.price === 'number')
          .reduce((sum, quote) => sum + (quote.price || 0), 0)

        const todaysLeads = leads.filter((lead) => {
          if (!lead.created_at) return false
          const date = new Date(lead.created_at)
          return !Number.isNaN(date.getTime()) && date >= startToday
        }).length

        const weeklyLeads = leads.filter((lead) => {
          if (!lead.created_at) return false
          const date = new Date(lead.created_at)
          return !Number.isNaN(date.getTime()) && date >= startWeek
        }).length

        const monthlyLeads = leads.filter((lead) => {
          if (!lead.created_at) return false
          const date = new Date(lead.created_at)
          return !Number.isNaN(date.getTime()) && date >= startMonth
        }).length

        setStats({
          totalLeads,
          pendingLeads,
          offersWaiting,
          acceptedOffers,
          rejectedOffers,
          activeCompanies,
          revenue,
          todaysLeads,
          weeklyLeads,
          monthlyLeads,
        })

        const [leadsData, quotesData] = await Promise.all([
          supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(10),
          supabase.from('quotes').select('*').order('created_at', { ascending: false }).limit(10),
        ])

        if (leadsData.error) throw leadsData.error
        if (quotesData.error) throw quotesData.error

        // Keep dashboard usable across both supported company tables.
        const companiesListPrimary = await supabase
          .from('cleaning_companies')
          .select('id, company_name')
          .order('company_name', { ascending: true })

        let companyRows = companiesListPrimary.data || []

        if (companiesListPrimary.error) {
          const companiesFallback = await supabase
            .from('companies')
            .select('id, company_name')
            .order('company_name', { ascending: true })

          if (!companiesFallback.error) {
            companyRows = companiesFallback.data || []
          }
        }

        const companyMap = new Map(companyRows.map((company: any) => [company.id, company.company_name]))
        const recentQuotesWithCompany = (quotesData.data || []).map((quote: any) => ({
          ...quote,
          company: companyMap.has(quote.company_id) ? { company_name: companyMap.get(quote.company_id) } : null,
        }))

        let activityRows: ActivityRow[] = []
        const activityPrimary = await supabase
          .from('lead_activity')
          .select('id, action, type, title, message, description, created_at, lead_id, company_id, quote_id, user_id, admin_id, actor_name')
          .order('created_at', { ascending: false })
          .limit(10)

        if (!activityPrimary.error) {
          activityRows = (activityPrimary.data || []) as ActivityRow[]
        } else {
          const activityFallback = await supabase
            .from('lead_activity')
            .select('id, action, created_at, lead_id, company_id, quote_id, user_id, admin_id')
            .order('created_at', { ascending: false })
            .limit(10)

          if (!activityFallback.error) {
            activityRows = (activityFallback.data || []) as ActivityRow[]
          }
        }

        setRecentLeads(leadsData.data || [])
        setRecentQuotes(recentQuotesWithCompany)
        setLatestActivity(activityRows)
      } catch (err: unknown) {
        const e = err as Error
        setError(e.message || 'Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [router])

  if (loading) {
    return (
      <div role="status" aria-live="polite" className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-cyan-500 border-t-transparent" />
          <p className="text-sm text-slate-400">Dashboard wird geladen…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center shadow-lg shadow-red-950/20">
          <p role="alert" className="text-red-400 mb-4">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition"
          >
            Erneut versuchen
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="rounded-2xl border border-slate-800/50 bg-slate-900/60 p-6 shadow-lg shadow-black/10 backdrop-blur-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight bg-gradient-to-r from-cyan-400 via-emerald-400 to-violet-500 bg-clip-text text-transparent">
                Admin Dashboard
              </h1>
              <p className="text-slate-400 mt-2">Übersicht über den Marktplatz</p>
            </div>
            <div className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-300">
              Live Übersicht
            </div>
          </div>
        </header>

        {/* Quick Navigation */}
        <nav className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { label: 'Leads', href: '/admin/leads' },
            { label: 'Companies', href: '/admin/companies' },
            { label: 'Notifications', href: '/admin/notifications' },
            { label: 'Activity Log', href: '/admin/activity' },
            { label: 'Analytics', href: '/admin/analytics' },
            { label: 'Search', href: '/admin/search' },
            { label: 'Settings', href: '/admin/settings' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl border border-slate-800/50 bg-slate-900/60 px-4 py-3 text-sm font-medium text-slate-300 transition hover:border-emerald-500/30 hover:bg-slate-800/60 hover:text-emerald-300 text-center"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: 'Total Leads', value: stats.totalLeads, color: 'from-slate-600 to-slate-700' },
            { label: 'Pending Leads', value: stats.pendingLeads, color: 'from-amber-500 to-amber-600' },
            { label: 'Offers Waiting', value: stats.offersWaiting, color: 'from-cyan-500 to-cyan-600' },
            { label: 'Accepted Offers', value: stats.acceptedOffers, color: 'from-emerald-500 to-emerald-600' },
            { label: 'Rejected Offers', value: stats.rejectedOffers, color: 'from-red-500 to-red-600' },
            { label: 'Active Companies', value: stats.activeCompanies, color: 'from-blue-500 to-blue-600' },
            { label: 'Revenue', value: `${stats.revenue.toFixed(0)}€`, color: 'from-violet-500 to-violet-600' },
            { label: "Today's Leads", value: stats.todaysLeads, color: 'from-teal-500 to-teal-600' },
            { label: 'Weekly Leads', value: stats.weeklyLeads, color: 'from-indigo-500 to-indigo-600' },
            { label: 'Monthly Leads', value: stats.monthlyLeads, color: 'from-fuchsia-500 to-fuchsia-600' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/70 to-slate-900/30 p-5 shadow-lg shadow-black/10 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{stat.label}</p>
              <p className={`mt-2 text-2xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Latest Activity */}
        <section className="rounded-2xl border border-slate-800/50 bg-slate-900/60 p-6 shadow-lg shadow-black/10 backdrop-blur-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-100">Latest Activity</h3>
              <p className="text-sm text-slate-400">Zuletzt gespeicherte Marketplace-Ereignisse</p>
            </div>
            <div className="rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1 text-xs text-slate-300">
              {latestActivity.length} Einträge
            </div>
          </div>

          <div className="space-y-3">
            {latestActivity.map((activity) => (
              <div key={activity.id} className="rounded-xl border border-slate-800/60 bg-slate-950/40 px-4 py-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-200">{formatActivityTitle(activity)}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">{formatActivityMeta(activity)}</p>
                  </div>
                  <p className="shrink-0 text-xs text-slate-500">{formatDateTime(activity.created_at)}</p>
                </div>
              </div>
            ))}

            {latestActivity.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-500">
                Keine Aktivität vorhanden.
              </p>
            )}
          </div>
        </section>

        {/* Recent Leads & Quotes */}
        <div className="grid gap-6 xl:grid-cols-2">
          {/* Recent Leads */}
          <section className="rounded-2xl border border-slate-800/50 bg-slate-900/60 p-6 shadow-lg shadow-black/10 backdrop-blur-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">Neueste Anfragen</h3>
                <p className="text-sm text-slate-400">Die zuletzt eingegangenen Kundenanfragen</p>
              </div>
              <div className="rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1 text-xs text-slate-300">
                {recentLeads.length} Einträge
              </div>
            </div>
            <div className="space-y-3">
              {recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between rounded-xl border border-slate-800/60 bg-slate-950/40 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-200">{lead.full_name}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">{lead.city} • {lead.service_type}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${leadStatusClass(lead.status)}`}>
                    {lead.status}
                  </span>
                </div>
              ))}
              {recentLeads.length === 0 && <p className="rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-500">Keine Anfragen vorhanden.</p>}
            </div>
          </section>

          {/* Recent Quotes */}
          <section className="rounded-2xl border border-slate-800/50 bg-slate-900/60 p-6 shadow-lg shadow-black/10 backdrop-blur-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">Neueste Angebote</h3>
                <p className="text-sm text-slate-400">Aktuelle Angebote und Statusübersicht</p>
              </div>
              <div className="rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1 text-xs text-slate-300">
                {recentQuotes.length} Einträge
              </div>
            </div>
            <div className="space-y-3">
              {recentQuotes.map((quote: any) => (
                <div key={quote.id} className="flex items-center justify-between rounded-xl border border-slate-800/60 bg-slate-950/40 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-200">{quote.company?.company_name || 'Unbekannte Firma'}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">Lead #{quote.lead_id || 'Unbekannt'}</p>
                  </div>
                  <div className="ml-3 shrink-0 text-right">
                    <p className="font-semibold text-emerald-400">
                      {typeof quote.price === 'number' ? `${quote.price.toFixed(2)} €` : '—'}
                    </p>
                    <span className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${quoteStatusClass(quote.status)}`}>
                      {quote.status}
                    </span>
                  </div>
                </div>
              ))}
              {recentQuotes.length === 0 && <p className="rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-500">Keine Angebote vorhanden.</p>}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function formatDateTime(value: string | null | undefined): string {
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

function formatActivityTitle(activity: ActivityRow): string {
  return activity.title || activity.message || activity.description || activity.action || activity.type || 'Unbenannte Aktivität'
}

function formatActivityMeta(activity: ActivityRow): string {
  const actor = activity.actor_name || activity.admin_id || activity.user_id || '-'
  const type = String(activity.type || activity.action || 'unknown')
  const lead = activity.lead_id ? `Lead #${activity.lead_id}` : null
  const company = activity.company_id != null && activity.company_id !== '' ? `Company #${String(activity.company_id)}` : null
  const quote = activity.quote_id ? `Quote #${activity.quote_id}` : null

  return [type, actor, lead, company, quote].filter(Boolean).join(' • ')
}

function leadStatusClass(status: string | null | undefined): string {
  if (status === 'new') return 'border-slate-500/30 bg-slate-500/10 text-slate-300'
  if (status === 'matched') return 'border-blue-500/30 bg-blue-500/10 text-blue-300'
  if (status === 'booked') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
  return 'border-slate-600/30 bg-slate-700/40 text-slate-400'
}

function quoteStatusClass(status: string | null | undefined): string {
  if (status === 'pending') return 'border-amber-500/30 bg-amber-500/10 text-amber-300'
  if (status === 'accepted') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
  if (status === 'selected') return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
  if (status === 'offered') return 'border-blue-500/30 bg-blue-500/10 text-blue-300'
  if (status === 'rejected') return 'border-red-500/30 bg-red-500/10 text-red-300'
  return 'border-slate-600/30 bg-slate-700/40 text-slate-400'
}