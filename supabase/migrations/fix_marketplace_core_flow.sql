-- supabase/migrations/fix_marketplace_core_flow.sql

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  phone TEXT,
  role TEXT DEFAULT 'customer' CHECK (role IN ('customer', 'company', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_user_id UUID REFERENCES profiles(id),
  company_name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  city TEXT CHECK (city IN ('Bonn', 'Köln', 'Koblenz')),
  active BOOLEAN DEFAULT TRUE,
  verified BOOLEAN DEFAULT FALSE,
  insured BOOLEAN DEFAULT FALSE,
  rating NUMERIC(3,2) DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  response_time_score NUMERIC(3,2) DEFAULT 0,
  acceptance_rate NUMERIC(5,2) DEFAULT 0,
  cancellation_rate NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Company service areas (cities they serve)
CREATE TABLE IF NOT EXISTS company_service_areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  city TEXT CHECK (city IN ('Bonn', 'Köln', 'Koblenz')) NOT NULL,
  UNIQUE(company_id, city)
);

-- Company services (types they offer)
CREATE TABLE IF NOT EXISTS company_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  service_type TEXT CHECK (service_type IN ('regular', 'deep', 'move_out', 'airbnb', 'office')) NOT NULL,
  UNIQUE(company_id, service_type)
);

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES profiles(id),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  city TEXT CHECK (city IN ('Bonn', 'Köln', 'Koblenz')) NOT NULL,
  address TEXT,
  service_type TEXT CHECK (service_type IN ('regular', 'deep', 'move_out', 'airbnb', 'office')) NOT NULL,
  rooms INTEGER CHECK (rooms > 0),
  bathrooms INTEGER CHECK (bathrooms > 0),
  square_meters INTEGER CHECK (square_meters > 0),
  preferred_date DATE,
  preferred_time TEXT,
  urgency TEXT CHECK (urgency IN ('low', 'medium', 'high')) DEFAULT 'medium',
  notes TEXT,
  estimated_price NUMERIC(10,2),
  estimated_duration INTEGER, -- in minutes
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'matched', 'booked', 'cancelled', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quotes table
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  proposed_price NUMERIC(10,2),
  platform_commission_rate NUMERIC(5,2) DEFAULT 10,
  platform_commission_amount NUMERIC(10,2),
  company_payout_amount NUMERIC(10,2),
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lead_id, company_id)
);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id),
  quote_id UUID REFERENCES quotes(id),
  customer_id UUID REFERENCES profiles(id),
  company_id UUID REFERENCES companies(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  scheduled_at TIMESTAMPTZ,
  final_price NUMERIC(10,2),
  commission_rate NUMERIC(5,2) DEFAULT 10,
  commission_amount NUMERIC(10,2),
  company_payout NUMERIC(10,2),
  payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID REFERENCES bookings(id),
  customer_id UUID REFERENCES profiles(id),
  company_id UUID REFERENCES companies(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT CHECK (type IN ('quote_created', 'quote_accepted', 'quote_rejected', 'booking_confirmed', 'system')),
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pricing rules table
CREATE TABLE IF NOT EXISTS pricing_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  city TEXT CHECK (city IN ('Bonn', 'Köln', 'Koblenz')) NOT NULL,
  service_type TEXT CHECK (service_type IN ('regular', 'deep', 'move_out', 'airbnb', 'office')) NOT NULL,
  base_price NUMERIC(10,2) NOT NULL,
  price_per_room NUMERIC(10,2) DEFAULT 0,
  price_per_bathroom NUMERIC(10,2) DEFAULT 0,
  price_per_sqm NUMERIC(10,2) DEFAULT 0,
  urgency_fee NUMERIC(10,2) DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(city, service_type)
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_customer_id ON leads(customer_id);
CREATE INDEX IF NOT EXISTS idx_leads_city ON leads(city);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_quotes_lead_id ON quotes(lead_id);
CREATE INDEX IF NOT EXISTS idx_quotes_company_id ON quotes(company_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_companies_owner_user_id ON companies(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_companies_city ON companies(city);
CREATE INDEX IF NOT EXISTS idx_company_service_areas_city ON company_service_areas(city);
CREATE INDEX IF NOT EXISTS idx_company_services_type ON company_services(service_type);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_pricing_rules_city_service ON pricing_rules(city, service_type);

-- Row Level Security (RLS) - MVP safe policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles RLS
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Companies RLS
CREATE POLICY "Anyone can read active companies" ON companies
  FOR SELECT USING (active = TRUE);

CREATE POLICY "Company owners can update own company" ON companies
  FOR UPDATE USING (auth.uid() = owner_user_id);

CREATE POLICY "Admins can manage all companies" ON companies
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Leads RLS
CREATE POLICY "Customers can read own leads" ON leads
  FOR SELECT USING (auth.uid() = customer_id);

CREATE POLICY "Customers can create leads" ON leads
  FOR INSERT WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Admins can manage all leads" ON leads
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Quotes RLS
CREATE POLICY "Companies can read quotes for their company" ON quotes
  FOR SELECT USING (
    company_id IN (SELECT id FROM companies WHERE owner_user_id = auth.uid())
  );

CREATE POLICY "Customers can read quotes for their leads" ON quotes
  FOR SELECT USING (
    lead_id IN (SELECT id FROM leads WHERE customer_id = auth.uid())
  );

CREATE POLICY "Companies can update their own quotes" ON quotes
  FOR UPDATE USING (
    company_id IN (SELECT id FROM companies WHERE owner_user_id = auth.uid())
  );

CREATE POLICY "Admins can manage all quotes" ON quotes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Notifications RLS
CREATE POLICY "Users can read own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications" ON notifications
  FOR INSERT WITH CHECK (TRUE); -- Allow server-side inserts

-- Pricing rules RLS
CREATE POLICY "Anyone can read active pricing rules" ON pricing_rules
  FOR SELECT USING (active = TRUE);

-- Audit logs RLS
CREATE POLICY "Admins can read audit logs" ON audit_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Seed data: Pricing rules for German cities
INSERT INTO pricing_rules (city, service_type, base_price, price_per_room, price_per_bathroom, price_per_sqm, urgency_fee, active) VALUES
  ('Bonn', 'regular', 45.00, 8.00, 12.00, 0.50, 15.00, TRUE),
  ('Bonn', 'deep', 75.00, 12.00, 18.00, 0.80, 20.00, TRUE),
  ('Bonn', 'move_out', 95.00, 15.00, 22.00, 1.00, 25.00, TRUE),
  ('Bonn', 'airbnb', 55.00, 10.00, 15.00, 0.60, 18.00, TRUE),
  ('Bonn', 'office', 65.00, 5.00, 10.00, 0.40, 12.00, TRUE),
  
  ('Köln', 'regular', 48.00, 9.00, 13.00, 0.55, 16.00, TRUE),
  ('Köln', 'deep', 78.00, 13.00, 19.00, 0.85, 21.00, TRUE),
  ('Köln', 'move_out', 98.00, 16.00, 23.00, 1.05, 26.00, TRUE),
  ('Köln', 'airbnb', 58.00, 11.00, 16.00, 0.65, 19.00, TRUE),
  ('Köln', 'office', 68.00, 6.00, 11.00, 0.45, 13.00, TRUE),
  
  ('Koblenz', 'regular', 42.00, 7.50, 11.00, 0.45, 14.00, TRUE),
  ('Koblenz', 'deep', 72.00, 11.50, 17.00, 0.75, 19.00, TRUE),
  ('Koblenz', 'move_out', 92.00, 14.50, 21.00, 0.95, 24.00, TRUE),
  ('Koblenz', 'airbnb', 52.00, 9.50, 14.00, 0.55, 17.00, TRUE),
  ('Koblenz', 'office', 62.00, 4.50, 9.00, 0.35, 11.00, TRUE)
ON CONFLICT (city, service_type) DO UPDATE SET
  base_price = EXCLUDED.base_price,
  price_per_room = EXCLUDED.price_per_room,
  price_per_bathroom = EXCLUDED.price_per_bathroom,
  price_per_sqm = EXCLUDED.price_per_sqm,
  urgency_fee = EXCLUDED.urgency_fee,
  active = EXCLUDED.active;

-- Seed data: Sample companies for testing
INSERT INTO companies (company_name, contact_person, email, phone, city, active, verified, insured, rating) VALUES
  ('BlitzSauber Bonn', 'Maria Schmidt', 'maria@blitzsauber-bonn.de', '+49 228 123456', 'Bonn', TRUE, TRUE, TRUE, 4.8),
  ('Köln CleanPro', 'Thomas Müller', 'thomas@koeln-cleanpro.de', '+49 221 789012', 'Köln', TRUE, TRUE, TRUE, 4.5)
ON CONFLICT (email) DO UPDATE SET
  company_name = EXCLUDED.company_name,
  contact_person = EXCLUDED.contact_person,
  phone = EXCLUDED.phone,
  city = EXCLUDED.city,
  active = EXCLUDED.active,
  verified = EXCLUDED.verified,
  insured = EXCLUDED.insured,
  rating = EXCLUDED.rating;

-- Assign service areas and services to sample companies
INSERT INTO company_service_areas (company_id, city)
SELECT id, 'Bonn' FROM companies WHERE email = 'maria@blitzsauber-bonn.de'
ON CONFLICT DO NOTHING;

INSERT INTO company_services (company_id, service_type)
SELECT id, 'regular' FROM companies WHERE email = 'maria@blitzsauber-bonn.de'
ON CONFLICT DO NOTHING;

INSERT INTO company_services (company_id, service_type)
SELECT id, 'deep' FROM companies WHERE email = 'maria@blitzsauber-bonn.de'
ON CONFLICT DO NOTHING;

INSERT INTO company_service_areas (company_id, city)
SELECT id, 'Köln' FROM companies WHERE email = 'thomas@koeln-cleanpro.de'
ON CONFLICT DO NOTHING;

INSERT INTO company_services (company_id, service_type)
SELECT id, 'regular' FROM companies WHERE email = 'thomas@koeln-cleanpro.de'
ON CONFLICT DO NOTHING;

INSERT INTO company_services (company_id, service_type)
SELECT id, 'airbnb' FROM companies WHERE email = 'thomas@koeln-cleanpro.de'
ON CONFLICT DO NOTHING;