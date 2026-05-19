
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE lead_status AS ENUM ('new', 'verified', 'reviewed', 'ready_to_send', 'sent_to_companies', 'waiting_for_offers', 'offer_comparison', 'customer_decision', 'closed', 'lost');
CREATE TYPE lead_score AS ENUM ('gold', 'silver', 'low_quality');
CREATE TYPE cleaning_type AS ENUM ('buroreinigung', 'praxisreinigung', 'fensterreinigung', 'airbnb', 'restaurant', 'treppenhaus', 'bauendreinigung', 'unterhaltsreinigung', 'sonstiges');
CREATE TYPE cleaning_frequency AS ENUM ('one_time', 'daily', 'weekly', 'monthly', 'several_times_week');

CREATE TABLE companies (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, phone TEXT, city TEXT NOT NULL,
  services cleaning_type[] NOT NULL, credits INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT false, is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE leads (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_name TEXT NOT NULL, customer_email TEXT NOT NULL, customer_phone TEXT,
  cleaning_type cleaning_type NOT NULL, property_type TEXT, square_meters INTEGER,
  frequency cleaning_frequency NOT NULL, description TEXT,
  address_full TEXT NOT NULL, city TEXT NOT NULL,
  ai_summary TEXT, ai_score lead_score DEFAULT 'silver', ai_tags TEXT[],
  status lead_status DEFAULT 'new', is_email_verified BOOLEAN DEFAULT false,
  verification_token UUID DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
