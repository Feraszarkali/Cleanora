// lib/marketplace/matching.ts
import { createClient } from '@supabase/supabase-js'

// Inline Supabase admin client factory
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export function createSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

export interface MatchingCompany {
  id: string | number
  company_name: string
  email: string | null
  city: string | null
}

export interface MatchingOptions {
  limit?: number
}

// Normalize text for reliable matching
const normalizeText = (text: string | null | undefined): string => {
  if (!text) return ''
  return text.toLowerCase().trim().replace(/\s+/g, ' ')
}

// Parse services field into normalized set - handles string, array, or JSON string
const parseServices = (services: any): Set<string> => {
  const result = new Set<string>()
  if (!services) return result
  
  let items: string[] = []
  
  if (Array.isArray(services)) {
    items = services.filter(Boolean)
  } else if (typeof services === 'string') {
    if (services.startsWith('[')) {
      try {
        const parsed = JSON.parse(services)
        items = Array.isArray(parsed) ? parsed.filter(Boolean) : []
      } catch {
        items = services.split(',').map(s => s.trim()).filter(Boolean)
      }
    } else {
      items = services.split(',').map(s => s.trim()).filter(Boolean)
    }
  }
  
  for (const item of items) {
    if (typeof item === 'string') {
      const normalized = normalizeText(item)
      if (normalized) result.add(normalized)
    }
  }
  return result
}

export async function findMatchingCompanies(
  lead: { city: string | null; services: any; service_type?: string | null },
  options: MatchingOptions = {}
): Promise<{ companiesCount: number; matchedCompanies: MatchingCompany[] }> {
  const { limit = 5 } = options
  const supabase = createSupabaseAdmin()

  console.log('[Matching] Finding matches - city:', lead.city, 'services:', lead.services, 'service_type:', lead.service_type)

  // Fetch active companies - ONLY use real columns
  const { data: companies, error } = await supabase
    .from('cleaning_companies')
    .select('id, company_name, email, city, services, active')
    .eq('active', true)

  if (error) {
    console.error('[Matching] Failed to fetch companies:', error)
    return { companiesCount: 0, matchedCompanies: [] }
  }

  const companiesCount = (companies || []).length
  console.log(`[Matching] Active companies count: ${companiesCount}`)

  // Parse lead services - handle both normalized internal values and UI labels
  const leadServices = parseServices(lead.services ?? lead.service_type)
  const normalizedLeadCity = normalizeText(lead.city)
  
  console.log('[Matching] Parsed lead services:', Array.from(leadServices))

  // Match by services first, then city as secondary filter
  const matchedRaw = (companies || []).filter((company: any) => {
    const companyServices = parseServices(company.services)
    
    // Check for service overlap (handles both normalized and raw labels)
    const hasServiceOverlap = Array.from(leadServices).some(leadSvc => {
      // Direct match
      if (companyServices.has(leadSvc)) return true
      // Normalized match (in case lead has UI label but company has internal value)
      const normalizedLead = normalizeService(leadSvc)
      if (companyServices.has(normalizedLead)) return true
      // Reverse: company might have UI label, lead has internal value
      for (const companySvc of companyServices) {
        if (normalizeService(companySvc) === leadSvc) return true
      }
      return false
    })
    
    if (hasServiceOverlap) {
      console.log('[Matching] Company matched by service:', company.company_name)
      return true
    }
    
    // Fallback: match by city only if no service overlap
    if (normalizedLeadCity && normalizeText(company.city) === normalizedLeadCity) {
      console.log('[Matching] Company matched by city fallback:', company.company_name)
      return true
    }
    
    return false
  })

  let matchedCompanies: MatchingCompany[] = matchedRaw
    .map((company: any) => ({
      id: company.id,
      company_name: company.company_name,
      email: company.email ?? null,
      city: company.city ?? null,
    }))
    .slice(0, limit)

  // Fallback: if no companies matched, use ALL active companies
  if (matchedCompanies.length === 0) {
    console.log('[Matching] No matches found; falling back to all active companies')
    matchedCompanies = (companies || [])
      .map((company: any) => ({
        id: company.id,
        company_name: company.company_name,
        email: company.email ?? null,
        city: company.city ?? null,
      }))
      .slice(0, limit)
  }

  console.log(`[Matching] Final matched count: ${matchedCompanies.length}`)
  return { companiesCount, matchedCompanies }
}

// Service normalization helper for matching
const normalizeService = (service: string): string => {
  const normalized = service.toLowerCase().trim()
  // Map common variations to stable internal values
  const mappings: Record<string, string> = {
    'office cleaning': 'office',
    'büroreinigung': 'office',
    'house cleaning': 'regular',
    'regular cleaning': 'regular',
    'unterhaltsreinigung': 'regular',
    'deep cleaning': 'deep',
    'grundreinigung': 'deep',
    'move-out cleaning': 'move_out',
    'umzugsreinigung': 'move_out',
    'airbnb cleaning': 'airbnb',
    'airbnb reinigung': 'airbnb',
    'window cleaning': 'window',
    'fensterreinigung': 'window',
  }
  return mappings[normalized] || normalized.replace(/\s+/g, '_')
}

export async function createQuoteRequests(
  leadId: string,
  companies: Array<{ id: string | number; company_name: string }>
): Promise<{ created: number; skipped: number; errors: string[] }> {
  const supabase = createSupabaseAdmin()
  const results = { created: 0, skipped: 0, errors: [] as string[] }

  if (companies.length === 0) return results

  // Check for existing quotes (idempotent)
  const { data: existingQuotes, error: checkError } = await supabase
    .from('quotes')
    .select('lead_id, company_id')
    .eq('lead_id', leadId)

  if (checkError) {
    results.errors.push(`Failed to check existing quotes: ${checkError.message}`)
    return results
  }

  const existingKeys = new Set((existingQuotes || []).map((q: any) => `${q.lead_id}:${q.company_id}`))
  const newCompanies = companies.filter(c => !existingKeys.has(`${leadId}:${c.id}`))

  if (newCompanies.length === 0) {
    results.skipped = companies.length
    return results
  }

  // Create quotes with correct schema
  const quoteInserts = newCompanies.map(c => ({
    lead_id: String(leadId),
    company_id: Number(c.id),
    price: null,
    status: 'pending',
  }))

  const { data: insertedData, error: insertError } = await supabase
    .from('quotes')
    .insert(quoteInserts)
    .select()

  if (insertError) {
    console.error('[Matching] Quote insert error:', insertError)
    results.errors.push(`Failed to create quotes: ${insertError.message}`)
  } else {
    results.created = insertedData?.length || 0
  }

  results.skipped = companies.length - results.created
  return results
}