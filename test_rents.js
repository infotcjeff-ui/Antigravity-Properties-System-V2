require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testRents() {
    const { data, error } = await supabase
        .from('rents')
        .select('id, property_id, type, proprietor:proprietors!proprietor_id(id, name), tenant:proprietors!tenant_id(id, name)');

    if (error) {
        console.error('Error fetching rents:', error);
    } else {
        console.log('Successfully fetched rents:', JSON.stringify(data, null, 2));
    }
}

testRents();
