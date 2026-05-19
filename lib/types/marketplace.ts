// lib/types/marketplace.ts

export type City = 'Bonn' | 'Köln' | 'Koblenz'
export type ServiceType = 'regular' | 'deep' | 'move_out' | 'airbnb' | 'office'
export type LeadStatus = 'new' | 'matched' | 'booked' | 'cancelled' | 'completed'
export type QuoteStatus = 'pending' | 'accepted' | 'rejected' | 'expired'
export type UserRole = 'customer' | 'company' | 'admin'
export type UrgencyLevel = 'low' | 'medium' | 'high'
export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled'
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded'
export type NotificationType = 'quote_created' | 'quote_accepted' | 'quote_rejected' | 'booking_confirmed' | 'system'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  role: UserRole
  created_at: string
}

export interface CompanyServiceArea {
  id: string
  company_id: string
  city: City
}

export interface CompanyService {
  id: string
  company_id: string
  service_type: ServiceType
}

export interface Company {
  id: string
  owner_user_id: string | null
  company_name: string
  contact_person: string | null
  email: string
  phone: string | null
  city: City | null
  active: boolean
  verified: boolean
  insured: boolean
  rating: number | null
  response_time_score: number | null
  acceptance_rate: number | null
  cancellation_rate: number | null
  created_at: string
  // Optional nested fields for Supabase joins
  company_service_areas?: CompanyServiceArea[] | null
  company_services?: CompanyService[] | null
}

// Explicit type for matching results to avoid undefined/null conflicts
export interface MatchedCompany {
  id: string
  company_name: string
  email: string | null
  city: City | null
  rating: number | null
  response_time_score: number | null
}

// Flexible input type that matches various Supabase response shapes
// All fields are nullable to match Supabase's return of null instead of undefined
export type CompanyMatchInput = {
  id: string
  company_name: string
  email: string | null
  city: City | null
  rating: number | null
  response_time_score: number | null
  // Legacy direct fields
  service_areas: City[] | null
  services: ServiceType[] | null
  // Nested fields from Supabase joins
  company_service_areas: Array<{ city: City }> | null
  company_services: Array<{ service_type: ServiceType }> | null
}

export interface Lead {
  id: string
  customer_id: string | null
  full_name: string
  email: string
  phone: string | null
  city: City
  address: string | null
  service_type: ServiceType
  rooms: number | null
  bathrooms: number | null
  square_meters: number | null
  preferred_date: string | null
  preferred_time: string | null
  urgency: UrgencyLevel
  notes: string | null
  estimated_price: number | null
  estimated_duration: number | null
  status: LeadStatus
  created_at: string
}

export interface Quote {
  id: string
  lead_id: string
  company_id: string
  status: QuoteStatus
  proposed_price: number | null
  platform_commission_rate: number | null
  platform_commission_amount: number | null
  company_payout_amount: number | null
  message: string | null
  created_at: string
  updated_at: string | null
  // Optional joined fields
  company?: Pick<Company, 'id' | 'company_name' | 'rating'>
  lead?: Pick<Lead, 'id' | 'city' | 'service_type' | 'rooms' | 'bathrooms' | 'square_meters'>
}

export interface Booking {
  id: string
  lead_id: string | null
  quote_id: string | null
  customer_id: string | null
  company_id: string | null
  status: BookingStatus
  scheduled_at: string | null
  final_price: number | null
  commission_rate: number | null
  commission_amount: number | null
  company_payout: number | null
  payment_status: PaymentStatus
  created_at: string
}

export interface Review {
  id: string
  booking_id: string | null
  customer_id: string | null
  company_id: string | null
  rating: number | null
  comment: string | null
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: NotificationType
  read: boolean
  created_at: string
}

export interface PricingRule {
  id: string
  city: City
  service_type: ServiceType
  base_price: number
  price_per_room: number | null
  price_per_bathroom: number | null
  price_per_sqm: number | null
  urgency_fee: number | null
  active: boolean
  created_at: string
}

export interface AuditLog {
  id: string
  action: string
  entity_type: string
  entity_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface CreateLeadInput {
  full_name: string
  email: string
  phone?: string
  city: City
  address?: string
  service_type: ServiceType
  rooms?: number
  bathrooms?: number
  square_meters?: number
  preferred_date?: string
  preferred_time?: string
  urgency?: UrgencyLevel
  notes?: string
}

export interface CreateQuoteInput {
  lead_id: string
  company_id: string
  proposed_price?: number
  message?: string
}

export interface UpdateQuoteStatusInput {
  quote_id: string
  status: QuoteStatus
}