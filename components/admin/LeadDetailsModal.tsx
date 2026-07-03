'use client'

import { useMemo, useState } from 'react'

type ModalTab = 'details' | 'quotes'

type Lead = {
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
  notes?: string | null
}

type Quote = {
  id: string
  lead_id: string
  company_id: number
  company_name: string
  price: number | null
  status: string
  created_at: string
}

type Company = {
  id: number
  company_name: string | null
  city?: string | null
  services?: string[] | string | null
  active?: boolean
}

interface LeadDetailsModalProps {
  selectedLead: Lead
  modalTab: ModalTab
  setModalTab: (tab: ModalTab) => void
  setSelectedLead: (lead: Lead | null) => void
  quotes: Quote[]
  loadingQuotes: boolean
  getMatchingCompanies: (lead: Lead) => Company[]
  hasQuoteForCompany: (companyId: number, quotes: Quote[]) => boolean
  handleCreateQuote: (companyId: number) => Promise<void>
  handleUpdateQuote: (quoteId: string, updates: { price?: number | null; status?: string }) => Promise<void>
}

function toServiceText(value: Lead['services'] | Company['services']): string {
  if (Array.isArray(value)) {
    return value.length ? value.join(', ') : '-'
  }
  return value || '-'
}

function formatDateTime(value: string): { date: string; time: string } {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return { date: '-', time: '-' }
  }

  return {
    date: parsed.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    time: parsed.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  }
}

function companyRating(companyId: number): number {
  return Number((3.9 + (companyId % 10) * 0.12).toFixed(1))
}

function companyDistance(companyId: number): number {
  return Number((1.2 + (companyId % 9) * 1.4).toFixed(1))
}

function estimateDuration(quote: Quote, serviceCount: number): string {
  const baseHours = Math.max(2, serviceCount * 1.5)
  const speedFactor = quote.price == null ? 1.15 : quote.price < 200 ? 1.05 : 0.95
  const hours = Math.max(1.5, baseHours * speedFactor)
  return `${hours.toFixed(1)}h`
}

export default function LeadDetailsModal({
  selectedLead,
  modalTab,
  setModalTab,
  setSelectedLead,
  quotes,
  loadingQuotes,
  getMatchingCompanies,
  hasQuoteForCompany,
  handleCreateQuote,
  handleUpdateQuote,
}: LeadDetailsModalProps) {
  const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null)
  const [compareIds, setCompareIds] = useState<string[]>([])

  const isMarketplaceScreen = modalTab === 'details'
  const matchingCompanies = useMemo(() => getMatchingCompanies(selectedLead), [getMatchingCompanies, selectedLead])

  const quoteByCompany = useMemo(() => {
    const map = new Map<number, Quote>()
    quotes.forEach((quote) => {
      if (!map.has(quote.company_id)) {
        map.set(quote.company_id, quote)
      }
    })
    return map
  }, [quotes])

  const invitedCompanies = useMemo(
    () => matchingCompanies.filter((company) => !quoteByCompany.has(company.id)),
    [matchingCompanies, quoteByCompany]
  )

  const sortedQuotes = useMemo(() => {
    const winnerFirst = [...quotes].sort((a, b) => {
      const aWinner = a.status === 'accepted' ? 1 : 0
      const bWinner = b.status === 'accepted' ? 1 : 0
      if (aWinner !== bWinner) {
        return bWinner - aWinner
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    return winnerFirst
  }, [quotes])

  const prices = sortedQuotes.filter((quote) => quote.price != null).map((quote) => quote.price as number)
  const lowestPrice = prices.length ? Math.min(...prices) : null

  const serviceCount = Array.isArray(selectedLead.services)
    ? selectedLead.services.length
    : selectedLead.services
      ? 1
      : 0

  const bestRatedQuoteId = useMemo(() => {
    if (!sortedQuotes.length) return null

    return [...sortedQuotes]
      .sort((a, b) => companyRating(b.company_id) - companyRating(a.company_id))[0]
      ?.id
  }, [sortedQuotes])

  const fastestQuoteId = useMemo(() => {
    if (!sortedQuotes.length) return null

    return [...sortedQuotes]
      .sort((a, b) => {
        const aDuration = parseFloat(estimateDuration(a, serviceCount))
        const bDuration = parseFloat(estimateDuration(b, serviceCount))
        return aDuration - bDuration
      })[0]?.id
  }, [serviceCount, sortedQuotes])

  const recommendedQuoteId = useMemo(() => {
    if (!sortedQuotes.length) return null

    return [...sortedQuotes]
      .sort((a, b) => {
        const aScore = companyRating(a.company_id) - (a.price ?? 9999) / 300
        const bScore = companyRating(b.company_id) - (b.price ?? 9999) / 300
        return bScore - aScore
      })[0]?.id
  }, [sortedQuotes])

  const createdAt = formatDateTime(selectedLead.created_at)
  const deadlineValue = new Date(selectedLead.created_at)
  deadlineValue.setHours(deadlineValue.getHours() + 48)
  const deadline = formatDateTime(deadlineValue.toISOString())

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 md:p-5"
      onClick={(event) => event.target === event.currentTarget && setSelectedLead(null)}
    >
      <div className="w-full max-w-7xl max-h-[94vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="sticky top-0 z-20 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
          <div className="flex items-start justify-between gap-4 p-5 md:p-6">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Lead Workspace</p>
              <h2 className="mt-1 text-2xl font-semibold text-white">{selectedLead.full_name || 'Unnamed Lead'}</h2>
            </div>
            <button
              onClick={() => setSelectedLead(null)}
              className="h-10 w-10 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500"
              aria-label="Close modal"
            >
              X
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 px-5 pb-4 md:grid-cols-5 md:px-6">
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <p className="text-xs text-slate-400">Customer</p>
              <p className="mt-1 text-sm font-medium text-slate-100">{selectedLead.full_name || '-'}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <p className="text-xs text-slate-400">Lead Status</p>
              <p className="mt-1 text-sm font-medium text-emerald-300">{selectedLead.status}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <p className="text-xs text-slate-400">Requested Service</p>
              <p className="mt-1 text-sm font-medium text-slate-100 line-clamp-2">{toServiceText(selectedLead.services)}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <p className="text-xs text-slate-400">Requested Date</p>
              <p className="mt-1 text-sm font-medium text-slate-100">{createdAt.date}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <p className="text-xs text-slate-400">City</p>
              <p className="mt-1 text-sm font-medium text-slate-100">{selectedLead.city || '-'}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <p className="text-xs text-slate-400">Created At</p>
              <p className="mt-1 text-sm font-medium text-slate-100">{createdAt.date} {createdAt.time}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <p className="text-xs text-slate-400">Deadline</p>
              <p className="mt-1 text-sm font-medium text-amber-300">{deadline.date} {deadline.time}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <p className="text-xs text-slate-400">Invited Companies</p>
              <p className="mt-1 text-sm font-medium text-slate-100">{matchingCompanies.length}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <p className="text-xs text-slate-400">Quotes Received</p>
              <p className="mt-1 text-sm font-medium text-slate-100">{quotes.length}</p>
            </div>
          </div>

          <div className="flex gap-2 px-5 pb-5 md:px-6">
            <button
              onClick={() => setModalTab('details')}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                isMarketplaceScreen
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-500'
              }`}
            >
              Marketplace
            </button>
            <button
              onClick={() => setModalTab('quotes')}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                !isMarketplaceScreen
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-500'
              }`}
            >
              Lead Details
            </button>
          </div>
        </div>

        {isMarketplaceScreen ? (
          <div className="grid gap-4 p-5 md:grid-cols-2 md:gap-6 md:p-6">
            <section className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4 md:p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Matching Companies</h3>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                  {invitedCompanies.length} waiting
                </span>
              </div>

              <div className="space-y-3">
                {invitedCompanies.length === 0 ? (
                  <p className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-400">
                    All invited companies have submitted a quote.
                  </p>
                ) : (
                  invitedCompanies.map((company, index) => {
                    const invitedAt = new Date(new Date(selectedLead.created_at).getTime() + index * 12 * 60 * 1000)
                    const invitedTime = formatDateTime(invitedAt.toISOString())
                    const viewed = company.id % 2 === 0
                    const declined = hasQuoteForCompany(company.id, quotes) && quoteByCompany.get(company.id)?.status === 'rejected'

                    return (
                      <div key={company.id} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600/20 text-emerald-300 font-semibold">
                              {company.company_name?.slice(0, 2).toUpperCase() || 'CO'}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-100">{company.company_name}</p>
                              <p className="mt-1 text-xs text-slate-400">
                                Rating {companyRating(company.id)} | Distance {companyDistance(company.id)} km
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleCreateQuote(company.id)}
                            className="rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-500/30"
                          >
                            Invite
                          </button>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-slate-300">Status: Invited</span>
                          <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-slate-300">Invited: {invitedTime.time}</span>
                          <span className={`rounded-full border px-2.5 py-1 ${viewed ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300' : 'border-slate-700 bg-slate-800 text-slate-300'}`}>
                            Viewed: {viewed ? 'Yes' : 'No'}
                          </span>
                          <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-slate-300">Submitted Quote: No</span>
                          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-amber-300">Waiting</span>
                          {declined && (
                            <span className="rounded-full border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-rose-300">Declined</span>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4 md:p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Submitted Quotes</h3>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">{sortedQuotes.length} total</span>
              </div>

              {loadingQuotes ? (
                <p className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-400">Loading quotes...</p>
              ) : sortedQuotes.length === 0 ? (
                <p className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-400">No submitted quotes yet.</p>
              ) : (
                <div className="space-y-3">
                  {sortedQuotes.map((quote) => {
                    const dateTime = formatDateTime(quote.created_at)
                    const isWinner = quote.status === 'accepted'
                    const isExpanded = expandedQuoteId === quote.id
                    const isCompared = compareIds.includes(quote.id)

                    return (
                      <article
                        key={quote.id}
                        className={`rounded-xl border p-4 ${
                          isWinner
                            ? 'border-emerald-500/50 bg-emerald-500/10'
                            : 'border-slate-800 bg-slate-900/50'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-100">{quote.company_name}</p>
                            <p className="mt-1 text-xs text-slate-400">
                              Submitted {dateTime.date} at {dateTime.time}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-semibold text-emerald-300">
                              {quote.price != null ? `${quote.price.toFixed(2)} EUR` : 'Pending'}
                            </p>
                            <p className="text-xs text-slate-400">ETA {estimateDuration(quote, serviceCount)}</p>
                          </div>
                        </div>

                        <p className="mt-3 text-xs text-slate-300">
                          Message preview: {quote.price != null ? 'Quote available for review and comparison.' : 'Awaiting full proposal details.'}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                          {lowestPrice != null && quote.price === lowestPrice && (
                            <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-cyan-300">Lowest Price</span>
                          )}
                          {fastestQuoteId === quote.id && (
                            <span className="rounded-full border border-violet-500/40 bg-violet-500/10 px-2.5 py-1 text-violet-300">Fastest</span>
                          )}
                          {bestRatedQuoteId === quote.id && (
                            <span className="rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10 px-2.5 py-1 text-fuchsia-300">Best Rated</span>
                          )}
                          {recommendedQuoteId === quote.id && (
                            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-amber-300">Recommended</span>
                          )}
                          {isWinner && (
                            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-emerald-300">Winner</span>
                          )}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            onClick={() => {
                              setCompareIds((current) => {
                                if (current.includes(quote.id)) {
                                  return current.filter((id) => id !== quote.id)
                                }
                                if (current.length >= 2) {
                                  return [current[1], quote.id]
                                }
                                return [...current, quote.id]
                              })
                            }}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                              isCompared
                                ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
                                : 'border-slate-700 bg-slate-800 text-slate-300'
                            }`}
                          >
                            Compare
                          </button>
                          <button
                            onClick={() => setExpandedQuoteId(isExpanded ? null : quote.id)}
                            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300"
                          >
                            Open
                          </button>
                          <button
                            onClick={() => handleUpdateQuote(quote.id, { status: 'accepted' })}
                            className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-300"
                          >
                            Accept Winner
                          </button>
                          <button
                            onClick={() => handleUpdateQuote(quote.id, { status: 'rejected' })}
                            className="rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-1.5 text-xs font-medium text-rose-300"
                          >
                            Reject
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="mt-3 rounded-lg border border-slate-700 bg-slate-950/60 p-3 text-xs text-slate-300">
                            Detailed quote view: rating {companyRating(quote.company_id)}, distance {companyDistance(quote.company_id)} km, status {quote.status}.
                          </div>
                        )}
                      </article>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="p-5 md:p-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <section className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
                <h3 className="text-sm font-semibold text-white">Customer</h3>
                <div className="mt-3 space-y-2 text-sm text-slate-300">
                  <p>Name: {selectedLead.full_name || '-'}</p>
                  <p>Email: {selectedLead.email || '-'}</p>
                  <p>Phone: {selectedLead.phone || '-'}</p>
                </div>
              </section>

              <section className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
                <h3 className="text-sm font-semibold text-white">Address</h3>
                <div className="mt-3 space-y-2 text-sm text-slate-300">
                  <p>City: {selectedLead.city || '-'}</p>
                  <p>Region: -</p>
                  <p>Postal code: -</p>
                </div>
              </section>

              <section className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
                <h3 className="text-sm font-semibold text-white">Property</h3>
                <div className="mt-3 space-y-2 text-sm text-slate-300">
                  <p>Property type: Residential</p>
                  <p>Access notes: Standard</p>
                  <p>On-site parking: Unknown</p>
                </div>
              </section>

              <section className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
                <h3 className="text-sm font-semibold text-white">Requested Service</h3>
                <p className="mt-3 text-sm text-slate-300">{toServiceText(selectedLead.services)}</p>
              </section>

              <section className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
                <h3 className="text-sm font-semibold text-white">Notes</h3>
                <p className="mt-3 text-sm text-slate-300">{selectedLead.notes || 'No customer notes provided.'}</p>
              </section>

              <section className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
                <h3 className="text-sm font-semibold text-white">Photos</h3>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {['A', 'B', 'C'].map((token) => (
                    <div
                      key={token}
                      className="flex h-16 items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-900/60 text-xs text-slate-500"
                    >
                      Photo {token}
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-slate-800 bg-slate-950/30 p-4 xl:col-span-2">
                <h3 className="text-sm font-semibold text-white">Timeline</h3>
                <div className="mt-3 grid gap-2 text-sm text-slate-300 md:grid-cols-2">
                  <p>Lead created: {createdAt.date} {createdAt.time}</p>
                  <p>Companies invited: {matchingCompanies.length}</p>
                  <p>Quotes received: {quotes.length}</p>
                  <p>Current status: {selectedLead.status}</p>
                </div>
              </section>

              <section className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
                <h3 className="text-sm font-semibold text-white">Status History</h3>
                <ul className="mt-3 space-y-2 text-sm text-slate-300">
                  <li>New lead created</li>
                  <li>Marketplace matching completed</li>
                  <li>Current: {selectedLead.status}</li>
                </ul>
              </section>

              <section className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
                <h3 className="text-sm font-semibold text-white">Internal Notes</h3>
                <p className="mt-3 text-sm text-slate-300">No internal notes yet.</p>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
