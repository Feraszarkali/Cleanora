export const QUOTE_STATUS_OPTIONS = ["pending", "selected", "rejected", "sent"]
export const STATUS_OPTIONS = ["new", "contacted", "collecting_quotes", "quote_sent", "completed", "cancelled"]

export function parseArray(v: any): string[] {
  if (!v) return []
  if (Array.isArray(v)) return v
  if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean)
  return []
}

export function calculateCommission(price: any) {
  const p = Number(price) || 0
  const commission = Math.round(p * 0.1 * 100) / 100
  const companyRevenue = Math.round((p - commission) * 100) / 100
  return { commission, companyRevenue }
}

export function getRemainingLabel(deadline: any): string {
  if (!deadline) return ''
  const diff = new Date(deadline).getTime() - Date.now()
  if (diff <= 0) return 'Abgelaufen'
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}
