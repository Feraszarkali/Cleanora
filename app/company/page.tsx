// app/company/page.tsx
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabaseClient"

interface Company {
  id: number
  company_name: string | null
  contact_person: string | null
  email: string | null
  phone: string | null
  city: string | null
  active: boolean
}

export default function CompanySelector(): JSX.Element {
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const router = useRouter()

  useEffect(() => {
    const storedCompanyId = localStorage.getItem("company_id")
    if (storedCompanyId) {
      router.replace(`/company/${storedCompanyId}`)
    }
  }, [router])

  useEffect(() => {
    const fetchCompanies = async (): Promise<void> => {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from("cleaning_companies")
          .select("*")
          .eq("active", true)
          .order("company_name")
        if (error) throw error
        setCompanies(data || [])
      } catch (err: unknown) {
        const error = err as Error
        setError(error.message || "Fehler beim Laden")
      } finally {
        setLoading(false)
      }
    }
    fetchCompanies()
  }, [])

  const handleOpenPortal = (): void => {
    if (selectedCompanyId) {
      // For demo/testing: directly open portal without login
      window.location.href = `/company/${selectedCompanyId}`
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-100 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight bg-gradient-to-r from-cyan-400 via-emerald-400 to-violet-500 bg-clip-text text-transparent">
            Firmenportal
          </h1>
          <p className="mt-2 text-slate-400 text-sm">
            Wählen Sie eine Option, um fortzufahren
          </p>
        </header>

        {error && (
          <div className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Login Option */}
        <div className="mb-6">
          <Link
            href="/company/login"
            className="block w-full px-6 py-4 rounded-xl bg-gradient-to-r from-cyan-600/20 to-emerald-600/20 hover:from-cyan-600/30 hover:to-emerald-600/30 border border-cyan-500/30 text-cyan-300 font-medium transition text-center group"
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5 group-hover:translate-x-1 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              Firmen-Login
            </span>
            <span className="block text-xs text-slate-400 mt-1 font-normal">
              Mit E-Mail anmelden und zum Portal gelangen
            </span>
          </Link>
        </div>

        {/* Demo Selector */}
        <div className="bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-slate-800/50 shadow-xl">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
            Demo: Unternehmen auswählen (Admin/Test)
          </label>
          {loading ? (
            <div className="h-12 w-full bg-slate-800/50 rounded-xl animate-pulse" />
          ) : (
            <select
              value={selectedCompanyId?.toString() || ""}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedCompanyId(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-700/50 text-slate-200 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none transition-all"
            >
              <option value="">-- Firma auswählen --</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name || "Unbenannte Firma"} {c.city ? `(${c.city})` : ""}
                </option>
              ))}
            </select>
          )}
        </div>

        {selectedCompanyId && (
          <div className="mt-6 text-center space-y-3">
            <button
              onClick={handleOpenPortal}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              Demo-Portal öffnen
            </button>
            <p className="text-xs text-slate-500">
              ⚠️ Nur für Admin/Test-Zwecke – keine Authentifizierung
            </p>
          </div>
        )}

        <div className="mt-12 text-center text-slate-500 text-sm space-y-2">
          <p>
            <Link href="/" className="text-cyan-400 hover:text-cyan-300 transition">
              ← Zurück zur Startseite
            </Link>
          </p>
          <p>
            <Link href="/admin" className="text-slate-400 hover:text-slate-300 transition">
              Admin Dashboard
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}