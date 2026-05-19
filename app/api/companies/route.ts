import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const createSupabaseClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Supabase environment variables are missing')
  }

  return createClient(url, key)
}

export async function POST(req: Request) {
  try {
    const supabase = createSupabaseClient()
    const { companyForm, id } = await req.json()

    const payload = {
      company_name: companyForm.company_name,
      contact_person: companyForm.contact_person || null,
      email: companyForm.email || null,
      phone: companyForm.phone || null,
      city: companyForm.city || null,
      address: companyForm.address || null,
      services: Array.isArray(companyForm.services) ? companyForm.services : [],
      rating: companyForm.rating !== undefined ? Number(companyForm.rating) : 0,
      active: companyForm.active ?? true,
      notes: companyForm.notes || null,
    }

    const response = id
      ? await supabase.from('cleaning_companies').update(payload).eq('id', id)
      : await supabase.from('cleaning_companies').insert(payload)

    if (response.error) {
      return NextResponse.json(
        { error: response.error.message, details: response.error },
        { status: response.status || 500 }
      )
    }

    return NextResponse.json({ data: response.data })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Unexpected error saving company' },
      { status: 500 }
    )
  }
}
