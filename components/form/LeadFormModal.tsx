// components/form/LeadFormModal.tsx (or your actual request form file)
'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

// Service normalization mapping: UI label -> internal stable value
const SERVICE_NORMALIZATION: Record<string, string> = {
  // English labels
  'Office Cleaning': 'office',
  'House Cleaning': 'regular',
  'Regular Cleaning': 'regular',
  'Deep Cleaning': 'deep',
  'Move-out Cleaning': 'move_out',
  'Airbnb Cleaning': 'airbnb',
  'Window Cleaning': 'window',
  // German labels
  'Büroreinigung': 'office',
  'Unterhaltsreinigung': 'regular',
  'Grundreinigung': 'deep',
  'Umzugsreinigung': 'move_out',
  'Airbnb Reinigung': 'airbnb',
  'Fensterreinigung': 'window',
}

// Normalize service label to internal value
const normalizeService = (label: string): string => {
  return SERVICE_NORMALIZATION[label] || label.toLowerCase().replace(/\s+/g, '_')
}

interface LeadFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (leadId: string) => void
}

export default function LeadFormModal({ isOpen, onClose, onSuccess }: LeadFormModalProps) {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    city: 'Berlin',
    services: [] as string[],
    notes: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      // Normalize services to internal values before submission
      const normalizedServices = formData.services.map(normalizeService)

      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          services: normalizedServices, // Send normalized values
          service_type: normalizedServices[0] || null, // Also set primary service_type
        }),
      })

      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit lead')
      }

      if (onSuccess) {
        onSuccess(result.leadId)
      }
      onClose()
      setFormData({
        full_name: '',
        email: '',
        phone: '',
        city: 'Berlin',
        services: [],
        notes: '',
      })
    } catch (err: any) {
      setError(err.message || 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6">
        <h2 className="text-xl font-bold text-white mb-4">Submit Cleaning Request</h2>
        
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Full Name *</label>
            <input
              type="text"
              required
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Email *</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">City</label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Services *</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Office Cleaning', value: 'office' },
                { label: 'House Cleaning', value: 'regular' },
                { label: 'Deep Cleaning', value: 'deep' },
                { label: 'Move-out Cleaning', value: 'move_out' },
                { label: 'Airbnb Cleaning', value: 'airbnb' },
                { label: 'Window Cleaning', value: 'window' },
              ].map((service) => (
                <label key={service.value} className="flex items-center gap-2 p-2 rounded-lg bg-slate-800 border border-slate-700 cursor-pointer hover:border-emerald-500 transition">
                  <input
                    type="checkbox"
                    checked={formData.services.includes(service.label)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({ ...formData, services: [...formData.services, service.label] })
                      } else {
                        setFormData({ ...formData, services: formData.services.filter((s) => s !== service.label) })
                      }
                    }}
                    className="w-4 h-4 accent-emerald-500"
                  />
                  <span className="text-sm text-slate-200">{service.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 focus:border-emerald-500 focus:outline-none resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-medium transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || formData.services.length === 0}
              className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}