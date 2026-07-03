import * as nodemailer from 'nodemailer'

type NotificationChannel = 'email' | 'whatsapp'

type DispatchOutcome = {
  channel: NotificationChannel
  attempted: number
  delivered: number
  skipped: number
  failures: string[]
}

export type LeadNotificationCompany = {
  id: string | number
  company_name: string
  email: string | null
}

export type LeadNotificationLead = {
  id: string
  full_name: string
  email: string
  phone: string | null
  city: string
  service_type?: string | null
  services?: unknown
  preferred_date?: string | null
  preferred_time?: string | null
  notes?: string | null
}

export type WinningQuoteNotificationQuote = {
  id: string
  lead_id: string
  company_id: string | number
  price: number | null
  message: string | null
}

export type WinningQuoteNotificationCompany = {
  id: string | number
  company_name: string
  email: string | null
}

type EmailSettings = {
  host: string
  port: number
  secure: boolean
  user: string
  password: string
  from: string
}

type EmailTransportState = {
  settings: EmailSettings | null
  transporter: nodemailer.Transporter | null
}

const emailState: EmailTransportState = {
  settings: null,
  transporter: null,
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim()
}

function formatServices(services: unknown): string {
  if (Array.isArray(services)) {
    const values = services.filter(Boolean).map((value) => String(value).trim()).filter(Boolean)
    return values.length > 0 ? values.join(', ') : 'Nicht angegeben'
  }

  if (typeof services === 'string') {
    const text = services.trim()
    if (!text) return 'Nicht angegeben'

    if (text.startsWith('[')) {
      try {
        const parsed = JSON.parse(text)
        if (Array.isArray(parsed)) {
          const values = parsed.filter(Boolean).map((value) => String(value).trim()).filter(Boolean)
          return values.length > 0 ? values.join(', ') : 'Nicht angegeben'
        }
      } catch {
        // Fall back to the plain text below.
      }
    }

    return text
  }

  return 'Nicht angegeben'
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Nicht angegeben'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatTime(value: string | null | undefined): string {
  return value || 'Nicht angegeben'
}

function buildEmailSettings(): EmailSettings | null {
  const host = normalizeText(process.env.SMTP_HOST)
  const user = normalizeText(process.env.SMTP_USER)
  const password = normalizeText(process.env.SMTP_PASSWORD)
  const from = normalizeText(process.env.SMTP_FROM || process.env.EMAIL_FROM || process.env.MAIL_FROM)

  if (!host || !user || !password || !from) return null

  const port = Number(process.env.SMTP_PORT || 587)

  return {
    host,
    port: Number.isFinite(port) && port > 0 ? port : 587,
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465,
    user,
    password,
    from,
  }
}

function getEmailTransporter(): nodemailer.Transporter | null {
  if (emailState.transporter) return emailState.transporter

  const settings = buildEmailSettings()
  emailState.settings = settings
  if (!settings) return null

  emailState.transporter = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: {
      user: settings.user,
      pass: settings.password,
    },
  })

  return emailState.transporter
}

function hasEmailInfrastructure(): boolean {
  return Boolean(getEmailTransporter())
}

async function withRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 250))
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Notification delivery failed')
}

async function sendEmail(to: string, subject: string, text: string, html: string): Promise<void> {
  const transporter = getEmailTransporter()
  if (!transporter || !emailState.settings) {
    throw new Error('E-Mail-Infrastruktur ist nicht konfiguriert')
  }

  await withRetry(async () => {
    await transporter.sendMail({
      from: emailState.settings?.from,
      to,
      subject,
      text,
      html,
    })
  })
}

function leadCreatedSubject(lead: LeadNotificationLead): string {
  return `Neue Anfrage: ${lead.full_name} in ${lead.city}`
}

function leadCreatedText(lead: LeadNotificationLead): string {
  return [
    `Neue Reinigungsanfrage von ${lead.full_name}.`,
    `E-Mail: ${lead.email}`,
    `Telefon: ${lead.phone || 'Nicht angegeben'}`,
    `Stadt: ${lead.city}`,
    `Leistungen: ${formatServices(lead.services ?? lead.service_type)}`,
    `Wunschdatum: ${formatDate(lead.preferred_date)}`,
    `Wunschzeit: ${formatTime(lead.preferred_time)}`,
    lead.notes ? `Hinweise: ${lead.notes}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

function leadCreatedHtml(lead: LeadNotificationLead): string {
  const rows = [
    ['Kunde', lead.full_name],
    ['E-Mail', lead.email],
    ['Telefon', lead.phone || 'Nicht angegeben'],
    ['Stadt', lead.city],
    ['Leistungen', formatServices(lead.services ?? lead.service_type)],
    ['Wunschdatum', formatDate(lead.preferred_date)],
    ['Wunschzeit', formatTime(lead.preferred_time)],
    ['Hinweise', lead.notes || 'Nicht angegeben'],
  ]

  return `
    <div style="font-family:Arial,sans-serif;background:#0f172a;color:#e2e8f0;padding:24px">
      <div style="max-width:640px;margin:0 auto;background:#111827;border:1px solid #1f2937;border-radius:16px;padding:24px">
        <h2 style="margin:0 0 16px;font-size:20px;color:#34d399">Neue Cleanora-Anfrage</h2>
        <p style="margin:0 0 16px;color:#cbd5e1">Eine neue Anfrage passt zu Ihrem Angebot. Antworten Sie direkt auf diese E-Mail oder loggen Sie sich ins Portal ein.</p>
        <table style="width:100%;border-collapse:collapse">
          ${rows.map(([label, value]) => `<tr><td style="padding:8px 0;width:180px;color:#94a3b8;vertical-align:top">${label}</td><td style="padding:8px 0;color:#e2e8f0">${value}</td></tr>`).join('')}
        </table>
      </div>
    </div>
  `
}

function winningQuoteSubject(lead: LeadNotificationLead): string {
  return `Ihr Angebot für ${lead.full_name} wurde bestätigt`
}

function winningQuoteText(lead: LeadNotificationLead, company: WinningQuoteNotificationCompany, quote: WinningQuoteNotificationQuote): string {
  return [
    'Ihr Angebot wurde ausgewählt.',
    `Kunde: ${lead.full_name}`,
    `E-Mail: ${lead.email}`,
    `Stadt: ${lead.city}`,
    `Firma: ${company.company_name}`,
    quote.price != null ? `Preis: ${quote.price.toFixed(2)} €` : null,
    quote.message ? `Nachricht: ${quote.message}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

function winningQuoteHtml(lead: LeadNotificationLead, company: WinningQuoteNotificationCompany, quote: WinningQuoteNotificationQuote): string {
  return `
    <div style="font-family:Arial,sans-serif;background:#0f172a;color:#e2e8f0;padding:24px">
      <div style="max-width:640px;margin:0 auto;background:#111827;border:1px solid #1f2937;border-radius:16px;padding:24px">
        <h2 style="margin:0 0 16px;font-size:20px;color:#34d399">Angebot bestätigt</h2>
        <p style="margin:0 0 16px;color:#cbd5e1">Ihr Angebot wurde als Gewinner ausgewählt. Bitte prüfen Sie die nächsten Schritte im Portal.</p>
        <table style="width:100%;border-collapse:collapse">
          ${[
            ['Kunde', lead.full_name],
            ['E-Mail', lead.email],
            ['Stadt', lead.city],
            ['Firma', company.company_name],
            ['Preis', quote.price != null ? `${quote.price.toFixed(2)} €` : 'Nicht angegeben'],
            ['Nachricht', quote.message || 'Nicht angegeben'],
          ].map(([label, value]) => `<tr><td style="padding:8px 0;width:180px;color:#94a3b8;vertical-align:top">${label}</td><td style="padding:8px 0;color:#e2e8f0">${value}</td></tr>`).join('')}
        </table>
      </div>
    </div>
  `
}

async function dispatchEmails<TPayload>(
  recipients: string[],
  sendFn: (recipient: string, payload: TPayload) => Promise<void>,
  payload: TPayload
): Promise<DispatchOutcome> {
  const outcome: DispatchOutcome = {
    channel: 'email',
    attempted: 0,
    delivered: 0,
    skipped: 0,
    failures: [],
  }

  if (recipients.length === 0) {
    outcome.skipped = 1
    return outcome
  }

  const settled = await Promise.allSettled(
    recipients.map(async (recipient) => {
      outcome.attempted += 1
      await sendFn(recipient, payload)
      outcome.delivered += 1
    })
  )

  settled.forEach((result) => {
    if (result.status === 'rejected') {
      outcome.failures.push(result.reason instanceof Error ? result.reason.message : String(result.reason))
    }
  })

  return outcome
}

function buildWhatsAppOutcome(): DispatchOutcome {
  return {
    channel: 'whatsapp',
    attempted: 0,
    delivered: 0,
    skipped: 1,
    failures: [],
  }
}

export function isEmailNotificationReady(): boolean {
  return hasEmailInfrastructure()
}

export async function dispatchLeadCreatedNotifications(input: {
  lead: LeadNotificationLead
  companies: LeadNotificationCompany[]
}): Promise<DispatchOutcome[]> {
  const companiesByEmail = new Map<string, LeadNotificationCompany>()

  for (const company of input.companies) {
    const email = normalizeText(company.email).toLowerCase()
    if (!email) continue
    if (!companiesByEmail.has(email)) {
      companiesByEmail.set(email, company)
    }
  }

  const emailOutcome = await dispatchEmails(
    Array.from(companiesByEmail.values()).map((company) => normalizeText(company.email)),
    async (recipient, payload) => {
      await sendEmail(recipient, leadCreatedSubject(payload.lead), leadCreatedText(payload.lead), leadCreatedHtml(payload.lead))
    },
    input
  )

  return [emailOutcome, buildWhatsAppOutcome()]
}

export async function dispatchWinningQuoteNotification(input: {
  lead: LeadNotificationLead
  quote: WinningQuoteNotificationQuote
  company: WinningQuoteNotificationCompany
}): Promise<DispatchOutcome[]> {
  const recipients = input.lead.email ? [input.lead.email] : []

  const emailOutcome = await dispatchEmails(
    recipients,
    async (recipient, payload) => {
      await sendEmail(recipient, winningQuoteSubject(payload.lead), winningQuoteText(payload.lead, payload.company, payload.quote), winningQuoteHtml(payload.lead, payload.company, payload.quote))
    },
    input
  )

  return [emailOutcome, buildWhatsAppOutcome()]
}