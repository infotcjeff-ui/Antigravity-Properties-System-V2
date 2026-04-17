const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 讀取 .env.local
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};

envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        let value = match[2].trim();
        // 移除引號
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        envVars[match[1].trim()] = value;
    }
});

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
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
    console.log('=== rents 表的列 ===');
    columns.forEach(c => console.log('  -', c));

    console.log('\n=== 關鍵列檢查 ===');
    console.log('  rent_property_lot:', columns.includes('rent_property_lot') ? '✓ 存在' : '✗ 缺失');
    console.log('  rent_property_lot_partial:', columns.includes('rent_property_lot_partial') ? '✓ 存在' : '✗ 缺失');
    console.log('  rent_property_lot_standalone:', columns.includes('rent_property_lot_standalone') ? '✓ 存在' : '✗ 缺失');
}

main().catch(console.error);