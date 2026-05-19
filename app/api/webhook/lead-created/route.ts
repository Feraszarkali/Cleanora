// app/api/webhook/lead-created/route.ts
import { NextRequest, NextResponse } from 'next/server'
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

export async function POST(request: NextRequest) {
  console.log('='.repeat(60))
  console.log('[Webhook] 🔹 START: Received POST request')
  console.log('='.repeat(60))
  
  try {
    const body = await request.json()
    console.log('[Webhook] 📦 Raw request body:', JSON.stringify(body))
    
    const lead_id = body?.lead_id || body?.leadId
    console.log('[Webhook] 🔑 Extracted lead_id:', lead_id)
    
    if (!lead_id) {
      console.error('[Webhook] ❌ ERROR: Missing lead_id in payload')
      return NextResponse.json({ error: 'lead_id is required' }, { status: 400 })
    }

    const supabase = createSupabaseAdmin()
    const normalizedLeadId = String(lead_id)

    // Fetch the lead to get matching criteria - select all relevant fields
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, city, services, service_type, status')
      .eq('id', normalizedLeadId)
      .single()

    if (leadError || !lead) {
      console.error('[Webhook] ❌ ERROR: Lead fetch failed:', leadError?.message)
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    console.log('[Webhook] ✅ STEP 1: Lead fetched - id:', lead.id, 'city:', lead.city, 'services:', lead.services, 'service_type:', lead.service_type)

    // Skip if already processed
    if (lead.status !== 'new') {
      console.log('[Webhook] ℹ️ Lead already processed (status:', lead.status, ') - skipping quote creation')
      return NextResponse.json({
        success: true,
        message: 'Lead already processed',
        status: lead.status,
        quotes_created: 0,
      })
    }

    // Find matching companies - pass both services and service_type for flexibility
    const { companiesCount, matchedCompanies } = await findMatchingCompanies({
      city: lead.city,
      services: lead.services,
      service_type: lead.service_type,
    })

    console.log('[Webhook] ✅ STEP 2: Found', matchedCompanies.length, 'matching companies out of', companiesCount, 'active')
    console.log('[Webhook] Matched company IDs:', matchedCompanies.map(c => c.id))

    // Create quote rows for matched companies (idempotent)
    const { created, skipped, errors } = await createQuoteRequests(normalizedLeadId, matchedCompanies)

    console.log('[Webhook] ✅ STEP 3: Quote creation - created:', created, 'skipped:', skipped, 'errors:', errors)

    // Update lead status if quotes were created
    if (created > 0) {
      const deadline = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
      const { error: updateError } = await supabase
        .from('leads')
        .update({ status: 'collecting_quotes', quote_deadline: deadline })
        .eq('id', normalizedLeadId)
      if (updateError) {
        console.error('[Webhook] ⚠️ WARNING: Failed to update lead status/quote_deadline:', updateError.message)
      } else {
        console.log('[Webhook] ✅ STEP 4: Lead status updated to collecting_quotes, deadline:', deadline)
      }
    }

    console.log('='.repeat(60))
    console.log('[Webhook] 🎉 COMPLETE')
    console.log('='.repeat(60))
    
    return NextResponse.json({
      success: true,
      lead_id: normalizedLeadId,
      matched_companies_count: matchedCompanies.length,
      quotes_created: created,
      quotes_skipped: skipped,
      errors: errors.length > 0 ? errors : undefined,
    })
    
  } catch (error: any) {
    console.error('[Webhook] 🚨 CRITICAL UNHANDLED ERROR:', error.message)
    console.error('[Webhook] Stack:', error.stack)
    console.log('='.repeat(60))
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 })
  }
}