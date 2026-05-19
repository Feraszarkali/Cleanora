// lib/marketplace/pricing.ts
import { City, ServiceType, UrgencyLevel, PricingRule } from '../types/marketplace'

interface PricingInput {
  city: City
  service_type: ServiceType
  rooms?: number | null
  bathrooms?: number | null
  square_meters?: number | null
  urgency?: UrgencyLevel
}

export interface PricingOutput {
  estimated_price: number
  estimated_duration: number // in minutes
  breakdown: {
    base: number
    rooms: number
    bathrooms: number
    square_meters: number
    urgency: number
  }
  explanation: string
}

// Default pricing fallback if DB rules not available
// Keys strictly aligned with PricingRule interface to prevent type mismatches
const DEFAULT_PRICING: Record<City, Record<ServiceType, { base_price: number; price_per_room: number; price_per_bathroom: number; price_per_sqm: number; urgency_fee: number }>> = {
  'Bonn': {
    regular: { base_price: 45, price_per_room: 8, price_per_bathroom: 12, price_per_sqm: 0.5, urgency_fee: 15 },
    deep: { base_price: 75, price_per_room: 12, price_per_bathroom: 18, price_per_sqm: 0.8, urgency_fee: 20 },
    move_out: { base_price: 95, price_per_room: 15, price_per_bathroom: 22, price_per_sqm: 1.0, urgency_fee: 25 },
    airbnb: { base_price: 55, price_per_room: 10, price_per_bathroom: 15, price_per_sqm: 0.6, urgency_fee: 18 },
    office: { base_price: 65, price_per_room: 5, price_per_bathroom: 10, price_per_sqm: 0.4, urgency_fee: 12 },
  },
  'Köln': {
    regular: { base_price: 48, price_per_room: 9, price_per_bathroom: 13, price_per_sqm: 0.55, urgency_fee: 16 },
    deep: { base_price: 78, price_per_room: 13, price_per_bathroom: 19, price_per_sqm: 0.85, urgency_fee: 21 },
    move_out: { base_price: 98, price_per_room: 16, price_per_bathroom: 23, price_per_sqm: 1.05, urgency_fee: 26 },
    airbnb: { base_price: 58, price_per_room: 11, price_per_bathroom: 16, price_per_sqm: 0.65, urgency_fee: 19 },
    office: { base_price: 68, price_per_room: 6, price_per_bathroom: 11, price_per_sqm: 0.45, urgency_fee: 13 },
  },
  'Koblenz': {
    regular: { base_price: 42, price_per_room: 7.5, price_per_bathroom: 11, price_per_sqm: 0.45, urgency_fee: 14 },
    deep: { base_price: 72, price_per_room: 11.5, price_per_bathroom: 17, price_per_sqm: 0.75, urgency_fee: 19 },
    move_out: { base_price: 92, price_per_room: 14.5, price_per_bathroom: 21, price_per_sqm: 0.95, urgency_fee: 24 },
    airbnb: { base_price: 52, price_per_room: 9.5, price_per_bathroom: 14, price_per_sqm: 0.55, urgency_fee: 17 },
    office: { base_price: 62, price_per_room: 4.5, price_per_bathroom: 9, price_per_sqm: 0.35, urgency_fee: 11 },
  },
}

const DURATION_BASE: Record<ServiceType, number> = {
  regular: 120,
  deep: 180,
  move_out: 240,
  airbnb: 150,
  office: 180,
}

const DURATION_PER_ROOM: Record<ServiceType, number> = {
  regular: 20,
  deep: 30,
  move_out: 40,
  airbnb: 25,
  office: 15,
}

export function calculatePricing(
  input: PricingInput, 
  rules?: PricingRule[] | null
): PricingOutput {
  const { city, service_type, rooms = 0, bathrooms = 0, square_meters = 0, urgency = 'medium' } = input
  
  // Use provided rules or fall back to defaults
  const rule = rules?.[0]
  const pricing = rule || DEFAULT_PRICING[city][service_type]
  
  // Safely extract values, defaulting to 0 if null/undefined
  const base = pricing.base_price ?? 0
  const pricePerRoom = pricing.price_per_room ?? 0
  const pricePerBathroom = pricing.price_per_bathroom ?? 0
  const pricePerSqm = pricing.price_per_sqm ?? 0
  const urgencyFee = pricing.urgency_fee ?? 0
  
  // Apply urgency fee only for high/low urgency (medium uses base calculation)
  const urgencyCost = urgency !== 'medium' ? urgencyFee : 0
  
  const roomCost = (rooms || 0) * pricePerRoom
  const bathroomCost = (bathrooms || 0) * pricePerBathroom
  const sqmCost = (square_meters || 0) * pricePerSqm
  
  const total = base + roomCost + bathroomCost + sqmCost + urgencyCost
  
  // Calculate duration
  const baseDuration = DURATION_BASE[service_type]
  const roomDuration = (rooms || 0) * DURATION_PER_ROOM[service_type]
  const estimated_duration = baseDuration + roomDuration
  
  const breakdown = {
    base: Math.round(base * 100) / 100,
    rooms: Math.round(roomCost * 100) / 100,
    bathrooms: Math.round(bathroomCost * 100) / 100,
    square_meters: Math.round(sqmCost * 100) / 100,
    urgency: Math.round(urgencyCost * 100) / 100,
  }
  
  const explanationParts = [`Basispreis ${city}: €${breakdown.base}`]
  if ((rooms || 0) > 0) explanationParts.push(`${rooms} Zimmer: +€${breakdown.rooms}`)
  if ((bathrooms || 0) > 0) explanationParts.push(`${bathrooms} Badezimmer: +€${breakdown.bathrooms}`)
  if ((square_meters || 0) > 0) explanationParts.push(`${square_meters} m²: +€${breakdown.square_meters}`)
  if (urgency !== 'medium' && urgencyFee > 0) explanationParts.push(`Dringlichkeit ${urgency}: +€${breakdown.urgency}`)
  
  return {
    estimated_price: Math.round(total * 100) / 100,
    estimated_duration,
    breakdown,
    explanation: explanationParts.join(' • '),
  }
}