const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function getEnv(key) {
    const envFile = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
    const lines = envFile.split('\n');
    for (const line of lines) {
        if (line.startsWith(`${key}=`)) {
            return line.split('=')[1].trim();
        }
    }
    return null;
}

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log('--- Checking app_users table ---');
    const { data, error } = await supabase.from('app_users').select('id, username, role');
    if (error) {
        console.error('Error:', error.message);
        return;
    }
    console.log('Users in database:', JSON.stringify(data, null, 2));
    console.log('Total users:', data?.length || 0);
}

check();
