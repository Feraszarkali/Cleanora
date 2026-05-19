-- supabase/migrations/001_quote_workflow.sql

-- 1. Ensure services column is text[] for array matching
ALTER TABLE cleaning_companies
  ALTER COLUMN services TYPE text[] 
  USING CASE 
    WHEN services IS NULL THEN ARRAY[]::text[] 
    WHEN pg_typeof(services) = 'text'::regtype THEN string_to_array(services, ',') 
    ELSE services 
  END;

-- 2. Create quotes table
CREATE TABLE IF NOT EXISTS quotes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  company_id BIGINT REFERENCES cleaning_companies(id) ON DELETE CASCADE NOT NULL,
  company_name TEXT,
  work_description TEXT,
  included_services TEXT[],
  estimated_duration TEXT,
  final_price NUMERIC(10, 2),
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'selected', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(lead_id, company_id)
);

-- 3. Extend leads table for quote workflow
ALTER TABLE leads ADD COLUMN IF NOT EXISTS quote_deadline TIMESTAMP WITH TIME ZONE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS selected_quote_id UUID REFERENCES quotes(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS customer_notified BOOLEAN DEFAULT FALSE;

-- 4. Safely extend status constraint without breaking existing data
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'leads_status_check') THEN
    ALTER TABLE leads DROP CONSTRAINT leads_status_check;
  END IF;
END $$;

ALTER TABLE leads ADD CONSTRAINT leads_status_check 
  CHECK (status IN (
    'new', 'contacted', 'quote_sent', 'completed', 'cancelled',
    'collecting_quotes'
  ));

-- 5. Performance indexes
CREATE INDEX IF NOT EXISTS idx_quotes_lead_id ON quotes(lead_id);
CREATE INDEX IF NOT EXISTS idx_quotes_company_id ON quotes(company_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_quote_deadline ON leads(quote_deadline);