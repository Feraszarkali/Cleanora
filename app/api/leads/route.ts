// app/api/leads/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { findMatchingCompanies, createQuoteRequests } from '@/lib/marketplace/matching'

// Inline Supabase admin client factory
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

function createSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

export async function POST(req: Request) {
  try {
    const data = await req.json()
    console.log('[Leads API] Received lead data:', JSON.stringify({
      name: data.full_name ?? data.name,
      email: data.email,
      city: data.city,
      services: data.services,
      service_type: data.service_type ?? data.cleaning_type,
    }))
    
    const supabase = createSupabaseAdmin()

    // Insert new lead - use consistent field names
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        full_name: data.full_name ?? data.name,
        email: data.email,
        phone: data.phone ?? null,
        city: data.city ?? 'Berlin',
        address: data.address ?? data.address_full ?? null,
        // Store service info in both service_type AND services fields for matching flexibility
        service_type: data.service_type ?? data.cleaning_type ?? null,
        services: data.services ?? data.service_type ?? data.cleaning_type ?? null,
        rooms: data.rooms ?? null,
        bathrooms: data.bathrooms ?? null,
        square_meters: data.square_meters ?? null,
        preferred_date: data.preferred_date ?? null,
        preferred_time: data.preferred_time ?? null,
        urgency: data.urgency ?? 'medium',
        notes: data.notes ?? data.details ?? null,
        status: 'new',
      })
      .select()
      .single()

    if (leadError || !lead) {
      console.error('[Leads API] lead insert error:', leadError?.message)
      return NextResponse.json({ success: false, error: leadError?.message ?? 'Lead insert failed' }, { status: 500 })
    }

    console.log('[Leads API] ✅ Created lead id:', lead.id)
    console.log('[Leads API] Lead city:', lead.city)
    console.log('[Leads API] Lead services:', lead.services)
    console.log('[Leads API] Lead service_type:', lead.service_type)

    // Find matching companies - pass both services and service_type for flexibility
    const { companiesCount, matchedCompanies } = await findMatchingCompanies({
      city: lead.city,
      services: lead.services,
      service_type: lead.service_type,
    })

    console.log('[Leads API] active companies count:', companiesCount)
    console.log('[Leads API] matched companies count:', matchedCompanies.length)
    console.log('[Leads API] matched company IDs:', matchedCompanies.map(c => c.id))

    // Create quote rows for matched companies (idempotent)
    const { created, skipped, errors } = await createQuoteRequests(lead.id, matchedCompanies)

    console.log('[Leads API] ✅ Quote creation - created:', created, 'skipped:', skipped, 'errors:', errors)

    return NextResponse.json({
      success: true,
      leadId: lead.id,
      matchedCompaniesCount: matchedCompanies.length,
      quotesCreated: created,
      quotesSkipped: skipped,
      quoteErrors: errors.length > 0 ? errors : undefined,
    })
    
  } catch (error: any) {
    console.error('[Leads API] 🚨 Unhandled error:', error.message, error.stack)
    return NextResponse.json({ success: false, error: 'Internal server error', details: error?.message }, { status: 500 })
  }
}