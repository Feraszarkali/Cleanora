// app/book/page.tsx — Customer Form V2 (standalone page)
'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormData {
  service_type: string
  city: string
  address: string
  rooms: string
  bathrooms: string
  square_meters: string
  preferred_date: string
  preferred_time: string
  urgency: string
  notes: string
  full_name: string
  email: string
  phone: string
  gdpr: boolean
}

interface FieldErrors {
  [key: string]: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SERVICES = [
  { value: 'regular',  label: 'Unterhaltsreinigung', icon: '🏠', desc: 'Regelmäßige Wohnungsreinigung' },
  { value: 'deep',     label: 'Grundreinigung',       icon: '✨', desc: 'Intensive Tiefenreinigung' },
  { value: 'move_out', label: 'Endreinigung',          icon: '📦', desc: 'Übergabereinigung bei Auszug' },
  { value: 'office',   label: 'Büroreinigung',         icon: '🏢', desc: 'Professionelle Gewerbereinigung' },
  { value: 'airbnb',   label: 'Airbnb Reinigung',      icon: '🛏️', desc: 'Schnellreinigung für Kurzzeitvermietung' },
  { value: 'window',   label: 'Fensterreinigung',      icon: '🪟', desc: 'Innen- und Außenfenster' },
]

const CITIES = ['Bonn', 'Köln', 'Koblenz', 'Berlin', 'Hamburg', 'München', 'Frankfurt', 'Düsseldorf']

const TIME_SLOTS = [
  '08:00–10:00', '10:00–12:00', '12:00–14:00',
  '14:00–16:00', '16:00–18:00', '18:00–20:00',
]

const TOTAL_STEPS = 5
const STEP_LABELS = ['Service', 'Objekt', 'Termin', 'Kontakt', 'Bestätigung']
const STEP_TITLES = [
  'Welchen Service benötigen Sie?',
  'Objekt & Standort',
  'Wunschtermin',
  'Ihre Kontaktdaten',
  'Zusammenfassung & Absenden',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMinDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

function validateStep(step: number, data: FormData): FieldErrors {
  const errors: FieldErrors = {}
  if (step === 1 && !data.service_type) errors.service_type = 'Bitte wählen Sie einen Service aus.'
  if (step === 2 && !data.city)         errors.city = 'Bitte wählen Sie eine Stadt aus.'
  if (step === 3 && !data.preferred_date) errors.preferred_date = 'Bitte wählen Sie ein Datum aus.'
  if (step === 4) {
    if (!data.full_name.trim()) errors.full_name = 'Bitte geben Sie Ihren Namen ein.'
    if (!data.email.trim())     errors.email = 'Bitte geben Sie Ihre E-Mail-Adresse ein.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.email = 'Ungültige E-Mail-Adresse.'
  }
  if (step === 5 && !data.gdpr) errors.gdpr = 'Bitte stimmen Sie der Datenschutzerklärung zu.'
  return errors
}

const EMPTY: FormData = {
  service_type: '', city: '', address: '',
  rooms: '', bathrooms: '', square_meters: '',
  preferred_date: '', preferred_time: '', urgency: 'medium', notes: '',
  full_name: '', email: '', phone: '', gdpr: false,
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="mt-1 text-xs text-red-400">{msg}</p>
}

function InputField({ label, required, error, children }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">
        {label}{required && <span className="text-emerald-400 ml-0.5">*</span>}
      </label>
      {children}
      <FieldError msg={error} />
    </div>
  )
}

const inputCls = (hasError?: boolean) =>
  `w-full px-4 py-3 rounded-xl bg-slate-800/80 border ${hasError ? 'border-red-500/60' : 'border-slate-700/60'} text-slate-200 text-sm focus:border-emerald-500 focus:outline-none transition placeholder:text-slate-500`

function SummaryRow({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-slate-800/60 last:border-0">
      <span className="text-xs text-slate-500 shrink-0 w-28">{label}</span>
      <span className="text-sm text-slate-200 text-right">{value}</span>
    </div>
  )
}

// ─── Step panels ──────────────────────────────────────────────────────────────

function Step1({ data, errors, set }: { data: FormData; errors: FieldErrors; set: (k: keyof FormData, v: string | boolean) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SERVICES.map((s) => (
          <button key={s.value} type="button" onClick={() => set('service_type', s.value)}
            className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${
              data.service_type === s.value
                ? 'border-emerald-500/60 bg-emerald-500/10 ring-1 ring-emerald-500/20'
                : 'border-slate-700/60 bg-slate-800/40 hover:border-slate-600'
            }`}
          >
            <span className="text-2xl shrink-0">{s.icon}</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-200">{s.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.desc}</p>
            </div>
            {data.service_type === s.value && (
              <span className="ml-auto shrink-0 h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center text-[11px] text-white font-bold">✓</span>
            )}
          </button>
        ))}
      </div>
      <FieldError msg={errors.service_type} />
    </div>
  )
}

function Step2({ data, errors, set }: { data: FormData; errors: FieldErrors; set: (k: keyof FormData, v: string | boolean) => void }) {
  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-4">
        <InputField label="Stadt" required error={errors.city}>
          <select value={data.city} onChange={(e) => set('city', e.target.value)} className={inputCls(!!errors.city)}>
            <option value="">Stadt wählen…</option>
            {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </InputField>
        <InputField label="Straße & Hausnummer">
          <input type="text" value={data.address} onChange={(e) => set('address', e.target.value)}
            placeholder="Musterstraße 12" className={inputCls()} />
        </InputField>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <InputField label="Zimmer">
          <input type="number" min="1" max="20" value={data.rooms}
            onChange={(e) => set('rooms', e.target.value)} placeholder="3" className={inputCls()} />
        </InputField>
        <InputField label="Badezimmer">
          <input type="number" min="1" max="10" value={data.bathrooms}
            onChange={(e) => set('bathrooms', e.target.value)} placeholder="1" className={inputCls()} />
        </InputField>
        <InputField label="Fläche (m²)">
          <input type="number" min="10" max="2000" value={data.square_meters}
            onChange={(e) => set('square_meters', e.target.value)} placeholder="80" className={inputCls()} />
        </InputField>
      </div>
    </div>
  )
}

function Step3({ data, errors, set }: { data: FormData; errors: FieldErrors; set: (k: keyof FormData, v: string | boolean) => void }) {
  return (
    <div className="space-y-5">
      <InputField label="Wunschdatum" required error={errors.preferred_date}>
        <input type="date" min={getMinDate()} value={data.preferred_date}
          onChange={(e) => set('preferred_date', e.target.value)} className={inputCls(!!errors.preferred_date)} />
      </InputField>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Bevorzugte Uhrzeit</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {TIME_SLOTS.map((slot) => (
            <button key={slot} type="button"
              onClick={() => set('preferred_time', data.preferred_time === slot ? '' : slot)}
              className={`rounded-xl border py-2.5 text-sm transition ${
                data.preferred_time === slot
                  ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300'
                  : 'border-slate-700/60 bg-slate-800/40 text-slate-300 hover:border-slate-600'
              }`}
            >{slot}</button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Dringlichkeit</label>
        <div className="grid grid-cols-3 gap-3">
          {([['low', 'Niedrig', '🌿'], ['medium', 'Normal', '⏱️'], ['high', 'Dringend', '🔥']] as const).map(([v, l, icon]) => (
            <button key={v} type="button" onClick={() => set('urgency', v)}
              className={`flex flex-col items-center gap-1 rounded-xl border py-3 text-sm transition ${
                data.urgency === v
                  ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300'
                  : 'border-slate-700/60 bg-slate-800/40 text-slate-300 hover:border-slate-600'
              }`}
            >
              <span className="text-xl">{icon}</span>
              <span>{l}</span>
            </button>
          ))}
        </div>
      </div>
      <InputField label="Anmerkungen">
        <textarea value={data.notes} onChange={(e) => set('notes', e.target.value)} rows={3}
          placeholder="Besondere Wünsche, Zugangsinformationen, Haustiere…"
          className={`${inputCls()} resize-none`} />
      </InputField>
    </div>
  )
}

function Step4({ data, errors, set }: { data: FormData; errors: FieldErrors; set: (k: keyof FormData, v: string | boolean) => void }) {
  return (
    <div className="space-y-4">
      <InputField label="Vollständiger Name" required error={errors.full_name}>
        <input type="text" value={data.full_name} onChange={(e) => set('full_name', e.target.value)}
          placeholder="Max Mustermann" autoComplete="name" className={inputCls(!!errors.full_name)} />
      </InputField>
      <InputField label="E-Mail-Adresse" required error={errors.email}>
        <input type="email" value={data.email} onChange={(e) => set('email', e.target.value)}
          placeholder="max@example.de" autoComplete="email" className={inputCls(!!errors.email)} />
      </InputField>
      <InputField label="Telefonnummer">
        <input type="tel" value={data.phone} onChange={(e) => set('phone', e.target.value)}
          placeholder="+49 151 12345678" autoComplete="tel" className={inputCls()} />
      </InputField>
      <p className="text-xs text-slate-500">
        Ihre Kontaktdaten werden nur zur Vermittlung passender Reinigungsunternehmen verwendet.
      </p>
    </div>
  )
}

function Step5({ data, errors, set }: { data: FormData; errors: FieldErrors; set: (k: keyof FormData, v: string | boolean) => void }) {
  const service = SERVICES.find((s) => s.value === data.service_type)
  const urgencyLabel: Record<string, string> = { low: 'Niedrig', medium: 'Normal', high: 'Dringend' }
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-700/60 bg-slate-800/30 p-5">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">Ihre Anfrage im Überblick</h4>
        <SummaryRow label="Service" value={service ? `${service.icon} ${service.label}` : ''} />
        <SummaryRow label="Stadt" value={data.city} />
        <SummaryRow label="Adresse" value={data.address} />
        <SummaryRow label="Zimmer" value={data.rooms} />
        <SummaryRow label="Badezimmer" value={data.bathrooms} />
        <SummaryRow label="Fläche" value={data.square_meters ? `${data.square_meters} m²` : ''} />
        <SummaryRow label="Datum" value={data.preferred_date} />
        <SummaryRow label="Uhrzeit" value={data.preferred_time} />
        <SummaryRow label="Dringlichkeit" value={urgencyLabel[data.urgency] ?? data.urgency} />
        <SummaryRow label="Anmerkungen" value={data.notes} />
        <SummaryRow label="Name" value={data.full_name} />
        <SummaryRow label="E-Mail" value={data.email} />
        <SummaryRow label="Telefon" value={data.phone} />
      </div>
      <label className={`flex items-start gap-3 cursor-pointer rounded-xl border p-4 transition ${
        data.gdpr ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-slate-700/60 bg-slate-800/30'
      } ${errors.gdpr ? '!border-red-500/50' : ''}`}>
        <input type="checkbox" checked={data.gdpr} onChange={(e) => set('gdpr', e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-500" />
        <span className="text-sm text-slate-300">
          Ich stimme der{' '}
          <a href="/datenschutz" target="_blank" rel="noopener noreferrer"
            className="text-emerald-400 underline hover:text-emerald-300">Datenschutzerklärung</a>{' '}
          zu und bin damit einverstanden, dass meine Daten zur Vermittlung von Reinigungsunternehmen verarbeitet werden.{' '}
          <span className="text-emerald-400">*</span>
        </span>
      </label>
      <FieldError msg={errors.gdpr} />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BookPage() {
  const [step, setStep] = useState(1)
  const [data, setData] = useState<FormData>({ ...EMPTY })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const set = useCallback((key: keyof FormData, value: string | boolean) => {
    setData((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => { const next = { ...prev }; delete next[key]; return next })
  }, [])

  const goNext = () => {
    const errs = validateStep(step, data)
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    setStep((s) => Math.min(s + 1, TOTAL_STEPS))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const goBack = () => {
    setErrors({})
    setStep((s) => Math.max(s - 1, 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async () => {
    const errs = validateStep(5, data)
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const payload = {
        full_name: data.full_name.trim(),
        email: data.email.trim(),
        phone: data.phone.trim() || null,
        city: data.city,
        address: data.address.trim() || null,
        service_type: data.service_type,
        services: [data.service_type],
        rooms: data.rooms ? parseInt(data.rooms) : null,
        bathrooms: data.bathrooms ? parseInt(data.bathrooms) : null,
        square_meters: data.square_meters ? parseInt(data.square_meters) : null,
        preferred_date: data.preferred_date || null,
        preferred_time: data.preferred_time || null,
        urgency: data.urgency,
        notes: data.notes.trim() || null,
      }
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Anfrage fehlgeschlagen')
      setSubmitted(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Success ─────────────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="h-20 w-20 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-4xl mx-auto">✓</div>
          <div>
            <h1 className="text-2xl font-black text-white">Anfrage gesendet!</h1>
            <p className="text-slate-400 mt-3 leading-relaxed">
              Wir suchen passende Reinigungsfirmen in{' '}
              <span className="text-emerald-400 font-medium">{data.city}</span> für Sie.
            </p>
            <p className="text-slate-500 text-sm mt-3">
              Sie erhalten Angebote an <span className="text-slate-300">{data.email}</span>.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/"
              className="px-6 py-3 rounded-2xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition">
              Zur Startseite
            </Link>
            <button type="button"
              onClick={() => { setSubmitted(false); setStep(1); setData({ ...EMPTY }); setErrors({}); setSubmitError(null) }}
              className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition">
              Neue Anfrage
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Form ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-100">
      <header className="border-b border-slate-800/60 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-lg font-black bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
            Cleanora
          </Link>
          <span className="text-xs text-slate-500">Kostenlos &amp; unverbindlich</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 md:py-12">
        {/* Stepper */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            {STEP_LABELS.map((label, i) => {
              const s = i + 1
              return (
                <div key={label} className="flex flex-col items-center gap-1.5 flex-1">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition ${
                    s < step  ? 'bg-emerald-500 border-emerald-500 text-white' :
                    s === step ? 'bg-transparent border-emerald-500 text-emerald-400' :
                                 'bg-transparent border-slate-700 text-slate-600'
                  }`}>{s < step ? '✓' : s}</div>
                  <span className={`text-[10px] hidden sm:block ${s === step ? 'text-emerald-400' : s < step ? 'text-slate-400' : 'text-slate-600'}`}>
                    {label}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="h-1 rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all"
              style={{ width: `${((step - 1) / (TOTAL_STEPS - 1)) * 100}%` }} />
          </div>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-slate-800/60 bg-slate-900/60 backdrop-blur-sm shadow-2xl shadow-black/20">
          <div className="px-6 pt-6 pb-4 border-b border-slate-800/60">
            <h2 className="text-xl font-bold text-white">{STEP_TITLES[step - 1]}</h2>
            <p className="text-sm text-slate-500 mt-0.5">Schritt {step} von {TOTAL_STEPS}</p>
          </div>

          <div className="px-6 py-6">
            {step === 1 && <Step1 data={data} errors={errors} set={set} />}
            {step === 2 && <Step2 data={data} errors={errors} set={set} />}
            {step === 3 && <Step3 data={data} errors={errors} set={set} />}
            {step === 4 && <Step4 data={data} errors={errors} set={set} />}
            {step === 5 && <Step5 data={data} errors={errors} set={set} />}
            {submitError && (
              <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {submitError}
              </div>
            )}
          </div>

          <div className="px-6 pb-6 pt-4 border-t border-slate-800/60 flex items-center justify-between gap-3">
            <button type="button" onClick={goBack} disabled={step === 1}
              className="px-5 py-2.5 rounded-xl border border-slate-700/60 bg-slate-800/80 hover:bg-slate-700 disabled:opacity-40 text-sm font-medium text-slate-300 transition">
              ← Zurück
            </button>
            {step < TOTAL_STEPS ? (
              <button type="button" onClick={goNext}
                className="px-7 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition">
                Weiter →
              </button>
            ) : (
              <button type="button" onClick={handleSubmit} disabled={submitting}
                className="px-7 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-semibold transition flex items-center gap-2">
                {submitting && <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
                {submitting ? 'Wird gesendet…' : 'Anfrage absenden'}
              </button>
            )}
          </div>
        </div>

        {/* Trust line */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500">
          <span>🔒 SSL-verschlüsselt</span>
          <span>✓ DSGVO-konform</span>
          <span>⚡ Kostenlos &amp; unverbindlich</span>
        </div>
      </main>
    </div>
  )
}