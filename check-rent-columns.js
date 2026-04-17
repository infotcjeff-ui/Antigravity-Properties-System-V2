// 檢查數據庫表結構中是否存在 rent_property_lot_partial 列
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('缺少 Supabase 配置！請檢查 .env.local 文件');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSchema() {
    console.log('檢查 rents 表結構...\n');

    // 嘗試查詢錶結構（PostgreSQL）
    const { data, error } = await supabase
        .from('rents')
        .select('*')
        .limit(1);

    if (error) {
        console.error('查詢錯誤:', error);
        return;
    }

    // 獲取第一行的鍵（列名）
    if (data && data.length > 0) {
        console.log('rents 表的列：');
        Object.keys(data[0]).forEach(key => {
            console.log(`  - ${key}`);
        });

        // 檢查是否存在特定列
        const columns = Object.keys(data[0]);
        console.log('\n檢查關鍵列：');
        console.log(`  rent_property_lot: ${columns.includes('rent_property_lot') ? '✓ 存在' : '✗ 缺失'}`);
        console.log(`  rent_property_lot_partial: ${columns.includes('rent_property_lot_partial') ? '✓ 存在' : '✗ 缺失'}`);
        console.log(`  rent_property_lot_standalone: ${columns.includes('rent_property_lot_standalone') ? '✓ 存在' : '✗ 缺失'}`);
    } else {
        console.log('rents 表為空或無法讀取');
    }

    // 測試更新一條記錄，看看是否能寫入這些字段
    console.log('\n測試寫入新字段...');

    // 查找一條記錄
    const { data: rents, error: rentError } = await supabase
        .from('rents')
        .select('id')
        .limit(1);

    if (rentError || !rents || rents.length === 0) {
        console.log('無法找到測試記錄');
        return;
    }

    const testId = rents[0].id;
    const testData = {
        rent_property_lot_partial: JSON.stringify({ "地段A": true })
    };

    const { error: updateError } = await supabase
        .from('rents')
        .update(testData)
        .eq('id', testId);

    if (updateError) {
        console.error('更新失敗:', updateError);
    } else {
        console.log('更新成功！');

        // 讀取回來驗證
        const { data: updated, error: readError } = await supabase
            .from('rents')
            .select('rent_property_lot_partial')
            .eq('id', testId)
            .single();

        if (readError) {
            console.error('讀取失敗:', readError);
        } else {
            console.log('讀取的 rent_property_lot_partial:', updated?.rent_property_lot_partial);
        }

        // 清除測試數據
        await supabase
            .from('rents')
            .update({ rent_property_lot_partial: null })
            .eq('id', testId);
        console.log('測試數據已清除');
    }
}

checkSchema().catch(console.error);
