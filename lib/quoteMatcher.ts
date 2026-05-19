// lib/quoteMatcher.ts

export function normalizeService(service: string): string {
  return service
    .toLowerCase()
    .trim()
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ')
}

export function parseServices(services: string | string[] | null | undefined): string[] {
  if (!services) return []
  if (Array.isArray(services)) {
    return services
      .filter(Boolean)
      .map(s => normalizeService(String(s)))
      .filter(s => s.length > 0)
  }
  return services
    .split(',')
    .map(s => normalizeService(s))
    .filter(s => s.length > 0)
}

export interface MatchingCompany {
  id: string | number
  name: string
  services: string[]
}

export function matchCompaniesToLead(
  leadServices: string | string[] | null,
  allCompanies: Array<{ 
    id: string | number
    company_name: string | null
    services: string | string[] | null
    active: boolean 
  }>
): MatchingCompany[] {
  const leadSrvs = new Set(parseServices(leadServices))
  if (leadSrvs.size === 0) return []

  return allCompanies
    .filter(c => c.active)
    .map(c => ({
      id: c.id,
      name: c.company_name || 'Unknown Company',
      services: parseServices(c.services)
    }))
    .filter(c => c.services.some(s => leadSrvs.has(s)))
}