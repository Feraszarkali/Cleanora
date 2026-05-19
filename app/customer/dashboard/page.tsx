// app/customer/dashboard/page.tsx
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

// --- Types ---
interface LeadData {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  city: string | null
  services: string | string[] | null
  notes: string | null
  first_date: string | null
  created_at: string | null
}

interface Quote {
  id: string
  lead_id: string
  price: number | null
  status: string
  created_at: string
  lead: LeadData | null
}

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

// --- Helper Functions ---
const formatArrayOrString = (val: string | string[] | null | undefined): string => {
  if (!val) return '-'
  if (Array.isArray(val)) return val.filter(Boolean).join(', ') || '-'
  return val.toString().trim() || '-'
}

const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return '-'
  }
}

const generateId = (): string => Math.random().toString(36).substring(2, 9)

// Safe type guard for nested lead data from Supabase
const parseLeadData = (lead: any): LeadData | null => {
  if (!lead || typeof lead !== 'object') return null
  if (Array.isArray(lead)) {
    if (lead.length === 0) return null
    return parseLeadData(lead[0])
  }
  return {
    id: String(lead.id || ''),
    full_name: lead.full_name ?? null,
    email: lead.email ?? null,
    phone: lead.phone ?? null,
    city: lead.city ?? null,
    services: lead.services ?? null,
    notes: lead.notes ?? null,
    first_date: lead.first_date ?? null,
    created_at: lead.created_at ?? null,
  }
}

// Safe type guard for quote items from Supabase
const parseQuote = (q: any): Quote | null => {
  if (!q) return null
  const lead = parseLeadData(q.lead)
  return {
    id: String(q.id || ''),
    lead_id: String(q.lead_id || ''),
    price: q.price != null ? Number(q.price) : null,
    status: q.status || 'pending',
    created_at: q.created_at || '',
    lead,
  }
}

// --- Main Component ---
export default function CustomerDashboardPage() {
  const router = useRouter()
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [userId, setUserId] = useState<string | null>(null)

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
      } else {
        setUserId(user.id)
      }
    }
    checkAuth()
  }, [router])

  // Fetch quotes for this customer with safe type parsing
  const fetchQuotes = useCallback(async () => {
    if (!userId) return
    
    setLoading(true)
    setError(null)
    
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          id,
          lead_id,
          price,
          status,
          created_at,
          lead:leads (
            id,
            full_name,
            email,
            phone,
            city,
            services,
            notes,
            first_date,
            created_at
          )
        `)
        .eq('lead.customer_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Safely parse and filter quotes with valid lead data
      const validQuotes = (data || [])
        .map(parseQuote)
        .filter((q): q is Quote => q !== null && q.lead !== null)
      
      setQuotes(validQuotes)
    } catch (err: any) {
      setError(err.message || 'Failed to load quotes')
    } finally {
      setLoading(false)
    }
  }, [userId])

  // Initial fetch
  useEffect(() => {
    if (userId) {
      fetchQuotes()
    }
  }, [userId, fetchQuotes])

  // Toast system
  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = generateId()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // Stats - only use properties that actually exist
  const stats = useMemo(() => {
    const total = quotes.length
    const revenue = quotes
      .filter(q => q.status === 'accepted' && q.price)
      .reduce((sum, q) => sum + (q.price || 0), 0)
    return { total, revenue }
  }, [quotes])

  if (loading) {
    return <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">Loading...</div>
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
        <div className="text-red-400">{error}</div>
        <button onClick={fetchQuotes} className="mt-4 px-4 py-2 bg-slate-800 rounded-lg">Retry</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">My Quotes</h1>
          <Link 
            href="/customer/new-request" 
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition"
          >
            + New Request
          </Link>
        </div>

        {/* Stats - only use valid properties */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800">
            <p className="text-xs text-slate-400">Total</p>
            <p className="text-xl font-bold">{stats.total}</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800">
            <p className="text-xs text-slate-400">Accepted</p>
            <p className="text-xl font-bold text-emerald-400">
              {quotes.filter(q => q.status === 'accepted').length}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800">
            <p className="text-xs text-slate-400">Pending</p>
            <p className="text-xl font-bold text-amber-400">
              {quotes.filter(q => q.status === 'pending').length}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800">
            <p className="text-xs text-slate-400">Revenue</p>
            <p className="text-xl font-bold text-cyan-400">{(stats.revenue || 0).toFixed(0)}€</p>
          </div>
        </div>

        {/* Quotes List */}
        {quotes.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            No quotes yet. Create your first cleaning request.
          </div>
        ) : (
          <div className="space-y-4">
            {quotes.map((quote) => {
              if (!quote.lead) return null
              return (
                <div key={quote.id} className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{quote.lead.full_name || 'Unnamed Request'}</h3>
                      <p className="text-sm text-slate-400">{quote.lead.city || 'Unknown city'}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Services: {formatArrayOrString(quote.lead.services)}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      quote.status === 'pending' ? 'bg-amber-500/10 text-amber-400' :
                      quote.status === 'accepted' ? 'bg-emerald-500/10 text-emerald-400' :
                      quote.status === 'rejected' ? 'bg-red-500/10 text-red-400' :
                      'bg-slate-700 text-slate-300'
                    }`}>
                      {quote.status}
                    </span>
                  </div>
                  {quote.price != null && (
                    <p className="mt-2 text-emerald-400 font-semibold">{quote.price.toFixed(2)} €</p>
                  )}
                  {quote.lead.first_date && (
                    <p className="text-xs text-slate-500 mt-1">
                      Requested: {formatDate(quote.lead.first_date)}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-xl border shadow-lg backdrop-blur-md ${
              toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' :
              toast.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-300' :
              'bg-slate-800/80 border-slate-700 text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{toast.message}</span>
              <button onClick={() => removeToast(toast.id)} className="text-lg hover:opacity-70">×</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}