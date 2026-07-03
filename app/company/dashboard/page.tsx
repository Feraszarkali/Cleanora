'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabaseClient'
import {
  ActivityRow,
  CompanyRow,
  LeadRow,
  NotificationRow,
  QuoteRow,
  estimateDuration,
  formatDate,
  formatDateTime,
  formatMoney,
  formatStatus,
  getLeadAddress,
  pickServiceList,
  quotePrice,
} from '../../../lib/companyPortal'

type DashboardLead = {
  id: string
  latestQuote: QuoteRow
  lead: LeadRow
}

function statusBadgeClass(status: string): string {
  if (status === 'accepted' || status === 'selected') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
  if (status === 'rejected' || status === 'expired') return 'border-red-500/30 bg-red-500/10 text-red-300'
  if (status === 'pending') return 'border-amber-500/30 bg-amber-500/10 text-amber-300'
  if (status === 'submitted') return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
  return 'border-slate-700 bg-slate-800/60 text-slate-300'
}

function notificationTone(type: string | null | undefined): string {
  const key = String(type || '').toLowerCase()
  if (key.includes('quote') || key.includes('lead')) return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
  if (key.includes('accepted') || key.includes('selected')) return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
  if (key.includes('rejected')) return 'border-red-500/30 bg-red-500/10 text-red-300'
  return 'border-slate-700 bg-slate-800/60 text-slate-300'
}

function getNotificationLabel(type: string | null | undefined): string {
  const key = String(type || '').toLowerCase()
  if (key === 'quote_created') return 'Quote submitted'
  if (key === 'quote_accepted') return 'Quote accepted'
  if (key === 'quote_rejected') return 'Quote rejected'
  if (key === 'booking_confirmed') return 'Booking confirmed'
  return formatStatus(type)
}

export default function CompanyDashboardPage(): JSX.Element {
  const router = useRouter()

  const [company, setCompany] = useState<CompanyRow | null>(null)
  const [companyId, setCompanyId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [quotes, setQuotes] = useState<QuoteRow[]>([])
  const [activities, setActivities] = useState<ActivityRow[]>([])
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [signingOut, setSigningOut] = useState(false)

  const resolveCompany = useCallback(async (): Promise<{ company: CompanyRow; companyId: number; userId: string } | null> => {
    const { data: userResult } = await supabase.auth.getUser()
    const user = userResult.user
    if (!user?.email) return null

    const { data: companyData, error: companyError } = await supabase
      .from('cleaning_companies')
      .select('id, company_name, contact_person, email, phone, city, active')
      .eq('email', user.email.toLowerCase())
      .eq('active', true)
      .maybeSingle<CompanyRow>()

    if (companyError || !companyData) return null

    return { company: companyData, companyId: Number(companyData.id), userId: user.id }
  }, [])

  const fetchDashboard = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)

    try {
      const resolved = await resolveCompany()
      if (!resolved) {
        router.replace('/company/login')
        return
      }

      const { company: resolvedCompany, companyId: resolvedCompanyId, userId } = resolved
      setCompany(resolvedCompany)
      setCompanyId(resolvedCompanyId)
      localStorage.setItem('company_id', String(resolvedCompanyId))

      const quotesQuery = await supabase
        .from('quotes')
        .select(`
          id,
          lead_id,
          company_id,
          price,
          final_price,
          proposed_price,
          message,
          status,
          created_at,
          updated_at,
          lead:leads(
            id,
            full_name,
            email,
            phone,
            city,
            address,
            street,
            house_number,
            zip_code,
            service_type,
            services,
            notes,
            preferred_date,
            preferred_time,
            first_date,
            time_slots,
            status,
            created_at,
            photos,
            photo_urls,
            images,
            files,
            attachments,
            uploaded_files
          )
        `)
        .eq('company_id', resolvedCompanyId)
        .order('created_at', { ascending: false })

      if (quotesQuery.error) throw quotesQuery.error

      const parsedQuotes = ((quotesQuery.data || []) as Array<QuoteRow & { lead?: LeadRow | LeadRow[] | null }>)
        .map((quote) => ({
          ...quote,
          lead: Array.isArray(quote.lead) ? quote.lead[0] || null : quote.lead || null,
        }))
        .filter((quote) => quote.lead !== null)

      setQuotes(parsedQuotes as QuoteRow[])

      const activityQuery = await supabase
        .from('lead_activity')
        .select('id, title, message, description, action, type, created_at, lead_id, company_id, quote_id, metadata')
        .eq('company_id', resolvedCompanyId)
        .order('created_at', { ascending: false })
        .limit(10)

      if (!activityQuery.error) {
        setActivities((activityQuery.data || []) as ActivityRow[])
      } else {
        setActivities([])
      }

      const notificationQuery = await supabase
        .from('notifications')
        .select('id, user_id, title, message, type, read, created_at, lead_id, company_id, entity_id, entity_type')
        .eq('company_id', resolvedCompanyId)
        .order('created_at', { ascending: false })
        .limit(10)

      if (!notificationQuery.error && (notificationQuery.data || []).length > 0) {
        setNotifications((notificationQuery.data || []) as NotificationRow[])
      } else {
        const fallback = await supabase
          .from('notifications')
          .select('id, user_id, title, message, type, read, created_at, lead_id, company_id, entity_id, entity_type')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(10)

        if (!fallback.error) {
          setNotifications((fallback.data || []) as NotificationRow[])
        } else {
          const combined = [...parsedQuotes.slice(0, 5)].map((quote) => ({
            id: quote.id,
            user_id: userId,
            title: quote.status === 'accepted' || quote.status === 'selected' ? 'Quote won' : 'Quote updated',
            message: `${quote.lead?.full_name || 'Lead'} • ${formatMoney(quotePrice(quote))}`,
            type: quote.status,
            read: false,
            created_at: quote.created_at,
            lead_id: quote.lead_id,
            company_id: resolvedCompanyId,
            entity_id: quote.lead_id,
            entity_type: 'lead',
          })) satisfies NotificationRow[]
          setNotifications(combined)
        }
      }
    } catch (err: unknown) {
      const e = err as Error
      setError(e.message || 'Dashboard konnte nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }, [resolveCompany, router])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  const handleLogout = useCallback(async (): Promise<void> => {
    setSigningOut(true)
    try {
      localStorage.removeItem('company_id')
      await supabase.auth.signOut()
      router.replace('/company/login')
    } finally {
      setSigningOut(false)
    }
  }, [router])

  const leadCards = useMemo<DashboardLead[]>(() => {
    const map = new Map<string, DashboardLead>()

    for (const quote of quotes) {
      if (!quote.lead) continue
      const existing = map.get(quote.lead_id)
      if (!existing || new Date(quote.created_at).getTime() > new Date(existing.latestQuote.created_at).getTime()) {
        map.set(quote.lead_id, {
          id: quote.lead_id,
          latestQuote: quote,
          lead: quote.lead,
        })
      }
    }

    return Array.from(map.values()).sort((left, right) => new Date(right.latestQuote.created_at).getTime() - new Date(left.latestQuote.created_at).getTime())
  }, [quotes])

  const stats = useMemo(() => {
    const active = leadCards.filter((item) => item.latestQuote.status === 'pending').length
    const won = leadCards.filter((item) => item.latestQuote.status === 'accepted' || item.latestQuote.status === 'selected').length
    const lost = leadCards.filter((item) => item.latestQuote.status === 'rejected' || item.latestQuote.status === 'expired').length
    const revenue = leadCards
      .filter((item) => item.latestQuote.status === 'accepted' || item.latestQuote.status === 'selected')
      .reduce((sum, item) => sum + (quotePrice(item.latestQuote) || 0), 0)

    return {
      total: leadCards.length,
      active,
      won,
      lost,
      revenue,
      notifications: notifications.length,
    }
  }, [leadCards, notifications.length])

  if (loading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-100 flex items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
      </div>
    )
  }

  if (error || !company || companyId == null) {
    return (
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
          <p className="text-red-300">{error || 'Firmenkonto nicht gefunden.'}</p>
          <Link href="/company/login" className="mt-4 inline-flex rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700">
            Zum Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black p-4 text-slate-100 md:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="rounded-2xl border border-slate-800/50 bg-slate-900/60 p-6 shadow-lg shadow-black/10 backdrop-blur-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Company Dashboard</p>
              <h1 className="mt-1 bg-gradient-to-r from-cyan-400 via-emerald-400 to-violet-500 bg-clip-text text-3xl font-black tracking-tight text-transparent md:text-4xl">
                {company.company_name || 'Company Portal'}
              </h1>
              <p className="mt-2 text-slate-400">Authenticated portal for {company.email}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                {company.city || 'Active'}
              </span>
              <button
                type="button"
                onClick={fetchDashboard}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-500"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={handleLogout}
                disabled={signingOut}
                className="rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-700 disabled:opacity-60"
              >
                {signingOut ? 'Signing out...' : 'Logout'}
              </button>
            </div>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <StatCard label="Active leads" value={String(stats.active)} tone="cyan" />
          <StatCard label="Won leads" value={String(stats.won)} tone="emerald" />
          <StatCard label="Lost leads" value={String(stats.lost)} tone="rose" />
          <StatCard label="Revenue" value={formatMoney(stats.revenue)} tone="violet" />
          <StatCard label="Notifications" value={String(stats.notifications)} tone="amber" />
          <StatCard label="Total leads" value={String(stats.total)} tone="slate" />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
          <article className="rounded-2xl border border-slate-800/50 bg-slate-900/60 p-5 shadow-lg shadow-black/10 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Assigned Leads</h2>
                <p className="mt-1 text-sm text-slate-400">Only leads assigned to this company are shown here.</p>
              </div>
              <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-300">{leadCards.length} items</span>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              {leadCards.length === 0 ? (
                <p className="rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-8 text-sm text-slate-500 xl:col-span-2">No assigned leads yet.</p>
              ) : (
                leadCards.map((item) => {
                  const services = pickServiceList(item.lead)
                  const price = quotePrice(item.latestQuote)
                  const duration = estimateDuration(item.latestQuote, Math.max(1, services.length))
                  const isWon = item.latestQuote.status === 'accepted' || item.latestQuote.status === 'selected'
                  const isLost = item.latestQuote.status === 'rejected' || item.latestQuote.status === 'expired'
                  const isActive = item.latestQuote.status === 'pending'

                  return (
                    <article key={item.id} className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 transition hover:border-cyan-500/30">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-semibold text-slate-100">{item.lead.full_name || 'Unnamed lead'}</h3>
                          <p className="mt-1 text-xs text-slate-500">{item.lead.city || '-'} • {formatDateTime(item.latestQuote.created_at)}</p>
                        </div>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadgeClass(item.latestQuote.status)}`}>
                          {item.latestQuote.status === 'pending' ? 'Submitted' : formatStatus(item.latestQuote.status)}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                        <p><span className="text-slate-500">Email:</span> {item.lead.email || '-'}</p>
                        <p><span className="text-slate-500">Phone:</span> {item.lead.phone || '-'}</p>
                        <p className="sm:col-span-2"><span className="text-slate-500">Service:</span> {services.length > 0 ? services.join(', ') : '-'}</p>
                        <p className="sm:col-span-2"><span className="text-slate-500">Address:</span> {getLeadAddress(item.lead) || '-'}</p>
                      </div>

                      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-400">Price</span>
                          <span className="font-semibold text-emerald-300">{price != null ? formatMoney(price) : '-'}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3 text-slate-300">
                          <span>Duration</span>
                          <span>{duration}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3 text-slate-300">
                          <span>Message</span>
                          <span className="max-w-[70%] truncate text-right">{item.latestQuote.message || 'No message yet'}</span>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {isActive && <Pill tone="amber" text="Active" />}
                        {isWon && <Pill tone="emerald" text="Won" />}
                        {isLost && <Pill tone="rose" text="Lost" />}
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <p className="text-xs text-slate-500">Created {formatDate(item.lead.created_at)}</p>
                        <Link
                          href={`/company/leads/${item.lead.id}`}
                          className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-300 transition hover:bg-cyan-500/20"
                        >
                          View lead
                        </Link>
                      </div>
                    </article>
                  )
                })
              )}
            </div>
          </article>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-slate-800/50 bg-slate-900/60 p-5 shadow-lg shadow-black/10 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-100">Notifications</h2>
                <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-300">{notifications.length}</span>
              </div>
              <div className="mt-4 space-y-3">
                {notifications.length === 0 ? (
                  <p className="rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-6 text-sm text-slate-500">No notifications yet.</p>
                ) : (
                  notifications.map((notification) => (
                    <div key={notification.id} className={`rounded-xl border p-3 text-sm ${notificationTone(notification.type)}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{notification.title || getNotificationLabel(notification.type)}</p>
                          <p className="mt-1 text-xs opacity-80">{notification.message || '-'}</p>
                        </div>
                        <span className="text-[11px] opacity-70">{formatDateTime(notification.created_at)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800/50 bg-slate-900/60 p-5 shadow-lg shadow-black/10 backdrop-blur-sm">
              <h2 className="text-lg font-semibold text-slate-100">Lead Activity</h2>
              <div className="mt-4 space-y-3">
                {activities.length === 0 ? (
                  <p className="rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-6 text-sm text-slate-500">No activity history available.</p>
                ) : (
                  activities.map((activity) => (
                    <div key={activity.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-sm text-slate-300">
                      <p className="font-medium text-slate-100">{activity.title || activity.message || activity.description || activity.action || activity.type || 'Activity event'}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatDateTime(activity.created_at)}</p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </div>
  )
}

function StatCard({ label, value, tone }: { label: string; value: string; tone: 'cyan' | 'emerald' | 'rose' | 'violet' | 'amber' | 'slate' }) {
  const tones = {
    cyan: 'from-cyan-500 to-blue-600',
    emerald: 'from-emerald-500 to-teal-500',
    rose: 'from-rose-500 to-red-500',
    violet: 'from-violet-500 to-fuchsia-500',
    amber: 'from-amber-500 to-orange-500',
    slate: 'from-slate-400 to-slate-200',
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <p className="text-[11px] uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-semibold bg-gradient-to-r ${tones[tone]} bg-clip-text text-transparent`}>{value}</p>
    </div>
  )
}

function Pill({ tone, text }: { tone: 'amber' | 'emerald' | 'rose'; text: string }) {
  const className =
    tone === 'amber'
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
      : tone === 'emerald'
        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
        : 'border-rose-500/30 bg-rose-500/10 text-rose-300'

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}>{text}</span>
}
