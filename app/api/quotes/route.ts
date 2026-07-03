// app/api/quotes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { dispatchWinningQuoteNotification, isEmailNotificationReady } from '@/lib/marketplace/communication'

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
      .select('id, lead_id, company_id, price, status, message')
      .eq('id', body.quote_id)
      .single()
    
    if (fetchError || !quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    const { data: lead, error: leadFetchError } = await supabase
      .from('leads')
      .select('id, full_name, email, phone, city, services, preferred_date, preferred_time, notes, status')
      .eq('id', quote.lead_id)
      .single()

    if (leadFetchError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const { data: company, error: companyFetchError } = await supabase
      .from('cleaning_companies')
      .select('id, company_name, email')
      .eq('id', quote.company_id)
      .single()

    if (companyFetchError || !company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    if (body.status === 'selected' && quote.status === 'selected' && lead.status === 'quote_sent') {
      return NextResponse.json({
        success: true,
        quote_id: body.quote_id,
        new_status: body.status,
        already_finalized: true,
      })
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

    if (body.status === 'selected') {
      const { error: updateOthersError } = await supabase
        .from('quotes')
        .update({ status: 'rejected' })
        .eq('lead_id', quote.lead_id)
        .neq('id', body.quote_id)

      if (updateOthersError) {
        return NextResponse.json({ error: 'Failed to update competing quotes' }, { status: 500 })
      }

      const { error: updateLeadError } = await supabase
        .from('leads')
        .update({ status: 'quote_sent' })
        .eq('id', quote.lead_id)

      if (updateLeadError) {
        return NextResponse.json({ error: 'Failed to update lead status' }, { status: 500 })
      }

      if (isEmailNotificationReady() && lead.email) {
        try {
          const notificationResults = await dispatchWinningQuoteNotification({
            lead: {
              id: lead.id,
              full_name: lead.full_name,
              email: lead.email,
              phone: lead.phone,
              city: lead.city,
              services: lead.services,
              preferred_date: lead.preferred_date,
              preferred_time: lead.preferred_time,
              notes: lead.notes,
            },
            quote: {
              id: quote.id,
              lead_id: quote.lead_id,
              company_id: quote.company_id,
              price: quote.price ?? null,
              message: quote.message ?? null,
            },
            company: {
              id: company.id,
              company_name: company.company_name,
              email: company.email ?? null,
            },
          })

          const emailOutcome = notificationResults.find((item) => item.channel === 'email')
          if (emailOutcome?.failures.length) {
            console.warn('[Quotes API] Winning quote email warnings:', emailOutcome.failures)
          }
        } catch (notificationError) {
          const error = notificationError as Error
          console.warn('[Quotes API] Winning quote notification failed after selection:', error.message)
        }
      }
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