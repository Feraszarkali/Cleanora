export type CompanyRow = {
  id: number
  company_name: string | null
  contact_person?: string | null
  email: string | null
  phone?: string | null
  city?: string | null
  active?: boolean
}

export type LeadRow = {
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
  archived?: boolean | null
  photos?: string[] | string | null
  photo_urls?: string[] | string | null
  images?: string[] | string | null
  files?: string[] | string | null
  attachments?: string[] | string | null
  uploaded_files?: string[] | string | null
  [key: string]: unknown
}

export type QuoteRow = {
  id: string
  lead_id: string
  company_id: number | string
  price: number | null
  final_price?: number | null
  proposed_price?: number | null
  message: string | null
  status: string
  created_at: string
  updated_at?: string | null
  lead?: LeadRow | null
  company_name?: string | null
  [key: string]: unknown
}

export type ActivityRow = {
  id: string
  title?: string | null
  message?: string | null
  description?: string | null
  action?: string | null
  type?: string | null
  created_at: string
  lead_id?: string | null
  company_id?: number | string | null
  quote_id?: string | null
  metadata?: Record<string, unknown> | null
}

export type NotificationRow = {
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

export function parseArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
  }

  if (typeof value === 'string' && value.trim()) {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return []
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatStatus(status: string | null | undefined): string {
  if (!status) return '-'
  return status
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function formatMoney(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return '-'
  return `${Number(value).toFixed(2)} €`
}

export function safeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

export function quotePrice(quote: QuoteRow): number | null {
  return safeNumber(quote.price) ?? safeNumber(quote.final_price) ?? safeNumber(quote.proposed_price)
}

export function estimateDuration(quote: QuoteRow, serviceCount: number): string {
  const price = quotePrice(quote)
  const baseHours = Math.max(2, serviceCount * 1.5)
  const speedFactor = price == null ? 1.15 : price < 200 ? 1.05 : 0.95
  const hours = Math.max(1.5, baseHours * speedFactor)
  return `${hours.toFixed(1)}h`
}

export function calculateCommission(price: number | null | undefined): { commission: number; companyRevenue: number } {
  const safePrice = Number(price) || 0
  const commission = Math.round(safePrice * 0.1 * 100) / 100
  const companyRevenue = Math.round((safePrice - commission) * 100) / 100
  return { commission, companyRevenue }
}

export function pickServiceList(lead: Pick<LeadRow, 'services' | 'service_type'> | null | undefined): string[] {
  if (!lead) return []
  const services = parseArray(lead.services)
  if (services.length > 0) return services
  if (lead.service_type && String(lead.service_type).trim()) return [String(lead.service_type)]
  return []
}

export function extractFileUrls(lead: LeadRow | null): string[] {
  if (!lead) return []

  const keys: Array<keyof LeadRow> = ['photos', 'photo_urls', 'images', 'files', 'attachments', 'uploaded_files']
  const urls = new Set<string>()

  for (const key of keys) {
    for (const value of parseArray(lead[key])) {
      if (/^https?:\/\//i.test(value) || value.startsWith('/')) {
        urls.add(value)
      }
    }
  }

  return Array.from(urls)
}

export function isImageFile(url: string): boolean {
  return /\.(png|jpg|jpeg|gif|webp|bmp|svg)(\?.*)?$/i.test(url)
}

export function getLeadAddress(lead: LeadRow): string {
  const streetAddress = [lead.street, lead.house_number].filter(Boolean).join(' ')
  return [streetAddress || lead.address, lead.zip_code, lead.city].filter(Boolean).join(', ')
}

export function normalizeCompanyId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}
