// app/company/dashboard/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Quote, QuoteStatus } from '@/lib/types/marketplace'

export default function CompanyDashboard() {
  const router = useRouter()
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingQuoteId, setUpdatingQuoteId] = useState<string | null>(null)

  // Fetch quotes for logged-in company
  useEffect(() => {
    const fetchQuotes = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // In production: get company_id from auth session
        // For MVP: assume company is identified via localStorage or query param
        const storedCompanyId = localStorage.getItem('company_id')
        if (!storedCompanyId) {
          router.push('/company/login')
          return
        }
        
        const { data, error } = await supabase
          .from('quotes')
          .select(`
            *,
            lead:leads(full_name, city, service_type, rooms, bathrooms, square_meters, preferred_date, preferred_time, notes)
          `)
          .eq('company_id', storedCompanyId)
          .order('created_at', { ascending: false })
        
        if (error) throw error
        setQuotes(data || [])
      } catch (err: unknown) {
        const e = err as Error
        setError(e.message || 'Failed to load quotes')
      } finally {
        setLoading(false)
      }
    }
    
    fetchQuotes()
  }, [router])

  const handleUpdateStatus = async (quoteId: string, newStatus: QuoteStatus) => {
    setUpdatingQuoteId(quoteId)
    try {
      const { error } = await supabase
        .from('quotes')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', quoteId)
      
      if (error) throw error
      
      // Update local state
      setQuotes(prev => prev.map(q => 
        q.id === quoteId ? { ...q, status: newStatus } : q
      ))
      
      // Show feedback
      alert(`Angebot ${newStatus === 'accepted' ? 'angenommen' : 'abgelehnt'}`)
    } catch (err: unknown) {
      const e = err as Error
      alert(`Fehler: ${e.message}`)
    } finally {
      setUpdatingQuoteId(null)
    }
  }

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
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
            Angebotsanfragen
          </h1>
          <p className="text-slate-400 mt-1">Verwalten Sie Ihre Reinigungsaufträge</p>
        </header>

        {quotes.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/50 rounded-2xl border border-slate-800">
            <p className="text-slate-400">Noch keine Angebotsanfragen vorhanden.</p>
            <p className="text-slate-500 text-sm mt-2">Neue Anfragen erscheinen hier automatisch.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {quotes.map((quote) => {
              const lead = quote.lead as any
              return (
                <div 
                  key={quote.id} 
                  className="bg-slate-900/50 rounded-xl border border-slate-800 p-6 hover:border-cyan-500/30 transition"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">{lead?.full_name || 'Unbekannter Kunde'}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          quote.status === 'pending' ? 'bg-amber-500/10 text-amber-400' :
                          quote.status === 'accepted' ? 'bg-emerald-500/10 text-emerald-400' :
                          quote.status === 'rejected' ? 'bg-red-500/10 text-red-400' :
                          'bg-slate-500/10 text-slate-400'
                        }`}>
                          {quote.status === 'pending' ? 'Ausstehend' :
                           quote.status === 'accepted' ? 'Angenommen' :
                           quote.status === 'rejected' ? 'Abgelehnt' : 'Abgelaufen'}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-slate-300 mb-4">
                        <div><span className="text-slate-500">Stadt:</span> {lead?.city}</div>
                        <div><span className="text-slate-500">Service:</span> {lead?.service_type}</div>
                        <div><span className="text-slate-500">Zimmer:</span> {lead?.rooms || '-'}</div>
                        <div><span className="text-slate-500">Bäder:</span> {lead?.bathrooms || '-'}</div>
                        {lead?.square_meters && <div><span className="text-slate-500">Fläche:</span> {lead.square_meters} m²</div>}
                        {lead?.preferred_date && <div><span className="text-slate-500">Datum:</span> {lead.preferred_date}</div>}
                      </div>
                      
                      {lead?.notes && (
                        <p className="text-sm text-slate-400 bg-slate-800/50 p-3 rounded-lg">
                          <span className="text-slate-500">Notizen:</span> {lead.notes}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex flex-col items-end gap-3">
                      <div className="text-right">
                        <p className="text-sm text-slate-400">Geschätzter Preis</p>
                        <p className="text-2xl font-bold text-emerald-400">
                          {quote.proposed_price ? `${quote.proposed_price.toFixed(2)} €` : '—'}
                        </p>
                      </div>
                      
                      {quote.status === 'pending' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdateStatus(quote.id, 'accepted')}
                            disabled={updatingQuoteId === quote.id}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 text-white rounded-lg text-sm font-medium transition"
                          >
                            {updatingQuoteId === quote.id ? '...' : 'Annehmen'}
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(quote.id, 'rejected')}
                            disabled={updatingQuoteId === quote.id}
                            className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-600/50 text-white rounded-lg text-sm font-medium transition"
                          >
                            {updatingQuoteId === quote.id ? '...' : 'Ablehnen'}
                          </button>
                        </div>
                      )}
                      
                      {quote.status !== 'pending' && (
                        <p className="text-xs text-slate-500">
                          {quote.status === 'accepted' ? '✓ Angenommen' : '✗ Abgelehnt'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}