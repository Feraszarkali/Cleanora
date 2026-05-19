 'use client'

import { useState, FormEvent } from 'react'
import { supabase } from '@/lib/supabase/client'

interface LeadFormModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function LeadFormModal({
  isOpen,
  onClose,
}: LeadFormModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    service: '',
    details: '',
  })

  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.from('leads').insert({
      name: formData.name,
      email: formData.email,
      service: formData.service,
      details: formData.details,
    })

    if (error) {
      setLoading(false)
      console.error('Supabase insert error:', error)
      alert(error.message || 'Failed to submit request')
      return
    }

    setLoading(false)
    alert('Request submitted successfully!')
    setSubmitted(true)
    setFormData({ name: '', email: '', service: '', details: '' })

    setTimeout(() => {
      setSubmitted(false)
      onClose()
    }, 1500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-3xl font-bold text-gray-900">
            Request a Quote
          </h2>

          {!submitted && (
            <button
              onClick={onClose}
              className="text-2xl text-gray-500 hover:text-black"
            >
              ×
            </button>
          )}
        </div>

        {submitted ? (
          <div className="py-10 text-center">
            <h3 className="mb-2 text-2xl font-bold text-green-600">
              Anfrage gesendet ✅
            </h3>

            <p className="text-gray-600">
              We will contact you soon.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              placeholder="Full Name"
              required
              value={formData.name}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  name: e.target.value,
                })
              }
              className="w-full rounded-lg border border-gray-300 p-3"
            />

            <input
              type="email"
              placeholder="Email Address"
              required
              value={formData.email}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  email: e.target.value,
                })
              }
              className="w-full rounded-lg border border-gray-300 p-3"
            />

            <select
              required
              value={formData.service}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  service: e.target.value,
                })
              }
              className="w-full rounded-lg border border-gray-300 p-3"
            >
              <option value="">Select Service</option>
              <option>Office Cleaning</option>
              <option>House Cleaning</option>
              <option>Deep Cleaning</option>
              <option>Window Cleaning</option>
            </select>

            <textarea
              placeholder="Additional Details"
              rows={4}
              value={formData.details}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  details: e.target.value,
                })
              }
              className="w-full rounded-lg border border-gray-300 p-3"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700"
            >
              {loading ? 'Sending...' : 'Submit Request'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}