// app/book/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { City, ServiceType, UrgencyLevel } from '@/lib/types/marketplace'
import { calculatePricing } from '@/lib/marketplace/pricing'

export default function BookingForm() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pricing, setPricing] = useState<{ estimated_price: number; explanation: string } | null>(null)
  
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    city: '' as City | '',
    address: '',
    service_type: '' as ServiceType | '',
    rooms: '',
    bathrooms: '',
    square_meters: '',
    preferred_date: '',
    preferred_time: '',
    urgency: 'medium' as UrgencyLevel,
    notes: '',
  })

  // Calculate pricing when relevant fields change
  const handleFieldChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Recalculate pricing if we have enough data
    if (formData.city && formData.service_type) {
      const result = calculatePricing({
        city: formData.city as City,
        service_type: formData.service_type as ServiceType,
        rooms: formData.rooms ? parseInt(formData.rooms) : undefined,
        bathrooms: formData.bathrooms ? parseInt(formData.bathrooms) : undefined,
        square_meters: formData.square_meters ? parseInt(formData.square_meters) : undefined,
        urgency: formData.urgency,
      })
      setPricing({
        estimated_price: result.estimated_price,
        explanation: result.explanation,
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    
    try {
      const payload = {
        id: 'j91d5r',
        full_name: formData.full_name,
        email: formData.email,
        phone: formData.phone,
        city: formData.city,
        service_type: formData.service_type,
        rooms: formData.rooms ? parseInt(formData.rooms) : null,
        bathrooms: formData.bathrooms ? parseInt(formData.bathrooms) : null,
        square_meters: formData.square_meters ? parseInt(formData.square_meters) : null,
        preferred_date: formData.preferred_date,
        preferred_time: formData.preferred_time,
        urgency: formData.urgency,
        notes: formData.notes,
        estimated_price: pricing?.estimated_price ?? null,
        address: formData.address,
      }

      console.log('[BOOK FORM] payload:', payload)

      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit request')
      }
      
      // Show success and redirect
      alert('Anfrage erfolgreich gesendet! Sie erhalten bald Angebote von passenden Firmen.')
      router.push('/customer/dashboard')
      
    } catch (err: unknown) {
      const e = err as Error
      setError(e.message || 'Ein Fehler ist aufgetreten')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
            Reinigung anfragen
          </h1>
          <p className="text-slate-400 mt-1">Geben Sie Ihre Reinigungswünsche ein</p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Info */}
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-6 space-y-4">
            <h3 className="font-semibold text-lg">Kontaktinformationen</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Vollständiger Name *"
                required
                value={formData.full_name}
                onChange={(e) => handleFieldChange('full_name', e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 focus:border-cyan-500 focus:outline-none"
              />
              <input
                type="email"
                placeholder="E-Mail-Adresse *"
                required
                value={formData.email}
                onChange={(e) => handleFieldChange('email', e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 focus:border-cyan-500 focus:outline-none"
              />
              <input
                type="tel"
                placeholder="Telefon (optional)"
                value={formData.phone}
                onChange={(e) => handleFieldChange('phone', e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Location & Service */}
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-6 space-y-4">
            <h3 className="font-semibold text-lg">Ort & Service</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <select
                required
                value={formData.city}
                onChange={(e) => handleFieldChange('city', e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 focus:border-cyan-500 focus:outline-none"
              >
                <option value="">Stadt wählen *</option>
                <option value="Bonn">Bonn</option>
                <option value="Köln">Köln</option>
                <option value="Koblenz">Koblenz</option>
              </select>
              <input
                type="text"
                placeholder="Adresse (optional)"
                value={formData.address}
                onChange={(e) => handleFieldChange('address', e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 focus:border-cyan-500 focus:outline-none"
              />
              <select
                required
                value={formData.service_type}
                onChange={(e) => handleFieldChange('service_type', e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 focus:border-cyan-500 focus:outline-none"
              >
                <option value="">Service wählen *</option>
                <option value="regular">Reguläre Reinigung</option>
                <option value="deep">Grundreinigung</option>
                <option value="move_out">Endreinigung</option>
                <option value="airbnb">Airbnb Reinigung</option>
                <option value="office">Büroreinigung</option>
              </select>
            </div>
          </div>

          {/* Property Details */}
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-6 space-y-4">
            <h3 className="font-semibold text-lg">Objekt-Details</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <input
                type="number"
                min="1"
                placeholder="Zimmer"
                value={formData.rooms}
                onChange={(e) => handleFieldChange('rooms', e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 focus:border-cyan-500 focus:outline-none"
              />
              <input
                type="number"
                min="1"
                placeholder="Badezimmer"
                value={formData.bathrooms}
                onChange={(e) => handleFieldChange('bathrooms', e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 focus:border-cyan-500 focus:outline-none"
              />
              <input
                type="number"
                min="1"
                placeholder="m²"
                value={formData.square_meters}
                onChange={(e) => handleFieldChange('square_meters', e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Scheduling */}
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-6 space-y-4">
            <h3 className="font-semibold text-lg">Zeitplanung</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <input
                type="date"
                value={formData.preferred_date}
                onChange={(e) => handleFieldChange('preferred_date', e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 focus:border-cyan-500 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Bevorzugte Uhrzeit"
                value={formData.preferred_time}
                onChange={(e) => handleFieldChange('preferred_time', e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 focus:border-cyan-500 focus:outline-none"
              />
              <select
                value={formData.urgency}
                onChange={(e) => handleFieldChange('urgency', e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 focus:border-cyan-500 focus:outline-none"
              >
                <option value="low">Normale Dringlichkeit</option>
                <option value="medium">Erhöhte Dringlichkeit</option>
                <option value="high">Sehr dringend</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-6 space-y-4">
            <h3 className="font-semibold text-lg">Weitere Hinweise</h3>
            <textarea
              placeholder="Besondere Wünsche oder Hinweise..."
              rows={4}
              value={formData.notes}
              onChange={(e) => handleFieldChange('notes', e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 focus:border-cyan-500 focus:outline-none resize-none"
            />
          </div>

          {/* Pricing Estimate */}
          {pricing && (
            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4">
              <p className="text-sm text-cyan-300">
                <span className="font-semibold">Geschätzter Preis:</span> {pricing.estimated_price.toFixed(2)} €
              </p>
              <p className="text-xs text-slate-400 mt-1">{pricing.explanation}</p>
              <p className="text-xs text-slate-500 mt-1">* Endpreis wird von der Reinigungsfirma festgelegt</p>
            </div>
          )}

          {/* Submit */}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}
          
          <button
            type="submit"
            disabled={submitting || !formData.city || !formData.service_type}
            className="w-full py-4 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 disabled:from-slate-700 disabled:to-slate-700 text-white font-semibold rounded-xl transition"
          >
            {submitting ? 'Wird gesendet...' : 'Anfrage absenden'}
          </button>
        </form>
      </div>
    </div>
  )
}