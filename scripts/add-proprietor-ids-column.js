/**
 * 遷移腳本：在 properties 表新增 proprietor_ids 欄位（TEXT[] 陣列）
 *
 * 使用方式：
 *   node scripts/add-proprietor-ids-column.js
 *
 * 此腳本會檢查欄位是否存在，如果不存在則顯示需要執行的 SQL 語句。
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kyuezxvnufrjdevkbvkj.supabase.co';

// 使用 ANON Key（只能讀取，不能執行 DDL）
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5dWV6eHZudWZyamRldmtidmtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4Mzg0NzIsImV4cCI6MjA4NjQxNDQ3Mn0.KlY1j8dXADzzIiz0rCpTv747h2-XhklzWbiYYeDi7BU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function migrate() {
    console.log('='.repeat(60));
    console.log('遷移腳本：新增 properties.proprietor_ids 欄位');
    console.log('='.repeat(60));
    console.log();

    try {
        // Step 1: 嘗試讀取欄位
        console.log('[1/2] 檢查 proprietor_ids 欄位是否存在...');
        const { data, error } = await supabase
            .from('properties')
            .select('id, name, proprietor_id, proprietor_ids')
            .limit(1);

        if (!error) {
            console.log('      ✓ 欄位已存在！遷移已完成。\n');
            console.log('      測試讀取示例：');
            if (data && data.length > 0) {
                console.log(`      - ${data[0].name}: proprietor_ids = ${JSON.stringify(data[0].proprietor_ids)}`);
            }
            console.log('\n✅ 遷移完成！');
            return;
        }

        if (error.message.includes('proprietor_ids')) {
            console.log('      ✗ 欄位不存在，需要新增。\n');
        } else {
            console.log('      讀取錯誤:', error.message);
            console.log('      繼續檢查...\n');
        }

        // Step 2: 顯示需要執行的 SQL
        console.log('[2/2] 請在 Supabase Dashboard 中執行以下 SQL：');
        console.log();
        console.log('  1. 前往 https://supabase.com/dashboard/project/kyuezxvnufrjdevkbvkj');
        console.log('  2. 左側選單 > SQL Editor');
        console.log('  3. 點擊 "New Query"');
        console.log('  4. 貼上以下 SQL 並點擊 "Run"：');
        console.log();
        console.log('  ' + '-'.repeat(50));
        console.log('  ALTER TABLE properties');
        console.log('  ADD COLUMN IF NOT EXISTS proprietor_ids TEXT[]');
        console.log('  DEFAULT ARRAY[]::TEXT[];');
        console.log('  ' + '-'.repeat(50));
        console.log();
        console.log('  執行成功後重新整理頁面即可。\n');

    } catch (err) {
        console.error('\n❌ 錯誤:', err.message || err);
    }
}

migrate();