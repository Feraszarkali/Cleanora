 // app/login/page.tsx
'use client'

import { useState } from 'react'
import { Inter, Poppins } from 'next/font/google'
import { supabase } from '@/lib/supabase/client'

const headingFont = Poppins({
  subsets: ['latin'],
  weight: ['600', '700'],
})

const bodyFont = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    })

    if (error) {
      alert(error.message)
      setLoading(false)
    } else {
      window.location.href = '/dashboard'
    }
  }

  return (
    <main
      className={`${bodyFont.className} flex min-h-screen items-center justify-center px-4 py-10`}
      style={{
        background:
          'radial-gradient(1000px 500px at 10% 0%, rgba(37,99,235,0.14), transparent 60%), radial-gradient(900px 450px at 90% 100%, rgba(20,184,166,0.12), transparent 60%), linear-gradient(180deg, #F8FAFF 0%, #F3F8FF 100%)',
      }}
    >
      <div className="w-full max-w-md">
        <div
          className="rounded-2xl border p-8"
          style={{
            borderColor: 'rgba(148, 163, 184, 0.24)',
            borderRadius: '16px',
            background: 'rgba(255, 255, 255, 0.96)',
            boxShadow: '0 18px 44px rgba(15, 23, 42, 0.10), 0 8px 18px rgba(37, 99, 235, 0.08)',
          }}
        >
          <div className="mb-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Cleanora Admin</p>
            <h1
              className={`${headingFont.className} mt-2 text-3xl font-bold`}
              style={{ color: '#0F172A' }}
            >
              Welcome Back
            </h1>
            <p className="mt-2 text-sm text-slate-500">Sign in to continue to your dashboard</p>
          </div>

          <div className="mb-6 grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-2" style={{ borderRadius: '16px' }}>
            <div className="h-2 rounded-full" style={{ backgroundColor: '#2563EB' }} />
            <div className="h-2 rounded-full" style={{ backgroundColor: '#14B8A6' }} />
            <div className="h-2 rounded-full" style={{ backgroundColor: '#8B5CF6' }} />
          </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border px-4 text-slate-900 transition focus:outline-none"
              style={{
                height: '48px',
                borderRadius: '16px',
                borderColor: 'rgba(148, 163, 184, 0.55)',
                boxShadow: 'inset 0 1px 2px rgba(15, 23, 42, 0.04)',
              }}
              placeholder="name@example.com"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border px-4 text-slate-900 transition focus:outline-none"
              style={{
                height: '48px',
                borderRadius: '16px',
                borderColor: 'rgba(148, 163, 184, 0.55)',
                boxShadow: 'inset 0 1px 2px rgba(15, 23, 42, 0.04)',
              }}
              placeholder="••••••••"
            />
          </div>
          <button
            type="button"
            onClick={handleLogin}
            disabled={loading}
            className={`${headingFont.className} w-full text-white transition disabled:opacity-60`}
            style={{
              height: '48px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #2563EB 0%, #14B8A6 100%)',
              boxShadow: '0 10px 20px rgba(37, 99, 235, 0.25)',
            }}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </div>

          <p className="mt-6 text-center text-xs text-slate-500">Secure admin access for Cleanora operations</p>
        </div>
      </div>
    </main>
  )
}