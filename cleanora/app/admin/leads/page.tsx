'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '../../../lib/supabaseClient'

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchLeads = async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, name, email, service, details, created_at')
        .order('created_at', { ascending: false })

      if (error) {
        console.error(error)
        setError('Failed to load leads from database.')
      } else {
        setLeads(data || [])
      }
      setLoading(false)
    }

    fetchLeads()
  }, [])

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading leads...</div>
  }

  if (error) {
    return <div className="text-red-600 p-8 bg-red-50 rounded-lg border border-red-200">{error}</div>
  }

  return (
    <div className="p-6 sm:p-10">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/admin" className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition">
          ← Back to Admin
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Leads Management</h1>
      </div>
      
      <div className="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 font-semibold text-gray-700">Name</th>
              <th className="px-6 py-4 font-semibold text-gray-700">Email</th>
              <th className="px-6 py-4 font-semibold text-gray-700">Service</th>
              <th className="px-6 py-4 font-semibold text-gray-700">Details</th>
              <th className="px-6 py-4 font-semibold text-gray-700">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 font-medium text-gray-900">{lead.name}</td>
                <td className="px-6 py-4 text-gray-600">{lead.email}</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-medium">
                    {lead.service}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-600 max-w-xs truncate">{lead.details || '—'}</td>
                <td className="px-6 py-4 text-gray-500">
                  {new Date(lead.created_at).toLocaleDateString('de-DE', { year: 'numeric', month: 'short', day: 'numeric' })}
                </td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  No leads submitted yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}