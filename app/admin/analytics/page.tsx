'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type LeadLite = {
  id: string
  created_at: string | null
}

type QuoteLite = {
  id: string
  lead_id: string | null
  status: string | null
  price?: number | null
  proposed_price?: number | null
  created_at: string | null
}

type MetricCard = {
  label: string
  value: string
  hasData: boolean
}

export default function AdminAnalyticsPage(): JSX.Element | null {
  const router = useRouter()

  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [leads, setLeads] = useState<LeadLite[]>([])
  const [quotes, setQuotes] = useState<QuoteLite[]>([])

  useEffect(() => {
    const load = async (): Promise<void> => {
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

        setIsAuthenticated(true)

        const [leadsRes, quotesRes] = await Promise.all([
          supabase.from('leads').select('id, created_at').order('created_at', { ascending: false }),
          supabase.from('quotes').select('id, lead_id, status, price, proposed_price, created_at').order('created_at', { ascending: false }),
        ])

        if (leadsRes.error) throw leadsRes.error

        if (quotesRes.error) {
          // Fallback for deployments without proposed_price.
          const quotesFallback = await supabase
            .from('quotes')
            .select('id, lead_id, status, price, created_at')
            .order('created_at', { ascending: false })

          if (quotesFallback.error) throw quotesFallback.error
          setQuotes((quotesFallback.data || []) as QuoteLite[])
        } else {
          setQuotes((quotesRes.data || []) as QuoteLite[])
        }

        setLeads((leadsRes.data || []) as LeadLite[])
      } catch (err: any) {
        setError(err.message || 'Analytics konnten nicht geladen werden.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [router])

  const metrics = useMemo(() => {
    const now = new Date()
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startWeek = new Date(startToday)
    startWeek.setDate(startWeek.getDate() - 6)
    const startMonth = new Date(startToday)
    startMonth.setDate(startMonth.getDate() - 29)

    const leadsWithDate = leads
      .map((lead) => ({ ...lead, date: lead.created_at ? new Date(lead.created_at) : null }))
      .filter((lead) => lead.date && !Number.isNaN(lead.date.getTime())) as Array<LeadLite & { date: Date }>

    const dailyLeads = leadsWithDate.filter((lead) => lead.date >= startToday).length
    const weeklyLeads = leadsWithDate.filter((lead) => lead.date >= startWeek).length
    const monthlyLeads = leadsWithDate.filter((lead) => lead.date >= startMonth).length

    const acceptedQuotes = quotes.filter((quote) => quote.status === 'accepted')
    const revenueValues = acceptedQuotes
      .map((quote) => extractQuotePrice(quote))
      .filter((price): price is number => typeof price === 'number')

    const revenue = revenueValues.length > 0 ? revenueValues.reduce((sum, value) => sum + value, 0) : null

    const allOfferPrices = quotes
      .map((quote) => extractQuotePrice(quote))
      .filter((price): price is number => typeof price === 'number')

    const averageOfferPrice =
      allOfferPrices.length > 0
        ? allOfferPrices.reduce((sum, value) => sum + value, 0) / allOfferPrices.length
        : null

    const acceptanceRate =
      quotes.length > 0
        ? (acceptedQuotes.length / quotes.length) * 100
        : null

    const leadById = new Map<string, Date>()
    for (const lead of leadsWithDate) {
      leadById.set(lead.id, lead.date)
    }

    const firstQuoteByLead = new Map<string, Date>()
    for (const quote of quotes) {
      if (!quote.lead_id || !quote.created_at) continue
      const quoteDate = new Date(quote.created_at)
      if (Number.isNaN(quoteDate.getTime())) continue

      const current = firstQuoteByLead.get(quote.lead_id)
      if (!current || quoteDate < current) {
        firstQuoteByLead.set(quote.lead_id, quoteDate)
      }
    }

    const responseTimesHours: number[] = []
    firstQuoteByLead.forEach((firstQuoteAt, leadId) => {
      const leadCreatedAt = leadById.get(leadId)
      if (!leadCreatedAt) return
      const diffMs = firstQuoteAt.getTime() - leadCreatedAt.getTime()
      if (diffMs < 0) return
      responseTimesHours.push(diffMs / (1000 * 60 * 60))
    })

    const averageResponseHours =
      responseTimesHours.length > 0
        ? responseTimesHours.reduce((sum, value) => sum + value, 0) / responseTimesHours.length
        : null

    const conversionRate =
      leads.length > 0
        ? (new Set(acceptedQuotes.map((quote) => quote.lead_id).filter(Boolean)).size / leads.length) * 100
        : null

    return {
      dailyLeads,
      weeklyLeads,
      monthlyLeads,
      revenue,
      conversionRate,
      averageResponseHours,
      averageOfferPrice,
      acceptanceRate,
    }
  }, [leads, quotes])

  const cards = useMemo<MetricCard[]>(() => {
    return [
      { label: 'Daily Leads', value: String(metrics.dailyLeads), hasData: true },
      { label: 'Weekly Leads', value: String(metrics.weeklyLeads), hasData: true },
      { label: 'Monthly Leads', value: String(metrics.monthlyLeads), hasData: true },
      { label: 'Revenue', value: metrics.revenue == null ? 'No data' : `${metrics.revenue.toFixed(2)} EUR`, hasData: metrics.revenue != null },
      {
        label: 'Conversion',
        value: metrics.conversionRate == null ? 'No data' : `${metrics.conversionRate.toFixed(1)}%`,
        hasData: metrics.conversionRate != null,
      },
      {
        label: 'Average Response Time',
        value: metrics.averageResponseHours == null ? 'No data' : `${metrics.averageResponseHours.toFixed(1)} h`,
        hasData: metrics.averageResponseHours != null,
      },
      {
        label: 'Average Offer Price',
        value: metrics.averageOfferPrice == null ? 'No data' : `${metrics.averageOfferPrice.toFixed(2)} EUR`,
        hasData: metrics.averageOfferPrice != null,
      },
      {
        label: 'Acceptance Rate',
        value: metrics.acceptanceRate == null ? 'No data' : `${metrics.acceptanceRate.toFixed(1)}%`,
        hasData: metrics.acceptanceRate != null,
      },
    ]
  }, [metrics])

  if (isAuthenticated === null) return null

  if (loading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
          <p className="text-sm text-slate-400">Analytics werden geladen...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center shadow-lg shadow-red-950/20">
          <p className="mb-4 text-red-400">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 transition hover:bg-slate-700"
          >
            Erneut versuchen
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black p-4 text-slate-100 md:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="rounded-2xl border border-slate-800/50 bg-slate-900/60 p-6 shadow-lg shadow-black/10 backdrop-blur-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="bg-gradient-to-r from-cyan-400 via-emerald-400 to-violet-500 bg-clip-text text-3xl font-black tracking-tight text-transparent md:text-4xl">
                Admin Analytics
              </h1>
              <p className="mt-2 text-slate-400">Kennzahlen aus vorhandenen Leads- und Angebotsdaten</p>
            </div>
            <Link
              href="/admin/dashboard"
              className="inline-flex items-center rounded-full border border-slate-700 bg-slate-800/80 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-700"
            >
              Zurueck zum Dashboard
            </Link>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <div key={card.label} className="rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/70 to-slate-900/30 p-5 shadow-lg shadow-black/10 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{card.label}</p>
              <p className={`mt-2 text-2xl font-bold ${card.hasData ? 'text-slate-100' : 'text-slate-500'}`}>{card.value}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-800/50 bg-slate-900/60 p-6 shadow-lg shadow-black/10 backdrop-blur-sm">
          <h3 className="text-lg font-semibold text-slate-100">Hinweis</h3>
          <p className="mt-2 text-sm text-slate-400">
            Metriken werden nur angezeigt, wenn sie aus vorhandenen Daten berechnet werden koennen. Fehlende Werte bleiben bewusst als No data markiert.
          </p>
        </section>
      </div>
    </div>
  )
}

function extractQuotePrice(quote: QuoteLite): number | null {
  if (typeof quote.price === 'number') return quote.price
  if (typeof quote.proposed_price === 'number') return quote.proposed_price
  return null
}
