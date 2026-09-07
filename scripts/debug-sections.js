// scripts/debug-sections.js
const fs = require('fs');
const path = require('path');

// 讀取 .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
});

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

console.log('URL:', url);
console.log('Service Key length:', serviceKey ? serviceKey.length : 'MISSING');

const { createClient } = require('@supabase/supabase-js');
const sb = createClient(url, serviceKey);

(async () => {
    const { data, error } = await sb
        .from('properties')
        .select('id, code, name, address, sections, updated_at')
        .order('updated_at', { ascending: false, nullsFirst: false })
        .limit(10);
    if (error) { console.error('ERR:', error); process.exit(1); }
    console.log(JSON.stringify(data, null, 2));

    // 額外驗證：用 service role 直接寫 sections 看能不能成功
    const targetId = data && data[0] && data[0].id;
    if (targetId) {
        console.log('\n=== TESTING direct UPDATE with sections ===');
        const { data: upd, error: updErr } = await sb
            .from('properties')
            .update({ sections: 'DEBUG_DIRECT_WRITE_2026_09_07' })
            .eq('id', targetId)
            .select('id, sections, updated_at');
        console.log('UPDATE result:', { upd, updErr });
        // 立刻還原
        await sb.from('properties').update({ sections: null }).eq('id', targetId);
    }
})();
