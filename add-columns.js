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
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        envVars[match[1].trim()] = value;
    }
});

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
    console.log('檢查並添加缺失的列...\n');

    // 檢查現有的列
    const { data: checkData } = await supabase.from('rents').select('*').limit(1);
    const columns = Object.keys(checkData?.[0] || {});

    console.log('當前列狀態：');
    console.log('  rent_property_lot:', columns.includes('rent_property_lot') ? '✓ 存在' : '✗ 缺失');
    console.log('  rent_property_lot_standalone:', columns.includes('rent_property_lot_standalone') ? '✓ 存在' : '✗ 缺失');
    console.log('  rent_property_lot_partial:', columns.includes('rent_property_lot_partial') ? '✓ 存在' : '✗ 缺失');

    if (columns.includes('rent_property_lot') && columns.includes('rent_property_lot_standalone')) {
        console.log('\n所有必需的列都已存在！');
        return;
    }

    // 嘗試添加列
    console.log('\n嘗試添加缺失的列...');

    // 嘗試插入一條新記錄，看看是否能觸發列的創建
    const testId = 'test-' + Date.now();
    const { error: insertError } = await supabase
        .from('rents')
        .insert({
            id: testId,
            property_id: '00000000-0000-0000-0000-000000000000', // 測試用的 UUID
            type: 'contract',
            rent_property_lot: '["地段A"]',
            rent_property_lot_standalone: false,
            rent_property_lot_partial: '{"地段A": false}'
        });

    if (insertError) {
        console.log('插入測試記錄失敗：', insertError.message);
    } else {
        console.log('測試記錄插入成功！');

        // 刪除測試記錄
        await supabase.from('rents').delete().eq('id', testId);
        console.log('測試記錄已刪除');
    }

    // 再次檢查
    const { data: newCheckData } = await supabase.from('rents').select('*').limit(1);
    const newColumns = Object.keys(newCheckData?.[0] || {});

    console.log('\n更新後的列狀態：');
    console.log('  rent_property_lot:', newColumns.includes('rent_property_lot') ? '✓ 存在' : '✗ 缺失');
    console.log('  rent_property_lot_standalone:', newColumns.includes('rent_property_lot_standalone') ? '✓ 存在' : '✗ 缺失');
    console.log('  rent_property_lot_partial:', newColumns.includes('rent_property_lot_partial') ? '✓ 存在' : '✗ 缺失');

    if (!newColumns.includes('rent_property_lot') || !newColumns.includes('rent_property_lot_standalone')) {
        console.log('\n需要手動執行 SQL 來添加列！');
        console.log('請在 Supabase Dashboard > SQL Editor 中執行：');
        console.log('');
        console.log('ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_property_lot TEXT;');
        console.log('ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_property_lot_standalone BOOLEAN;');
    }
}

main().catch(console.error);