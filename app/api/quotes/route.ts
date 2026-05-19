// app/api/quotes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')
    const leadId = searchParams.get('lead_id')
    const status = searchParams.get('status')
    
    const supabase = createSupabaseAdmin()
    
    let query = supabase
      .from('quotes')
      .select(`
        *,
        lead:leads(full_name, city, services, notes, first_date)
      `)
    
    if (companyId) query = query.eq('company_id', companyId)
    if (leadId) query = query.eq('lead_id', leadId)
    if (status) query = query.eq('status', status)
    
    const { data: quotes, error } = await query.order('created_at', { ascending: false })
    
    if (error) {
      console.error('[Quotes API] GET error:', error)
      return NextResponse.json({ error: 'Failed to fetch quotes' }, { status: 500 })
    }
    
    return NextResponse.json({ quotes })
    
  } catch (error) {
    console.error('[Quotes API] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    
    if (!body.quote_id || !body.status) {
      return NextResponse.json({ error: 'quote_id and status are required' }, { status: 400 })
    }
    
    const validStatuses = ['pending', 'accepted', 'rejected', 'expired', 'selected']
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 })
    }
    
    const supabase = createSupabaseAdmin()
    
    // Fetch quote to get lead_id for notifications
    const { data: quote, error: fetchError } = await supabase
      .from('quotes')
      .select('lead_id, company_id, price')
      .eq('id', body.quote_id)
      .single()
    
    if (fetchError || !quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }
    
    // Update quote status
    const { error: updateError } = await supabase
      .from('quotes')
      .update({
        status: body.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.quote_id)
    
    if (updateError) {
      return NextResponse.json({ error: 'Failed to update quote' }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      quote_id: body.quote_id,
      new_status: body.status,
    })
    
  } catch (error) {
    console.error('[Quotes API] PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}