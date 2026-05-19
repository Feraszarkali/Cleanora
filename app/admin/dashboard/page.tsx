// app/admin/dashboard/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Lead, Quote, Company } from '@/lib/types/marketplace'

interface Stats {
  totalLeads: number
  pendingQuotes: number
  acceptedQuotes: number
  activeCompanies: number
  estimatedGMV: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalLeads: 0,
    pendingQuotes: 0,
    acceptedQuotes: 0,
    activeCompanies: 0,
    estimatedGMV: 0,
  })
  const [recentLeads, setRecentLeads] = useState<Lead[]>([])
  const [recentQuotes, setRecentQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Fetch stats
        const [leadsRes, quotesRes, companiesRes] = await Promise.all([
          supabase.from('leads').select('id, estimated_price, status', { count: 'exact' }),
          supabase.from('quotes').select('id, proposed_price, status', { count: 'exact' }),
          supabase.from('companies').select('id', { count: 'exact' }).eq('active', true),
        ])
        
        if (leadsRes.error) throw leadsRes.error
        if (quotesRes.error) throw quotesRes.error
        if (companiesRes.error) throw companiesRes.error
        
        const totalLeads = leadsRes.count || 0
        const pendingQuotes = quotesRes.data?.filter(q => q.status === 'pending').length || 0
        const acceptedQuotes = quotesRes.data?.filter(q => q.status === 'accepted').length || 0
        const activeCompanies = companiesRes.count || 0
        const estimatedGMV = quotesRes.data
          ?.filter(q => q.status === 'accepted' && q.proposed_price)
          .reduce((sum, q) => sum + (q.proposed_price || 0), 0) || 0
        
        setStats({ totalLeads, pendingQuotes, acceptedQuotes, activeCompanies, estimatedGMV })
        
        // Fetch recent leads and quotes
        const [leadsData, quotesData] = await Promise.all([
          supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(10),
          supabase.from('quotes').select(`
            *,
            company:companies(company_name),
            lead:leads(full_name, city)
          `).order('created_at', { ascending: false }).limit(10),
        ])
        
        if (leadsData.error) throw leadsData.error
        if (quotesData.error) throw quotesData.error
        
        setRecentLeads(leadsData.data || [])
        setRecentQuotes(quotesData.data || [])
        
      } catch (err: unknown) {
        const e = err as Error
        setError(e.message || 'Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-cyan-500 border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg"
          >
            Erneut versuchen
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
            Admin Dashboard
          </h1>
          <p className="text-slate-400 mt-1">Übersicht über den Marktplatz</p>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {[
            { label: 'Gesamte Anfragen', value: stats.totalLeads, color: 'from-slate-600 to-slate-700' },
            { label: 'Ausstehende Angebote', value: stats.pendingQuotes, color: 'from-amber-500 to-amber-600' },
            { label: 'Angenommene Angebote', value: stats.acceptedQuotes, color: 'from-emerald-500 to-emerald-600' },
            { label: 'Aktive Firmen', value: stats.activeCompanies, color: 'from-blue-500 to-blue-600' },
            { label: 'Geschätzter Umsatz', value: `${stats.estimatedGMV.toFixed(0)}€`, color: 'from-violet-500 to-violet-600' },
          ].map((stat) => (
            <div key={stat.label} className="bg-slate-900/50 rounded-xl border border-slate-800 p-4">
              <p className="text-xs text-slate-400 uppercase tracking-wider">{stat.label}</p>
              <p className={`text-2xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent mt-1`}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Recent Leads & Quotes */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Recent Leads */}
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-6">
            <h3 className="font-semibold text-lg mb-4">Neueste Anfragen</h3>
            <div className="space-y-3">
              {recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="text-slate-200">{lead.full_name}</p>
                    <p className="text-slate-500 text-xs">{lead.city} • {lead.service_type}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    lead.status === 'new' ? 'bg-slate-500/10 text-slate-400' :
                    lead.status === 'matched' ? 'bg-blue-500/10 text-blue-400' :
                    lead.status === 'booked' ? 'bg-emerald-500/10 text-emerald-400' :
                    'bg-slate-500/10 text-slate-400'
                  }`}>
                    {lead.status}
                  </span>
                </div>
              ))}
              {recentLeads.length === 0 && <p className="text-slate-500 text-sm">Keine Anfragen vorhanden.</p>}
            </div>
          </div>

          {/* Recent Quotes */}
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-6">
            <h3 className="font-semibold text-lg mb-4">Neueste Angebote</h3>
            <div className="space-y-3">
              {recentQuotes.map((quote: any) => (
                <div key={quote.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="text-slate-200">{quote.company?.company_name}</p>
                    <p className="text-slate-500 text-xs">{quote.lead?.full_name} • {quote.lead?.city}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-emerald-400 font-medium">
                      {quote.proposed_price ? `${quote.proposed_price.toFixed(2)} €` : '—'}
                    </p>
                    <span className={`text-xs ${
                      quote.status === 'pending' ? 'text-amber-400' :
                      quote.status === 'accepted' ? 'text-emerald-400' :
                      'text-red-400'
                    }`}>
                      {quote.status}
                    </span>
                  </div>
                </div>
              ))}
              {recentQuotes.length === 0 && <p className="text-slate-500 text-sm">Keine Angebote vorhanden.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}