'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (password !== confirmPassword) {
      setError('Die Passwörter stimmen nicht überein.')
      return
    }

    if (password.length < 6) {
      setError('Das Passwort muss mindestens 6 Zeichen lang sein.')
      return
    }

    setLoading(true)

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (signUpError) {
        setError(signUpError.message)
        setLoading(false)
        return
      }

      setSuccess('Registrierung erfolgreich! Sie werden zur Anmeldung weitergeleitet.')
      setTimeout(() => router.push('/login'), 1500)
    } catch {
      setError('Ein unerwarteter Fehler ist aufgetreten.')
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <span className="text-2xl font-bold text-white">C</span>
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">Account erstellen</h2>
          <p className="mt-2 text-sm text-gray-500">Registrieren Sie sich bei Cleanora</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6 bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
          {error && (
            <div className="rounded-lg bg-red-50 p-4 border border-red-200">
              <p className="text-sm font-medium text-red-700">{error}</p>
            </div>
          )}
          {success && (
            <div className="rounded-lg bg-green-50 p-4 border border-green-200">
              <p className="text-sm font-medium text-green-700">{success}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">E-Mail-Adresse</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed transition bg-white text-gray-900"
                placeholder="name@unternehmen.de"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">Passwort</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed transition bg-white text-gray-900"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700">Passwort bestätigen</label>
              <input
                id="confirm-password"
                name="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed transition bg-white text-gray-900"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full justify-center rounded-lg border border-transparent bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Wird registriert...
              </span>
            ) : 'Registrieren'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600">
          Bereits ein Account?{' '}
          <a href="/login" className="font-medium text-blue-600 hover:text-blue-500 hover:underline">
            Anmelden
          </a>
        </p>
      </div>
    </main>
  )
}