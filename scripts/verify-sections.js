// scripts/verify-sections.js
const fs = require('fs');
const path = require('path');
const envContent = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf-8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
});

const { createClient } = require('@supabase/supabase-js');
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
    const { data, error } = await sb
        .from('properties')
        .select('id, code, name, address, sections, updated_at')
        .eq('id', '2a90fd3e-5a18-4f12-91ae-071ae66aa392')
        .maybeSingle();
    if (error) { console.error('ERR:', error); return; }
    console.log('Property 2a90fd3e-...:', JSON.stringify(data, null, 2));
})();
