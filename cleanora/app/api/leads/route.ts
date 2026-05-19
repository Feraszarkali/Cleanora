
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { analyzeLead } from '@/lib/ai/leadScoring'

export async function POST(req: Request) {
  const data = await req.json()
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  
  const { data: lead, error } = await supabase.from('leads').insert({
    customer_name: data.name, customer_email: data.email, cleaning_type: 'sonstiges',
    frequency: 'one_time', address_full: 'Berlin', city: 'Berlin', status: 'new'
  }).select().single()

  if (lead) {
    const aiResult = await analyzeLead(data)
    await supabase.from('leads').update({ ai_summary: aiResult.summary, ai_score: aiResult.score }).eq('id', lead.id)
  }

  return NextResponse.json({ success: !error, leadId: lead?.id })
}
