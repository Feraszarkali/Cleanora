// app/admin/leads/page.tsx
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

interface Lead {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  city: string | null
  services: string[] | string | null
  status: string
  created_at: string
  company_id: number | null
  archived: boolean
}

interface Quote {
  id: string
  lead_id: string
  company_id: number
  company_name: string
  price: number | null
  status: string
  created_at: string
}

interface Company {
  id: number
  company_name: string | null
  city: string | null
  services: string[] | string | null
  active: boolean
}

export default function AdminLeadsPage() {
  const router = useRouter()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loadingQuotes, setLoadingQuotes] = useState(false)
  const [loadingCompanies, setLoadingCompanies] = useState(false)
  const [modalTab, setModalTab] = useState<'details' | 'quotes'>('details')

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setLeads(data || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load leads')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchCompanies = useCallback(async () => {
    setLoadingCompanies(true)
    try {
      const { data, error } = await supabase
        .from('cleaning_companies')
        .select('id, company_name, city, services, active')
        .eq('active', true)
        .order('company_name')
      if (error) throw error
      setCompanies(data || [])
    } catch (err: any) {
      console.error('Failed to fetch companies:', err)
    } finally {
      setLoadingCompanies(false)
    }
  }, [])

  const fetchQuotes = useCallback(async (leadId: string) => {
    setLoadingQuotes(true)
    try {
      // Fetch all quotes for this lead with company names
      const { data: quotesData, error: quotesError } = await supabase
        .from('quotes')
        .select('id, lead_id, company_id, price, status, created_at')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })

      if (quotesError) throw quotesError

      // Fetch company names for each quote
      const quotesWithCompany = await Promise.all(
        (quotesData || []).map(async (q: any) => {
          const { data: company, error: companyError } = await supabase
            .from('cleaning_companies')
            .select('company_name')
            .eq('id', q.company_id)
            .single()
          
          if (companyError) {
            console.error('Failed to fetch company:', companyError)
            return { ...q, company_name: 'Unknown' }
          }
          return { ...q, company_name: company?.company_name || 'Unknown' }
        })
      )

      setQuotes(quotesWithCompany)
    } catch (err: any) {
      console.error('Failed to fetch quotes:', err)
      setError(err.message || 'Failed to load quotes')
    } finally {
      setLoadingQuotes(false)
    }
  }, [])

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
      } else {
        fetchLeads()
        fetchCompanies()
      }
    }
    checkAuth()
  }, [router, fetchLeads, fetchCompanies])

  useEffect(() => {
    if (selectedLead) {
      fetchQuotes(selectedLead.id)
      setModalTab('details')
    }
  }, [selectedLead, fetchQuotes])

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchesSearch = !search || 
        lead.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        lead.email?.toLowerCase().includes(search.toLowerCase()) ||
        lead.city?.toLowerCase().includes(search.toLowerCase())
      const matchesStatus = statusFilter === 'all' || lead.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [leads, search, statusFilter])

  // Get matching companies for a lead (by city and services)
  const getMatchingCompanies = useCallback((lead: Lead): Company[] => {
    if (!lead.city) return []
    const leadServices = Array.isArray(lead.services) ? lead.services : (lead.services ? [lead.services] : [])
    return companies.filter((c) => {
      const companyServices = Array.isArray(c.services) ? c.services : (c.services ? [c.services] : [])
      const matchesCity = c.city?.toLowerCase() === lead.city?.toLowerCase()
      const matchesService = leadServices.length === 0 || leadServices.some((s) => 
        companyServices.some((cs) => cs.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(cs.toLowerCase()))
      )
      return matchesCity && matchesService
    })
  }, [companies])

  // Check if a company already has a quote for this lead
  const hasQuoteForCompany = useCallback((companyId: number, quotes: Quote[]): boolean => {
    return quotes.some((q) => q.company_id === companyId)
  }, [])

  // Create a new quote request for a company
  const handleCreateQuote = useCallback(async (companyId: number) => {
    if (!selectedLead) return
    try {
      const { error } = await supabase
        .from('quotes')
        .insert({
          lead_id: selectedLead.id,
          company_id: companyId,
          price: null,
          status: 'pending',
        })
      if (error) throw error
      // Refresh quotes
      await fetchQuotes(selectedLead.id)
    } catch (err: any) {
      console.error('Failed to create quote:', err)
      setError(err.message || 'Failed to send request')
    }
  }, [selectedLead, fetchQuotes])

  // Update quote price/status
  const handleUpdateQuote = useCallback(async (quoteId: string, updates: { price?: number | null; status?: string }) => {
    if (!selectedLead) return
    try {
      const { error } = await supabase
        .from('quotes')
        .update(updates)
        .eq('id', quoteId)
      if (error) throw error
      // Refresh quotes
      await fetchQuotes(selectedLead.id)
    } catch (err: any) {
      console.error('Failed to update quote:', err)
      setError(err.message || 'Failed to update quote')
    }
  }, [selectedLead, fetchQuotes])

  if (loading) {
    return <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent">
            Admin Leads
          </h1>
          <div className="flex gap-2">
            <Link href="/admin" className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-medium transition">
              ← Dashboard
            </Link>
            <button 
              onClick={fetchLeads}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition"
            >
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:outline-none transition text-sm"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:outline-none transition text-sm"
          >
            <option value="all">All Status</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="quote_sent">Quote Sent</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-800/50 text-slate-400 uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-6 py-4 font-medium">Name</th>
                  <th className="px-6 py-4 font-medium">Email</th>
                  <th className="px-6 py-4 font-medium hidden md:table-cell">Phone</th>
                  <th className="px-6 py-4 font-medium hidden md:table-cell">City</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium hidden lg:table-cell">Created</th>
                  <th className="px-6 py-4 font-medium w-24">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredLeads.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-500">No leads found.</td></tr>
                ) : (
                  filteredLeads.map((lead) => (
                    <tr 
                      key={lead.id} 
                      className="hover:bg-slate-800/30 transition cursor-pointer"
                      onClick={() => setSelectedLead(lead)}
                    >
                      <td className="px-6 py-4 font-medium text-slate-200">{lead.full_name || '-'}</td>
                      <td className="px-6 py-4 text-slate-300">{lead.email || '-'}</td>
                      <td className="px-6 py-4 text-slate-300 hidden md:table-cell">{lead.phone || '-'}</td>
                      <td className="px-6 py-4 text-slate-300 hidden md:table-cell">{lead.city || '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          lead.status === 'new' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                          lead.status === 'contacted' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' :
                          lead.status === 'quote_sent' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                          lead.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                          'bg-red-500/10 text-red-400 border-red-500/30'
                        }`}>
                          {lead.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400 hidden lg:table-cell whitespace-nowrap">
                        {new Date(lead.created_at).toLocaleDateString('de-DE')}
                      </td>
                      <td className="px-6 py-4">
                        <button className="text-emerald-400 hover:text-emerald-300 text-xs font-semibold">View</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Lead Detail Modal */}
        {selectedLead && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" onClick={(e) => e.target === e.currentTarget && setSelectedLead(null)}>
            <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl">
              <div className="p-6 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-slate-900/95 backdrop-blur z-10">
                <h2 className="text-2xl font-bold text-white">{selectedLead.full_name}</h2>
                <button onClick={() => setSelectedLead(null)} className="text-slate-400 hover:text-white text-2xl">×</button>
              </div>

              <div className="flex gap-2 p-6 pb-2 border-b border-slate-800">
                <button 
                  onClick={() => setModalTab('details')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${modalTab === 'details' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Details
                </button>
                <button 
                  onClick={() => setModalTab('quotes')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${modalTab === 'quotes' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Firmen & Angebote ({quotes.length})
                </button>
              </div>

              <div className="p-6">
                {modalTab === 'details' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-200 mb-4">Customer Info</h3>
                      <div className="space-y-3 text-sm">
                        <div><span className="text-slate-400">Email:</span> <span className="text-slate-200">{selectedLead.email || '-'}</span></div>
                        <div><span className="text-slate-400">Phone:</span> <span className="text-slate-200">{selectedLead.phone || '-'}</span></div>
                        <div><span className="text-slate-400">City:</span> <span className="text-slate-200">{selectedLead.city || '-'}</span></div>
                        <div><span className="text-slate-400">Services:</span> <span className="text-slate-200">{Array.isArray(selectedLead.services) ? selectedLead.services.join(', ') : selectedLead.services || '-'}</span></div>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-200 mb-4">Actions</h3>
                      <div className="space-y-3">
                        <select 
                          value={selectedLead.status}
                          onChange={(e) => {
                            // Update lead status logic here
                            setSelectedLead({ ...selectedLead, status: e.target.value })
                          }}
                          className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm"
                        >
                          <option value="new">New</option>
                          <option value="contacted">Contacted</option>
                          <option value="quote_sent">Quote Sent</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                        <button className="w-full px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition">
                          Save Changes
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Matching Companies Section - Show companies that can be requested */}
                    <div>
                      <h3 className="text-lg font-semibold text-emerald-400 mb-4">Matching Companies ({getMatchingCompanies(selectedLead).length})</h3>
                      <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                        {getMatchingCompanies(selectedLead).length === 0 ? (
                          <p className="text-slate-500 text-sm italic">No matching companies found.</p>
                        ) : (
                          getMatchingCompanies(selectedLead).map((company) => {
                            const hasQuote = hasQuoteForCompany(company.id, quotes)
                            const existingQuote = quotes.find((q) => q.company_id === company.id)
                            return (
                              <div key={company.id} className="p-4 bg-slate-800/40 rounded-xl border border-slate-700 flex justify-between items-start gap-3">
                                <div>
                                  <p className="font-semibold text-slate-200">{company.company_name}</p>
                                  <p className="text-xs text-slate-400 mt-1">{company.city} • {Array.isArray(company.services) ? company.services.slice(0, 2).join(', ') : ''}</p>
                                  {hasQuote && existingQuote && (
                                    <p className="text-xs text-amber-400 mt-1">
                                      Status: {existingQuote.status} • {existingQuote.price != null ? `${existingQuote.price.toFixed(2)}€` : 'Wartet auf Angebot'}
                                    </p>
                                  )}
                                </div>
                                {!hasQuote ? (
                                  <button 
                                    onClick={() => handleCreateQuote(company.id)}
                                    className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-medium transition whitespace-nowrap"
                                  >
                                    Anfrage senden
                                  </button>
                                ) : (
                                  <span className="px-2 py-1 bg-slate-700 text-slate-300 text-xs rounded">Gesendet</span>
                                )}
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>

                    {/* All Quotes Section - Show ALL quotes for this lead, including pending with null price */}
                    <div>
                      <h3 className="text-lg font-semibold text-blue-400 mb-4">All Quotes & Requests</h3>
                      {loadingQuotes ? (
                        <p className="text-slate-500 text-sm">Loading quotes...</p>
                      ) : quotes.length === 0 ? (
                        <p className="text-slate-500 text-sm italic">No quotes or requests yet.</p>
                      ) : (
                        <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                          {quotes.map((quote) => (
                            <div key={quote.id} className="p-4 bg-slate-800/40 rounded-xl border border-slate-700">
                              <div className="flex justify-between items-start gap-3">
                                <div className="flex-1">
                                  <p className="font-semibold text-slate-200">{quote.company_name}</p>
                                  <p className="text-xs text-slate-400 mt-1">
                                    Status: <span className={`font-medium ${
                                      quote.status === 'pending' ? 'text-amber-400' :
                                      quote.status === 'accepted' ? 'text-emerald-400' :
                                      quote.status === 'rejected' ? 'text-red-400' :
                                      'text-blue-400'
                                    }`}>{quote.status}</span>
                                    {' • '}
                                    {quote.price != null ? (
                                      <span className="text-emerald-400">{quote.price.toFixed(2)}€</span>
                                    ) : (
                                      <span className="text-slate-500">Wartet auf Angebot</span>
                                    )}
                                  </p>
                                </div>
                                <div className="flex flex-col gap-1 items-end">
                                  {quote.price == null && quote.status === 'pending' && (
                                    <input
                                      type="number"
                                      placeholder="Preis"
                                      className="w-24 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-slate-200"
                                      onBlur={(e) => {
                                        const price = parseFloat(e.target.value)
                                        if (!isNaN(price)) {
                                          handleUpdateQuote(quote.id, { price })
                                        }
                                      }}
                                    />
                                  )}
                                  <select
                                    value={quote.status}
                                    onChange={(e) => handleUpdateQuote(quote.id, { status: e.target.value })}
                                    className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-slate-200"
                                  >
                                    <option value="pending">Pending</option>
                                    <option value="accepted">Accepted</option>
                                    <option value="rejected">Rejected</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}