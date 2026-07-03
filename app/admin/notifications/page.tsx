'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type NotificationRow = {
  id: string
  user_id: string
  title: string
  message: string
  type: string | null
  read: boolean
  created_at: string
  lead_id?: string | null
  company_id?: string | number | null
  entity_id?: string | null
  entity_type?: string | null
}

export default function AdminNotificationsPage(): JSX.Element | null {
  const router = useRouter()

  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [markingOneId, setMarkingOneId] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)

  const fetchNotifications = useCallback(async (userId: string): Promise<void> => {
    setLoading(true)
    setError(null)

    try {
      const extended = await supabase
        .from('notifications')
        .select('id, user_id, title, message, type, read, created_at, lead_id, company_id, entity_id, entity_type')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (!extended.error) {
        setNotifications((extended.data || []) as NotificationRow[])
        return
      }

      // Fallback for deployments with only base notification columns.
      const base = await supabase
        .from('notifications')
        .select('id, user_id, title, message, type, read, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (base.error) throw base.error
      setNotifications((base.data || []) as NotificationRow[])
    } catch (err: any) {
      setError(err.message || 'Benachrichtigungen konnten nicht geladen werden.')
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

      setCurrentUserId(user.id)
      setIsAuthenticated(true)
      await fetchNotifications(user.id)
    }

    checkAuth()
  }, [fetchNotifications, router])

  useEffect(() => {
    if (!successMessage) return
    const timer = setTimeout(() => setSuccessMessage(null), 3000)
    return () => clearTimeout(timer)
  }, [successMessage])

  const unreadCount = useMemo(() => notifications.filter((notification) => !notification.read).length, [notifications])

  const handleMarkAsRead = useCallback(
    async (notificationId: string): Promise<void> => {
      if (!currentUserId) return
      setMarkingOneId(notificationId)

      try {
        const { error: updateError } = await supabase
          .from('notifications')
          .update({ read: true })
          .eq('id', notificationId)
          .eq('user_id', currentUserId)

        if (updateError) throw updateError

        setNotifications((prev) => prev.map((notification) => (notification.id === notificationId ? { ...notification, read: true } : notification)))
      } catch (err: any) {
        setError(err.message || 'Benachrichtigung konnte nicht als gelesen markiert werden.')
      } finally {
        setMarkingOneId(null)
      }
    },
    [currentUserId]
  )

  const handleMarkAllAsRead = useCallback(async (): Promise<void> => {
    if (!currentUserId || unreadCount === 0) return
    setMarkingAll(true)

    try {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', currentUserId)
        .eq('read', false)

      if (updateError) throw updateError

      setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })))
      setSuccessMessage('Alle Benachrichtigungen wurden als gelesen markiert.')
    } catch (err: any) {
      setError(err.message || 'Benachrichtigungen konnten nicht als gelesen markiert werden.')
    } finally {
      setMarkingAll(false)
    }
  }, [currentUserId, unreadCount])

  if (isAuthenticated === null) {
    return null
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black p-4 text-slate-100 md:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="rounded-2xl border border-slate-800/50 bg-slate-900/60 p-6 shadow-lg shadow-black/10 backdrop-blur-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="bg-gradient-to-r from-cyan-400 via-emerald-400 to-violet-500 bg-clip-text text-3xl font-black tracking-tight text-transparent md:text-4xl">
                Admin Notifications Center
              </h1>
              <p className="mt-2 text-slate-400">Alle Admin-Benachrichtigungen mit Status und schnellen Aktionen</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-sm text-amber-300">
                Ungelesen: {unreadCount}
              </div>

              <button
                type="button"
                onClick={handleMarkAllAsRead}
                disabled={markingAll || unreadCount === 0}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {markingAll ? 'Markiere...' : 'Alle als gelesen markieren'}
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

        {successMessage && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            {successMessage}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/60 shadow-lg shadow-black/10 backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full text-left text-sm">
              <thead className="bg-slate-800/50 text-xs uppercase tracking-[0.14em] text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-medium">Titel</th>
                  <th className="px-4 py-3 font-medium">Nachricht</th>
                  <th className="px-4 py-3 font-medium">Typ/Kategorie</th>
                  <th className="px-4 py-3 font-medium">Related Lead</th>
                  <th className="px-4 py-3 font-medium">Related Company</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Erstellt</th>
                  <th className="px-4 py-3 text-right font-medium">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                      Benachrichtigungen werden geladen...
                    </td>
                  </tr>
                )}

                {!loading && notifications.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                      Keine Benachrichtigungen vorhanden.
                    </td>
                  </tr>
                )}

                {!loading &&
                  notifications.map((notification) => {
                    const relatedLeadId = getRelatedLeadId(notification)
                    const relatedCompanyId = getRelatedCompanyId(notification)

                    return (
                      <tr key={notification.id} className="transition hover:bg-slate-800/30">
                        <td className="px-4 py-3 text-slate-100">
                          <p className="font-medium">{notification.title || '-'}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          <p className="max-w-md truncate" title={notification.message || ''}>
                            {notification.message || '-'}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${typeBadgeClass(notification.type)}`}>
                            {formatNotificationType(notification.type)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-300">{relatedLeadId ? String(relatedLeadId) : '-'}</td>
                        <td className="px-4 py-3 text-slate-300">{relatedCompanyId ? String(relatedCompanyId) : '-'}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
                              notification.read
                                ? 'border-slate-700 bg-slate-800/60 text-slate-300'
                                : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                            }`}
                          >
                            {notification.read ? 'Gelesen' : 'Ungelesen'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400">{formatDate(notification.created_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-3 text-xs">
                            {!notification.read && (
                              <button
                                type="button"
                                onClick={() => handleMarkAsRead(notification.id)}
                                disabled={markingOneId === notification.id}
                                className="text-emerald-400 transition hover:text-emerald-300 disabled:opacity-60"
                              >
                                {markingOneId === notification.id ? 'Markiere...' : 'Mark as read'}
                              </button>
                            )}

                            {relatedLeadId && (
                              <Link href={`/admin/leads?leadId=${encodeURIComponent(String(relatedLeadId))}`} className="text-cyan-400 transition hover:text-cyan-300">
                                Open Lead
                              </Link>
                            )}

                            {relatedCompanyId && (
                              <Link
                                href={`/admin/companies?companyId=${encodeURIComponent(String(relatedCompanyId))}`}
                                className="text-violet-400 transition hover:text-violet-300"
                              >
                                Open Company
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}

function formatDate(value: string | null | undefined): string {
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

function formatNotificationType(type: string | null | undefined): string {
  const key = String(type || '').trim().toLowerCase()

  const labels: Record<string, string> = {
    quote_created: 'Offer received',
    quote_accepted: 'Quote accepted',
    quote_rejected: 'Quote rejected',
    booking_confirmed: 'Customer accepted',
    system: 'System/admin actions',
  }

  if (labels[key]) return labels[key]
  if (!key) return '-'

  return key
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function typeBadgeClass(type: string | null | undefined): string {
  const key = String(type || '').trim().toLowerCase()

  if (key === 'quote_created') {
    return 'border-blue-500/30 bg-blue-500/10 text-blue-300'
  }

  if (key === 'quote_accepted' || key === 'booking_confirmed') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
  }

  if (key === 'quote_rejected') {
    return 'border-red-500/30 bg-red-500/10 text-red-300'
  }

  return 'border-slate-700 bg-slate-800/60 text-slate-300'
}

function getRelatedLeadId(notification: NotificationRow): string | null {
  if (notification.lead_id) return String(notification.lead_id)

  const entityType = String(notification.entity_type || '').toLowerCase()
  if ((entityType === 'lead' || entityType === 'leads') && notification.entity_id) {
    return String(notification.entity_id)
  }

  return null
}

function getRelatedCompanyId(notification: NotificationRow): string | number | null {
  if (notification.company_id !== undefined && notification.company_id !== null && notification.company_id !== '') {
    return notification.company_id
  }

  const entityType = String(notification.entity_type || '').toLowerCase()
  if (
    (entityType === 'company' || entityType === 'companies' || entityType === 'cleaning_company' || entityType === 'cleaning_companies') &&
    notification.entity_id
  ) {
    return notification.entity_id
  }

  return null
}
