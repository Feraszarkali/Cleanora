const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
env.split(/\r?\n/).forEach(line => {
  const [key, ...vals] = line.split('=');
  if (key && vals.length) process.env[key.trim()] = vals.join('=').trim();
});

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  const uniqueEmail = `test+${Date.now()}@example.com`;

  await page.goto('http://localhost:3001');
  await page.click('text=Kostenloses Angebot erhalten');
  await page.fill('input[placeholder="Full Name"]', 'Quote Test');
  await page.fill('input[placeholder="Email Address"]', uniqueEmail);
  await page.selectOption('select', 'Büroreinigung');
  await page.fill('textarea[placeholder="Additional Details"]', 'Please send quote.');
  await page.click('button:has-text("Submit Request")');

  await page.waitForSelector('text=Anfrage gesendet', { timeout: 15000 });

  // Wait a short moment for the webhook to complete
  await page.waitForTimeout(5000);

  const { data: leadRows, error: leadError } = await supabase
    .from('leads')
    .select('id')
    .eq('email', uniqueEmail)
    .limit(1);

  if (leadError || !leadRows || leadRows.length === 0) {
    console.error('Lead was not found in database:', leadError);
    await browser.close();
    process.exit(1);
  }

  const leadId = leadRows[0].id;
  console.log('Inserted lead id:', leadId);

  const { data: quoteRows, error: quoteError } = await supabase
    .from('quotes')
    .select('*')
    .eq('lead_id', leadId);

  if (quoteError) {
    console.error('Quote query error:', quoteError);
    await browser.close();
    process.exit(1);
  }

  console.log('Quotes for lead:', quoteRows?.length || 0, JSON.stringify(quoteRows, null, 2));
  await browser.close();

  if (!quoteRows || quoteRows.length === 0) {
    console.error('No quotes created for lead.');
    process.exit(1);
  }

  console.log('End-to-end lead quote creation validated successfully.');
})();
