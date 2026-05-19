const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
env.split(/\r?\n/).forEach(line => {
  const [key, ...vals] = line.split('=');
  if (key && vals.length) process.env[key.trim()] = vals.join('=').trim();
});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
(async () => {
  const { data, error } = await supabase.from('cleaning_companies').select('id,company_name,services,active').eq('active', true).limit(10);
  if (error) {
    console.error('ERR', error);
    process.exit(1);
  }
  console.log(JSON.stringify(data, null, 2));
})();
