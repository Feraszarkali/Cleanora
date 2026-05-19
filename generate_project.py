# generate_project.py
import os
import json

PROJECT_NAME = "cleanora"

# File content dictionary
FILES = {
    "package.json": json.dumps({
        "name": "cleanora",
        "version": "1.0.0",
        "private": True,
        "scripts": {
            "dev": "next dev",
            "build": "next build",
            "start": "next start",
            "lint": "next lint"
        },
        "dependencies": {
            "@supabase/ssr": "^0.1.0",
            "@supabase/supabase-js": "^2.39.0",
            "next": "14.2.3",
            "next-intl": "^3.10.0",
            "react": "^18.3.1",
            "react-dom": "^18.3.1",
            "framer-motion": "^11.0.0",
            "lucide-react": "^0.358.0",
            "zod": "^3.22.4",
            "react-hook-form": "^7.50.0",
            "@hookform/resolvers": "^3.3.4",
            "nodemailer": "^6.9.9",
            "openai": "^4.28.0",
            "clsx": "^2.1.0",
            "tailwind-merge": "^2.2.1"
        },
        "devDependencies": {
            "@types/node": "^20",
            "@types/react": "^18",
            "@types/react-dom": "^18",
            "@types/nodemailer": "^6.4.14",
            "typescript": "^5",
            "tailwindcss": "^3.4.1",
            "postcss": "^8",
            "autoprefixer": "^10.0.1",
            "eslint": "^8",
            "eslint-config-next": "14.2.3"
        }
    }, indent=2),

    "next.config.js": """
/** @type {import('next').NextConfig} */
const createNextIntlPlugin = require('next-intl/plugin');
const withNextIntl = createNextIntlPlugin('./i18n/request.ts');
const nextConfig = {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
};
module.exports = withNextIntl(nextConfig);
""",

    "tailwind.config.ts": """
import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./pages/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}', './app/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: { 50: '#eff6ff', 500: '#3b82f6', 600: '#2563eb', 900: '#1e3a8a' },
        dark: { 800: '#1e293b', 900: '#0f172a', 950: '#020617' },
        emerald: { 450: '#10b981' }
      },
      backgroundImage: {
        'gradient-premium': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'gradient-cleanora': 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #10b981 100%)',
      },
      boxShadow: { 'premium': '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }
    },
  },
  plugins: [],
}
export default config
""",

    "tsconfig.json": json.dumps({
        "compilerOptions": {
            "target": "es5", "lib": ["dom", "dom.iterable", "esnext"],
            "allowJs": True, "skipLibCheck": True, "strict": True, "noEmit": True,
            "esModuleInterop": True, "module": "esnext", "moduleResolution": "bundler",
            "resolveJsonModule": True, "isolatedModules": True, "jsx": "preserve",
            "incremental": True, "plugins": [{"name": "next"}],
            "paths": {"@/*": ["./*"]}
        },
        "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
        "exclude": ["node_modules"]
    }, indent=4),

    ".env.local": """
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_BASE_URL=http://localhost:3000
OPENAI_API_KEY=sk-proj-your-openai-key
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=your_password
""",

    "supabase/migrations/001_initial_schema.sql": """
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE lead_status AS ENUM ('new', 'verified', 'reviewed', 'ready_to_send', 'sent_to_companies', 'waiting_for_offers', 'offer_comparison', 'customer_decision', 'closed', 'lost');
CREATE TYPE lead_score AS ENUM ('gold', 'silver', 'low_quality');
CREATE TYPE cleaning_type AS ENUM ('buroreinigung', 'praxisreinigung', 'fensterreinigung', 'airbnb', 'restaurant', 'treppenhaus', 'bauendreinigung', 'unterhaltsreinigung', 'sonstiges');
CREATE TYPE cleaning_frequency AS ENUM ('one_time', 'daily', 'weekly', 'monthly', 'several_times_week');

CREATE TABLE companies (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, phone TEXT, city TEXT NOT NULL,
  services cleaning_type[] NOT NULL, credits INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT false, is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE leads (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_name TEXT NOT NULL, customer_email TEXT NOT NULL, customer_phone TEXT,
  cleaning_type cleaning_type NOT NULL, property_type TEXT, square_meters INTEGER,
  frequency cleaning_frequency NOT NULL, description TEXT,
  address_full TEXT NOT NULL, city TEXT NOT NULL,
  ai_summary TEXT, ai_score lead_score DEFAULT 'silver', ai_tags TEXT[],
  status lead_status DEFAULT 'new', is_email_verified BOOLEAN DEFAULT false,
  verification_token UUID DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
""",

    "types/index.ts": """
export type CleaningType = 'buroreinigung' | 'praxisreinigung' | 'fensterreinigung' | 'airbnb' | 'restaurant' | 'treppenhaus' | 'bauendreinigung' | 'unterhaltsreinigung' | 'sonstiges';
export type LeadStatus = 'new' | 'verified' | 'reviewed' | 'ready_to_send' | 'sent_to_companies' | 'closed';
export interface Lead { id: string; customer_name: string; customer_email: string; cleaning_type: CleaningType; status: LeadStatus; city: string; created_at: string; ai_score: 'gold' | 'silver' | 'low_quality'; }
export interface Company { id: string; name: string; city: string; services: CleaningType[]; }
""",

    "lib/supabase/client.ts": """
import { createBrowserClient } from '@supabase/ssr'
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}
""",

    "lib/ai/leadScoring.ts": """
import OpenAI from 'openai';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function analyzeLead(data: any) {
  const prompt = `Analysiere diese Anfrage JSON: ${JSON.stringify(data)}. Antworte mit JSON: {"summary": "...", "score": "gold|silver|low_quality", "tags": []}`;
  const completion = await openai.chat.completions.create({ model: 'gpt-4-turbo-preview', messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' } });
  return JSON.parse(completion.choices[0].message.content || '{}');
}
""",

    "app/globals.css": """
@tailwind base; @tailwind components; @tailwind utilities;
body { @apply antialiased bg-white text-dark-900; }
.dark body { @apply bg-dark-950 text-white; }
.glass-card { @apply bg-white/80 dark:bg-dark-900/80 backdrop-blur-xl border border-gray-200/50 dark:border-dark-800; }
""",

    "app/layout.tsx": """
import { Inter } from 'next/font/google'
import './globals.css'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'

const inter = Inter({ subsets: ['latin'] })

export const metadata = { title: 'Cleanora | KI-Reinigungs-Vermittlung', description: 'AI-powered cleaning company matching platform' }

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const messages = await getMessages()
  return (
    <html lang="de">
      <body className={inter.className}>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
""",

    "i18n/request.ts": """
import { getRequestConfig } from 'next-intl/server'
export default getRequestConfig(async ({ locale }) => ({ messages: (await import(`./locales/${locale}.json`)).default }))
""",

    "i18n/locales/de.json": json.dumps({
        "Common": { "loading": "Laden...", "submit": "Absenden" },
        "Hero": { "headline": "Professionelle Reinigungsfirmen finden – schnell, kostenlos und intelligent", "subheadline": "Cleanora verbindet Unternehmen mit passenden Firmen.", "primaryCTA": "Kostenloses Angebot erhalten" },
        "Services": { "title": "Dienstleistungen", "buroreinigung": { "title": "Büroreinigung" } }
    }, indent=4),

    "app/(marketing)/page.tsx": """
'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import LeadFormModal from '@/components/form/LeadFormModal'

export default function Home() {
  const t = useTranslations()
  const [formOpen, setFormOpen] = useState(false)
  return (
    <main className="min-h-screen bg-white dark:bg-dark-950">
      <LeadFormModal isOpen={formOpen} onClose={() => setFormOpen(false)} />
      <section className="pt-32 pb-20 px-4 text-center">
        <h1 className="text-5xl font-bold mb-6 gradient-text">{t('Hero.headline')}</h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-10">{t('Hero.subheadline')}</p>
        <button onClick={() => setFormOpen(true)} className="px-8 py-4 bg-dark-900 text-white rounded-xl font-bold hover:scale-105 transition">
          {t('Hero.primaryCTA')}
        </button>
      </section>
      <section className="py-20 bg-gray-50 dark:bg-dark-900/50">
        <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-6 px-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="text-xl font-semibold mb-2">{t('Services.buroreinigung.title')}</h3>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
""",

    "components/form/LeadFormModal.tsx": """
'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'

export default function LeadFormModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-dark-900 w-full max-w-lg p-6 rounded-2xl shadow-premium relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full"><X /></button>
        <h2 className="text-2xl font-bold mb-4">Anfrage senden</h2>
        <form onSubmit={(e) => { e.preventDefault(); alert('Anfrage gesendet!'); onClose(); }} className="space-y-4">
          <input className="w-full p-3 border rounded-lg" placeholder="Name" required />
          <input className="w-full p-3 border rounded-lg" placeholder="E-Mail" type="email" required />
          <button type="submit" className="w-full py-3 bg-primary-600 text-white rounded-lg font-bold">Absenden</button>
        </form>
      </motion.div>
    </div>
  )
}
""",

    "app/api/leads/route.ts": """
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
""",

    "app/admin/page.tsx": """
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AdminDashboard() {
  const [leads, setLeads] = useState([])
  useEffect(() => {
    const supabase = createClient()
    supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(10)
      .then(({ data }) => setLeads(data || []))
  }, [])

  return (
    <div className="p-8 min-h-screen bg-gray-50">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border"><h3 className="text-gray-500">Neue Anfragen</h3><p className="text-3xl font-bold">{leads.length}</p></div>
      </div>
      <div className="mt-8 bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50"><tr><th className="p-4">Name</th><th className="p-4">Typ</th><th className="p-4">Status</th></tr></thead>
          <tbody>{leads.map((l: any, i) => <tr key={i} className="border-t"><td className="p-4">{l.customer_name}</td><td className="p-4">{l.cleaning_type}</td><td className="p-4"><span className="px-2 py-1 bg-blue-100 rounded-full text-xs">{l.status}</span></td></tr>)}</tbody>
        </table>
      </div>
    </div>
  )
}
"""
}

def generate():
    for path, content in FILES.items():
        full_path = os.path.join(PROJECT_NAME, path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✅ Created: {path}")
    print("\n🎉 Cleanora project generated successfully!")

if __name__ == "__main__":
    generate()