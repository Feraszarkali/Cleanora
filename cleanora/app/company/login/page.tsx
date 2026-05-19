// app/company/login/page.tsx
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabaseClient"

export default function CompanyLogin(): JSX.Element {
  const router = useRouter()
  const [email, setEmail] = useState<string>("")
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Check if already logged in
  useEffect(() => {
    const storedCompanyId = localStorage.getItem("company_id")
    if (storedCompanyId) {
      router.replace(`/company/${storedCompanyId}`)
    }
  }, [router])

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (!email.trim()) {
      setError("Bitte geben Sie Ihre E-Mail-Adresse ein")
      setLoading(false)
      return
    }

    try {
      // Look up company by email
      const { data, error } = await supabase
        .from("cleaning_companies")
        .select("id, company_name, active")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle()

      if (error) throw error

      if (!data || !data.active) {
        setError("Kein aktives Unternehmen mit dieser E-Mail gefunden")
        setLoading(false)
        return
      }

      // Store company ID in localStorage (as string for safety)
      localStorage.setItem("company_id", String(data.id))
      
      // Redirect to company portal
      router.replace(`/company/${data.id}`)
    } catch (err: unknown) {
      const error = err as Error
      setError(error.message || "Login fehlgeschlagen")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight bg-gradient-to-r from-cyan-400 via-emerald-400 to-violet-500 bg-clip-text text-transparent">
            Firmen-Login
          </h1>
          <p className="mt-2 text-slate-400 text-sm">
            Melden Sie sich mit Ihrer Firmen-E-Mail an
          </p>
        </div>

        <div className="bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-slate-800/50 shadow-xl">
          {error && (
            <div className="mb-4 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                E-Mail-Adresse
              </label>
              <input
                type="email"
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                placeholder="ihre-firma@example.com"
                className="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-700/50 text-slate-200 placeholder-slate-500 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none transition"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-semibold transition shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Wird geprüft...
                </>
              ) : (
                "Anmelden"
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-800/50 text-center">
            <p className="text-slate-400 text-sm">
              Kein Unternehmen?{" "}
              <Link href="/" className="text-cyan-400 hover:text-cyan-300 transition">
                Zurück zur Startseite
              </Link>
            </p>
            <p className="text-slate-500 text-xs mt-2">
              Für Admin-Zugang:{" "}
              <Link href="/admin" className="text-slate-400 hover:text-slate-300 transition">
                Admin Dashboard
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}