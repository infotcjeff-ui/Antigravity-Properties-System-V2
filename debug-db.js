const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kyuezxvnufrjdevkbvkj.supabase.co';
const supabaseKey = 'sb_publishable_-AJtGIzi3xri4iKLJStYmA_Haz5WsQ9';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
    console.log('Testing query WITH display_name...');
    const { data: d1, error: e1 } = await supabase
        .from('app_users')
        .select('id, username, role, display_name')
        .limit(1);

    if (e1) {
        console.log('Query with display_name failed:', e1.message || e1);
    } else {
        console.log('Query with display_name succeeded:', d1);
    }

    console.log('\nTesting query WITHOUT display_name...');
    const { data: d2, error: e2 } = await supabase
        .from('app_users')
        .select('id, username, role')
        .limit(1);

    if (e2) {
        console.log('Query without display_name failed:', e2.message || e2);
    } else {
        console.log('Query without display_name succeeded, columns available:', d2[0] ? Object.keys(d2[0]) : 'no rows');
    }
}

debug();
