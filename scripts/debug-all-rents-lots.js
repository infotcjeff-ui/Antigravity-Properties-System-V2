/**
 * 調試：直接查詢一條記錄的所有地段相關欄位
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kyuezxvnufrjdevkbvkj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5dWV6eHZudWZyamRldmtidmtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4Mzg0NzIsImV4cCI6MjA4NjQxNDQ3Mn0.KlY1j8dXADzzIiz0rCpTv747h2-XhklzWbiYYeDi7BU';

const supabase = createClient(supabaseUrl, supabaseKey);

const toCamel = (obj) => {
    if (!obj) return obj;
    const newObj = {};
    for (const key in obj) {
        const camelKey = key.replace(/([-_][a-z])/ig, ($1) => $1.toUpperCase().replace('-', '').replace('_', ''));
        newObj[camelKey] = obj[key];
    }
    return newObj;
};

async function debug() {
    console.log('查詢所有收租記錄的地段欄位...\n');

    const { data, error } = await supabase
        .from('rents')
        .select('id, type, property_id, rent_property_lot, rent_property_lot_partial, rent_property_lot_standalone')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

    if (error) {
        console.log('錯誤:', error.message);
        return;
    }

    console.log(`總記錄數: ${data.length}`);
    console.log();

    data.forEach(r => {
        const camel = toCamel(r);
        console.log(`ID: ${r.id}`);
        console.log(`  type: ${r.type}`);
        console.log(`  rent_property_lot: ${JSON.stringify(r.rent_property_lot)}`);
        console.log(`  rent_property_lot_partial: ${JSON.stringify(r.rent_property_lot_partial)} (類型: ${typeof r.rent_property_lot_partial})`);
        console.log(`  -> toCamel 後 rentPropertyLotPartial: ${JSON.stringify(camel.rentPropertyLotPartial)} (類型: ${typeof camel.rentPropertyLotPartial})`);
        if (camel.rentPropertyLotPartial) {
            console.log(`  -> 解析後:`, camel.rentPropertyLotPartial);
        }
        console.log();
    });
}

debug();