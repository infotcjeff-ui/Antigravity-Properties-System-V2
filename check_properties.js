const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function getEnv(key) {
    try {
        const envFile = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
        const lines = envFile.split('\n');
        for (const line of lines) {
            if (line.trim().startsWith(`${key}=`)) {
                return line.split('=')[1].trim().replace(/['"]/g, '');
            }
        }
    } catch (e) {
        console.error('Error reading .env.local:', e.message);
    }
    return null;
}

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log('--- Checking properties table structure ---');
    // Try to fetch one row and see all column keys
    const { data, error } = await supabase.from('properties').select('*').limit(1);

    if (error) {
        console.error('Error fetching properties:', error.message);
        console.log('Details:', error);

        if (error.message.includes('column "is_deleted" does not exist')) {
            console.log('\nCRITICAL: The column "is_deleted" is MISSING from the properties table!');
        }
    } else {
        console.log('Query succeeded!');
        if (data && data.length > 0) {
            console.log('Available columns:', Object.keys(data[0]));
            if (!('is_deleted' in data[0])) {
                console.log('\nCRITICAL: The column "is_deleted" is NOT present in the result set!');
            } else {
                console.log('\nSUCCESS: Column "is_deleted" EXISTS.');
            }
        } else {
            console.log('No records found in properties table.');
        }
    }

    console.log('\n--- Checking for property "橫台山散村" ---');
    const { data: pData, error: pError } = await supabase
        .from('properties')
        .select('id, name, is_deleted')
        .eq('name', '橫台山散村');

    if (pError) {
        console.error('Error searching by name:', pError.message);
    } else {
        console.log(`Found ${pData.length} matches:`, JSON.stringify(pData, null, 2));
    }
}

check();
