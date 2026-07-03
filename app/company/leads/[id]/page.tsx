'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../../lib/supabaseClient'
import {
  CompanyRow,
  LeadRow,
  QuoteRow,
  estimateDuration,
  extractFileUrls,
  formatDate,
  formatDateTime,
  formatMoney,
  formatStatus,
  getLeadAddress,
  pickServiceList,
  quotePrice,
  isImageFile,
} from '../../../../lib/companyPortal'

type LeadDetailState = {
  company: CompanyRow | null
  companyId: number | null
  lead: LeadRow | null
  quote: QuoteRow | null
  loading: boolean
  error: string | null
  saving: boolean
  successMessage: string | null
}

function statusBadgeClass(status: string, hasSubmittedPrice: boolean): string {
  const normalized = status.toLowerCase()
  if (normalized === 'submitted' || normalized === 'offered') return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
  if (normalized === 'accepted' || normalized === 'selected') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
  if (normalized === 'rejected' || normalized === 'expired') return 'border-red-500/30 bg-red-500/10 text-red-300'
  if (normalized === 'pending' && hasSubmittedPrice) return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
  if (normalized === 'pending') return 'border-amber-500/30 bg-amber-500/10 text-amber-300'
  return 'border-slate-700 bg-slate-800/60 text-slate-300'
}

export default function CompanyLeadDetailsPage(): JSX.Element {
  const router = useRouter()
  const params = useParams<{ id: string | string[] }>()
  const leadId = useMemo(() => {
    const raw = params?.id
    return Array.isArray(raw) ? raw[0] || '' : raw || ''
  }, [params])

  const [state, setState] = useState<LeadDetailState>({
    company: null,
    companyId: null,
    lead: null,
    quote: null,
    loading: true,
    error: null,
    saving: false,
    successMessage: null,
  })
  const [price, setPrice] = useState('')
  const [message, setMessage] = useState('')

  const resolveCompany = useCallback(async (): Promise<{ company: CompanyRow; companyId: number; userId: string } | null> => {
    const { data } = await supabase.auth.getUser()
    const user = data.user
    if (!user?.email) return null

    const { data: companyData, error } = await supabase
      .from('cleaning_companies')
      .select('id, company_name, contact_person, email, phone, city, active')
      .eq('email', user.email.toLowerCase())
      .eq('active', true)
      .maybeSingle<CompanyRow>()

    if (error || !companyData) return null
    return { company: companyData, companyId: Number(companyData.id), userId: user.id }
  }, [])

  const loadLead = useCallback(async (): Promise<void> => {
    setState((current) => ({ ...current, loading: true, error: null }))

    try {
      const resolved = await resolveCompany()
      if (!resolved) {
        router.replace('/company/login')
        return
      }

      const { company, companyId } = resolved
      localStorage.setItem('company_id', String(companyId))

      const { data: quoteData, error: quoteError } = await supabase
        .from('quotes')
        .select(`
          id,
          lead_id,
          company_id,
          price,
          final_price,
          proposed_price,
          message,
          status,
          created_at,
          updated_at,
          lead:leads(
            id,
            full_name,
            email,
            phone,
            city,
            address,
            street,
            house_number,
            zip_code,
            service_type,
            services,
            notes,
            preferred_date,
            preferred_time,
            first_date,
            time_slots,
            status,
            created_at,
            photos,
            photo_urls,
            images,
            files,
            attachments,
            uploaded_files
          )
        `)
        .eq('lead_id', leadId)
        .eq('company_id', companyId)
        .maybeSingle<QuoteRow>()

      if (quoteError) throw quoteError
      if (!quoteData?.lead) {
        throw new Error('Lead not found or not assigned to this company')
      }

      setState({
        company,
        companyId,
        lead: quoteData.lead,
        quote: quoteData,
        loading: false,
        error: null,
        saving: false,
        successMessage: null,
      })

      const initialPrice = quotePrice(quoteData)
      setPrice(initialPrice != null ? String(initialPrice) : '')
      setMessage(quoteData.message || '')
    } catch (err: unknown) {
      const e = err as Error
      setState((current) => ({ ...current, loading: false, error: e.message || 'Lead details could not be loaded' }))
    }
  }, [leadId, resolveCompany, router])

  useEffect(() => {
    loadLead()
  }, [loadLead])

  useEffect(() => {
    if (!state.successMessage) return
    const timer = setTimeout(() => setState((current) => ({ ...current, successMessage: null })), 3000)
    return () => clearTimeout(timer)
  }, [state.successMessage])

  const handleSubmitQuote = useCallback(async (): Promise<void> => {
    if (!state.companyId || !state.lead) return

    const parsedPrice = Number(price)
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setState((current) => ({ ...current, error: 'Please enter a valid quote price' }))
      return
    }

    setState((current) => ({ ...current, saving: true, error: null }))

    try {
      const normalizedMessage = message.trim() || null
      const serviceCount = Math.max(1, pickServiceList(state.lead).length)
      const estimatedDuration = estimateDuration(
        {
          id: state.quote?.id || 'temp',
          lead_id: state.lead.id,
          company_id: state.companyId,
          price: parsedPrice,
          message: normalizedMessage,
          status: 'submitted',
          created_at: state.quote?.created_at || state.lead.created_at,
          lead: state.lead,
        },
        serviceCount
      )

      const payload = {
        lead_id: state.lead.id,
        company_id: state.companyId,
        price: parsedPrice,
        final_price: parsedPrice,
        proposed_price: parsedPrice,
        message: normalizedMessage,
        notes: normalizedMessage,
        estimated_duration: estimatedDuration,
        status: 'submitted',
      }

      const { data: existingQuote, error: existingError } = await supabase
        .from('quotes')
        .select('id')
        .eq('lead_id', state.lead.id)
        .eq('company_id', state.companyId)
        .maybeSingle<{ id: string }>()

      if (existingError) throw existingError

      if (existingQuote?.id) {
        const { error: updateError } = await supabase
          .from('quotes')
          .update({
            price: parsedPrice,
            final_price: parsedPrice,
            proposed_price: parsedPrice,
            message: normalizedMessage,
            notes: normalizedMessage,
            estimated_duration: estimatedDuration,
            status: 'submitted',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingQuote.id)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase.from('quotes').insert(payload)
        if (insertError) throw insertError
      }

      setState((current) => ({
        ...current,
        quote: current.quote
          ? {
              ...current.quote,
              price: parsedPrice,
              final_price: parsedPrice,
              proposed_price: parsedPrice,
              message: normalizedMessage,
              notes: normalizedMessage,
              estimated_duration: estimatedDuration,
              status: 'submitted',
              updated_at: new Date().toISOString(),
            }
          : {
              id: `${current.lead?.id || 'quote'}-${Date.now()}`,
              lead_id: current.lead?.id || leadId,
              company_id: current.companyId || 0,
              price: parsedPrice,
              final_price: parsedPrice,
              proposed_price: parsedPrice,
              message: normalizedMessage,
              notes: normalizedMessage,
              estimated_duration: estimatedDuration,
              status: 'submitted',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              lead: current.lead,
            },
        saving: false,
        successMessage: 'Quote submitted. Admin can review it now.',
      }))
    } catch (err: unknown) {
      const e = err as Error
      setState((current) => ({ ...current, saving: false, error: e.message || 'Quote submission failed' }))
    }
  }, [leadId, message, price, state.companyId, state.lead])

  if (state.loading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-100 flex items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
      </div>
    )
  }

  if (state.error || !state.lead || !state.companyId || !state.company) {
    return (
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
          <p className="text-red-300">{state.error || 'Lead not found.'}</p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <Link href="/company/dashboard" className="inline-flex rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700">
              Back to dashboard
            </Link>
            <button
              type="button"
              onClick={loadLead}
              className="inline-flex rounded-lg bg-cyan-600 px-4 py-2 text-sm text-white hover:bg-cyan-500"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  const services = pickServiceList(state.lead)
  const files = extractFileUrls(state.lead)
  const quoteForDuration: QuoteRow = state.quote ?? {
    id: 'temp',
    lead_id: state.lead.id,
    company_id: state.companyId,
    price: null,
    message: null,
    status: 'pending',
    created_at: state.lead.created_at,
    lead: state.lead,
  }
  const duration = estimateDuration(quoteForDuration, Math.max(1, services.length))
  const submitted = Boolean(state.quote?.price)
  const statusLabel = (state.quote?.status === 'pending' && submitted) || state.quote?.status === 'submitted' || state.quote?.status === 'offered'
    ? 'Submitted'
    : formatStatus(state.quote?.status || 'pending')

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black p-4 text-slate-100 md:p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="rounded-2xl border border-slate-800/50 bg-slate-900/60 p-6 shadow-lg shadow-black/10 backdrop-blur-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Lead Details</p>
              <h1 className="mt-1 bg-gradient-to-r from-cyan-400 via-emerald-400 to-violet-500 bg-clip-text text-3xl font-black tracking-tight text-transparent md:text-4xl">
                {state.lead.full_name || 'Unnamed lead'}
              </h1>
              <p className="mt-2 text-slate-400">Lead ID: {state.lead.id}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${statusBadgeClass(state.quote?.status || 'pending', submitted)}`}>
                {statusLabel}
              </span>
              <Link href="/company/dashboard" className="rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-700">
                Back to dashboard
              </Link>
            </div>
          </div>
        </header>

        {state.successMessage && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{state.successMessage}</div>}

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-2xl border border-slate-800/50 bg-slate-900/60 p-5 shadow-lg shadow-black/10 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-slate-100">Customer Information</h2>
            <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
              <InfoRow label="Customer" value={state.lead.full_name || '-'} />
              <InfoRow label="Email" value={state.lead.email || '-'} />
              <InfoRow label="Phone" value={state.lead.phone || '-'} />
              <InfoRow label="City" value={state.lead.city || '-'} />
              <InfoRow label="Address" value={getLeadAddress(state.lead) || '-'} full />
              <InfoRow label="Requested service" value={services.length > 0 ? services.join(', ') : '-'} full />
              <InfoRow label="Preferred date" value={formatDate(state.lead.preferred_date || state.lead.first_date)} />
              <InfoRow label="Preferred time" value={state.lead.preferred_time || (Array.isArray(state.lead.time_slots) ? state.lead.time_slots.join(', ') : '-') || '-'} />
              <InfoRow label="Lead created" value={formatDateTime(state.lead.created_at)} />
              <InfoRow label="Notes" value={state.lead.notes || 'No customer notes provided.'} full />
            </div>
          </article>

          <article className="rounded-2xl border border-slate-800/50 bg-slate-900/60 p-5 shadow-lg shadow-black/10 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-slate-100">Quote Composer</h2>
            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Current quote status</p>
                <p className="mt-1 text-lg font-semibold text-slate-100">{statusLabel}</p>
                <p className="mt-2 text-sm text-slate-400">Price: {formatMoney(state.quote ? quotePrice(state.quote) : null)}</p>
                <p className="text-sm text-slate-400">Estimated duration: {duration}</p>
                <p className="mt-2 text-sm text-slate-400">Admin sees new or updated quotes immediately in the marketplace.</p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-[0.12em] text-slate-400">Price</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-[0.12em] text-slate-400">Message</label>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={6}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                  placeholder="Describe scope, timing, or special notes"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleSubmitQuote}
                  disabled={state.saving}
                  className="rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:from-cyan-500 hover:to-emerald-500 disabled:opacity-60"
                >
                  {state.saving ? 'Submitting...' : 'Submit quote'}
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/company/dashboard')}
                  className="rounded-xl border border-slate-700 bg-slate-800/80 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-700"
                >
                  Back
                </button>
              </div>

              {state.error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{state.error}</p>}
            </div>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-2xl border border-slate-800/50 bg-slate-900/60 p-5 shadow-lg shadow-black/10 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-slate-100">Photos / Files</h2>
            <div className="mt-4">
              {files.length === 0 ? (
                <p className="rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-6 text-sm text-slate-500">No photos or files attached.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {files.map((url, index) => (
                    <a
                      key={`${url}-${index}`}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/50 p-2 transition hover:border-slate-600"
                    >
                      {isImageFile(url) ? (
                        <img src={url} alt={`Lead attachment ${index + 1}`} className="h-32 w-full rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-700 text-xs text-slate-400">Open file</div>
                      )}
                      <p className="mt-2 truncate text-xs text-slate-400">{url}</p>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-800/50 bg-slate-900/60 p-5 shadow-lg shadow-black/10 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-slate-100">Quote Summary</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <SummaryRow label="Status" value={statusLabel} />
              <SummaryRow label="Price" value={formatMoney(price ? Number(price) : state.quote ? quotePrice(state.quote) : null)} />
              <SummaryRow label="Duration" value={duration} />
              <SummaryRow label="Message" value={message.trim() || state.quote?.message || 'No message yet'} />
              <SummaryRow label="Created" value={formatDateTime(state.quote?.created_at || state.lead.created_at)} />
            </div>
          </article>
        </section>
      </div>
    </div>
  )
}

function InfoRow({ label, value, full = false }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? 'md:col-span-2' : ''}>
      <p className="text-xs uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className="mt-1 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-slate-200">{value}</p>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2">
      <span className="text-slate-500">{label}</span>
      <span className="max-w-[70%] text-right text-slate-200">{value}</span>
    </div>
  )
}
