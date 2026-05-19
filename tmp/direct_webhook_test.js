const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
env.split(/\r?\n/).forEach(line => {
  const [key, ...vals] = line.split('=');
  if (key && vals.length) process.env[key.trim()] = vals.join('=').trim();
});

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  // Insert a test lead
  const { data: insertedLead, error: insertError } = await supabase
    .from('leads')
    .insert({
      full_name: 'Webhook Test',
      email: `webhook+${Date.now()}@example.com`,
      services: ['Büroreinigung'],
      status: 'new',
      company_id: null,
    })
    .select('id')
    .single();

  if (insertError || !insertedLead) {
    console.error('Lead insert error:', insertError);
    process.exit(1);
  }

  const leadId = insertedLead.id;
  console.log('Inserted lead id:', leadId);

  // Call webhook directly
  const webhookResponse = await fetch('http://localhost:3001/api/webhook/lead-created', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lead_id: leadId }),
  });

  const webhookResult = await webhookResponse.json();
  console.log('Webhook response:', webhookResult);

  // Check quotes
  const { data: quoteRows, error: quoteError } = await supabase
    .from('quotes')
    .select('*')
    .eq('lead_id', leadId);

  if (quoteError) {
    console.error('Quote query error:', quoteError);
    process.exit(1);
  }

  console.log('Quotes for lead:', quoteRows?.length || 0, JSON.stringify(quoteRows, null, 2));

  if (!quoteRows || quoteRows.length === 0) {
    console.error('No quotes created for lead.');
    process.exit(1);
  }

  console.log('End-to-end lead quote creation validated successfully.');
})();
