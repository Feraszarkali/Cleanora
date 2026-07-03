'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type AdminProfile = {
  id: string
  email: string | null
  full_name: string | null
  phone: string | null
  role: string | null
  created_at: string | null
}

type PlatformSettingsSummary = {
  pricingRulesTotal: number | null
  pricingRulesActive: number | null
  coveredCities: string[]
  servicesCount: number | null
}

type NotificationSettingsSummary = {
  total: number | null
  unread: number | null
  types: string[]
}

type CompanyApprovalSummary = {
  totalCompanies: number | null
  activeCompanies: number | null
  verifiedCompanies: number | null
  pendingApproval: number | null
}

type RolesSummary = {
  adminCount: number | null
  companyCount: number | null
  customerCount: number | null
}

export default function AdminSettingsPage(): JSX.Element | null {
  const router = useRouter()

  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null)
  const [platformSettings, setPlatformSettings] = useState<PlatformSettingsSummary | null>(null)
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettingsSummary | null>(null)
  const [companyApproval, setCompanyApproval] = useState<CompanyApprovalSummary | null>(null)
  const [rolesSummary, setRolesSummary] = useState<RolesSummary | null>(null)

  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null)
  const [whatsAppAvailable, setWhatsAppAvailable] = useState<boolean | null>(null)

  const loadSettings = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/login')
        return
      }

      setIsAuthenticated(true)

      // Admin profile (existing profiles/auth logic)
      const profileRes = await supabase
        .from('profiles')
        .select('id, email, full_name, phone, role, created_at')
        .eq('id', user.id)
        .single()

      if (!profileRes.error) {
        setAdminProfile(profileRes.data as AdminProfile)
      } else {
        setAdminProfile({
          id: user.id,
          email: user.email || null,
          full_name: null,
          phone: null,
          role: null,
          created_at: null,
        })
      }

      // Platform settings if available (pricing_rules)
      const pricingRes = await supabase
        .from('pricing_rules')
        .select('id, city, service_type, active')

      if (!pricingRes.error) {
        const rules = pricingRes.data || []
        const active = rules.filter((rule: any) => rule.active === true)
        const cities = Array.from(new Set(rules.map((rule: any) => String(rule.city || '').trim()).filter(Boolean))).sort()
        const services = Array.from(new Set(rules.map((rule: any) => String(rule.service_type || '').trim()).filter(Boolean)))

        setPlatformSettings({
          pricingRulesTotal: rules.length,
          pricingRulesActive: active.length,
          coveredCities: cities,
          servicesCount: services.length,
        })
      } else {
        setPlatformSettings(null)
      }

      // Notification settings if available (notifications table)
      const notificationRes = await supabase
        .from('notifications')
        .select('id, read, type')
        .eq('user_id', user.id)

      if (!notificationRes.error) {
        const rows = notificationRes.data || []
        const unread = rows.filter((row: any) => row.read === false).length
        const types = Array.from(new Set(rows.map((row: any) => String(row.type || '').trim()).filter(Boolean))).sort()

        setNotificationSettings({
          total: rows.length,
          unread,
          types,
        })
      } else {
        setNotificationSettings(null)
      }

      // Company approval settings from cleaning_companies table
      const companiesRes = await supabase
        .from('cleaning_companies')
        .select('id, active')

      if (!companiesRes.error) {
        const rows = companiesRes.data || []
        const activeCompanies = rows.filter((company: any) => company.active === true).length
        const inactiveCompanies = rows.filter((company: any) => company.active === false).length

        setCompanyApproval({
          totalCompanies: rows.length,
          activeCompanies,
          verifiedCompanies: activeCompanies,
          pendingApproval: inactiveCompanies,
        })
      } else {
        setCompanyApproval(null)
      }

      // User roles/permissions if available
      const rolesRes = await supabase
        .from('profiles')
        .select('id, role')

      if (!rolesRes.error) {
        const rows = rolesRes.data || []
        setRolesSummary({
          adminCount: rows.filter((row: any) => row.role === 'admin').length,
          companyCount: rows.filter((row: any) => row.role === 'company').length,
          customerCount: rows.filter((row: any) => row.role === 'customer').length,
        })
      } else {
        setRolesSummary(null)
      }

      // Email/WhatsApp placeholders only based on existing fields/support.
      const emailExists = Boolean(profileRes.data?.email || user.email)
      setEmailAvailable(emailExists)

      // No dedicated WhatsApp setting/column in current supported model.
      setWhatsAppAvailable(false)
    } catch (err: any) {
      setError(err.message || 'Admin Settings konnten nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const profileRows = useMemo(
    () => [
      { label: 'Name', value: adminProfile?.full_name || '-' },
      { label: 'E-Mail', value: adminProfile?.email || '-' },
      { label: 'Telefon', value: adminProfile?.phone || '-' },
      { label: 'Rolle', value: adminProfile?.role || '-' },
      { label: 'Erstellt', value: formatDateTime(adminProfile?.created_at) },
    ],
    [adminProfile]
  )

  if (isAuthenticated === null) return null

  if (loading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
          <p className="text-sm text-slate-400">Settings werden geladen...</p>
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
              <h1 className="bg-gradient-to-r from-cyan-400 via-emerald-400 to-violet-500 bg-clip-text text-3xl font-black tracking-tight text-transparent md:text-4xl">
                Admin Settings
              </h1>
              <p className="mt-2 text-slate-400">Nur bestehende, unterstuetzte Einstellungen</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={loadSettings}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-500"
              >
                Aktualisieren
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

        <div className="grid gap-6 xl:grid-cols-2">
          <SettingsCard title="Admin Profile" subtitle="Vorhandene Profil-/Auth-Daten">
            {adminProfile ? (
              <div className="space-y-2">
                {profileRows.map((row) => (
                  <DataRow key={row.label} label={row.label} value={row.value} />
                ))}
              </div>
            ) : (
              <EmptyState text="Keine Profildaten verfuegbar." />
            )}
          </SettingsCard>

          <SettingsCard title="Platform Settings" subtitle="Vorhandene pricing_rules Einstellungen">
            {platformSettings ? (
              <div className="space-y-2">
                <DataRow label="Pricing Rules (total)" value={displayNumber(platformSettings.pricingRulesTotal)} />
                <DataRow label="Pricing Rules (active)" value={displayNumber(platformSettings.pricingRulesActive)} />
                <DataRow label="Cities covered" value={platformSettings.coveredCities.length > 0 ? platformSettings.coveredCities.join(', ') : '-'} />
                <DataRow label="Service types" value={displayNumber(platformSettings.servicesCount)} />
              </div>
            ) : (
              <EmptyState text="Keine Platform Settings verfuegbar." />
            )}
          </SettingsCard>

          <SettingsCard title="Notification Settings" subtitle="Vorhandene Benachrichtigungsdaten">
            {notificationSettings ? (
              <div className="space-y-2">
                <DataRow label="Notifications (total)" value={displayNumber(notificationSettings.total)} />
                <DataRow label="Unread" value={displayNumber(notificationSettings.unread)} />
                <DataRow
                  label="Notification types"
                  value={notificationSettings.types.length > 0 ? notificationSettings.types.join(', ') : '-'}
                />
              </div>
            ) : (
              <EmptyState text="Keine Notification Settings verfuegbar." />
            )}
          </SettingsCard>

          <SettingsCard title="Company Approval Settings" subtitle="Firmenstatus aus cleaning_companies">
            {companyApproval ? (
              <div className="space-y-2">
                <DataRow label="Companies (total)" value={displayNumber(companyApproval.totalCompanies)} />
                <DataRow label="Active companies" value={displayNumber(companyApproval.activeCompanies)} />
                <DataRow label="Inactive companies" value={displayNumber(companyApproval.pendingApproval)} />
              </div>
            ) : (
              <EmptyState text="Keine Company-Daten verfuegbar." />
            )}
          </SettingsCard>

          <SettingsCard title="User Roles / Permissions" subtitle="Vorhandene Rollenverteilung aus profiles">
            {rolesSummary ? (
              <div className="space-y-2">
                <DataRow label="Admins" value={displayNumber(rolesSummary.adminCount)} />
                <DataRow label="Companies" value={displayNumber(rolesSummary.companyCount)} />
                <DataRow label="Customers" value={displayNumber(rolesSummary.customerCount)} />
              </div>
            ) : (
              <EmptyState text="Keine Rollen-/Permission-Daten verfuegbar." />
            )}
          </SettingsCard>

          <SettingsCard title="Email / WhatsApp" subtitle="Platzhalter nur fuer bestehende Unterstuetzung">
            <div className="space-y-2">
              <DataRow label="Email channel" value={emailAvailable ? 'Available (existing email fields)' : 'No data'} />
              <DataRow label="WhatsApp channel" value={whatsAppAvailable ? 'Available' : 'Not configured in current model'} />
            </div>
          </SettingsCard>
        </div>
      </div>
    </div>
  )
}

function SettingsCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <section className="rounded-2xl border border-slate-800/50 bg-slate-900/60 p-5 shadow-lg shadow-black/10 backdrop-blur-sm">
      <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
      <p className="mb-4 text-xs text-slate-400">{subtitle}</p>
      {children}
    </section>
  )
}

function DataRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-800/60 bg-slate-950/30 px-3 py-2">
      <span className="text-xs uppercase tracking-wider text-slate-500">{label}</span>
      <span className="text-sm text-slate-200 text-right">{value}</span>
    </div>
  )
}

function EmptyState({ text }: { text: string }): JSX.Element {
  return <p className="rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-500">{text}</p>
}

function displayNumber(value: number | null): string {
  return typeof value === 'number' ? String(value) : 'No data'
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
