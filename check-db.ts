import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function main() {
    // Check if rent_property_lot_partial column exists
    const { data, error } = await supabase
        .from('rents')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Query error:', error);
        return;
    }

    if (!data || data.length === 0) {
        console.log('No data in rents table');
        return;
    }

    const columns = Object.keys(data[0]);
    console.log('Columns in rents table:');
    columns.forEach(c => console.log('  -', c));

    console.log('\nChecking key columns:');
    console.log('  rent_property_lot:', columns.includes('rent_property_lot') ? 'EXISTS' : 'MISSING');
    console.log('  rent_property_lot_partial:', columns.includes('rent_property_lot_partial') ? 'EXISTS' : 'MISSING');
    console.log('  rent_property_lot_standalone:', columns.includes('rent_property_lot_standalone') ? 'EXISTS' : 'MISSING');
}

main().catch(console.error);
