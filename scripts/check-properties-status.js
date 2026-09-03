// scripts/check-properties-status.js
// 檢查物業概覽頁面顯示異常 - 物業清失
// 用途：確認 properties 表中資料狀態（特別 is_deleted 欄位）

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 直接讀取 .env.local 文件
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const match = trimmed.match(/^([^#=]+)=["']?(.+?)["']?$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim();
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error('錯誤: 缺少 NEXT_PUBLIC_SUPABASE_URL');
  process.exit(1);
}

const supabaseKey = supabaseServiceKey || supabaseAnonKey;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🔍 開始檢查 properties 表的狀態\n');
  console.log('='.repeat(70));

  try {
    // 1. 總記錄數
    const { count: totalCount, error: totalError } = await supabase
      .from('properties')
      .select('*', { count: 'exact', head: true });

    if (totalError) {
      console.error('❌ 查詢總數失敗:', totalError.message);
    } else {
      console.log(`📊 物業總數（包含已刪除）: ${totalCount}`);
    }

    // 2. is_deleted = false 的記錄數（這是頁面實際顯示的）
    const { count: activeCount, error: activeError } = await supabase
      .from('properties')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', false);

    if (activeError) {
      console.error('❌ 查詢 active 數失敗:', activeError.message);
    } else {
      console.log(`📊 顯示中物業（is_deleted=false）: ${activeCount}`);
    }

    // 3. is_deleted = true 的記錄數
    const { count: deletedCount, error: deletedError } = await supabase
      .from('properties')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', true);

    if (deletedError) {
      console.error('❌ 查詢 deleted 數失敗:', deletedError.message);
    } else {
      console.log(`📊 已軟刪除物業（is_deleted=true）: ${deletedCount}`);
    }

    // 4. is_deleted 為 NULL 的記錄數（可能未設定欄位）
    const { count: nullCount, error: nullError } = await supabase
      .from('properties')
      .select('*', { count: 'exact', head: true })
      .is('is_deleted', null);

    if (nullError) {
      console.error('❌ 查詢 NULL 數失敗:', nullError.message);
    } else {
      console.log(`📊 is_deleted 為 NULL 的物業: ${nullCount}`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('📋 已軟刪除的物業明細（最多 30 筆）:');
    console.log('='.repeat(70));

    const { data: deletedRecords, error: listError } = await supabase
      .from('properties')
      .select('id, name, code, status, type, is_deleted, deleted_at, created_by, created_at')
      .eq('is_deleted', true)
      .order('deleted_at', { ascending: false })
      .limit(30);

    if (listError) {
      console.error('❌ 列出失敗:', listError.message);
    } else if (!deletedRecords || deletedRecords.length === 0) {
      console.log('✅ 沒有軟刪除的物業');
    } else {
      deletedRecords.forEach((p, i) => {
        console.log(`\n[${i + 1}] ${p.code || '(無編號)'} - ${p.name || '(無名稱)'}`);
        console.log(`    ID: ${p.id}`);
        console.log(`    狀態: ${p.status || '-'}`);
        console.log(`    類型: ${p.type || '-'}`);
        console.log(`    刪除時間: ${p.deleted_at || '-'}`);
        console.log(`    建立時間: ${p.created_at || '-'}`);
      });
    }

    // 5. 檢查前 5 筆 is_deleted=false 的記錄
    console.log('\n' + '='.repeat(70));
    console.log('📋 顯示中物業範例（前 5 筆）:');
    console.log('='.repeat(70));

    const { data: activeRecords, error: activeListError } = await supabase
      .from('properties')
      .select('id, name, code, status, type, is_deleted')
      .eq('is_deleted', false)
      .order('code', { ascending: true })
      .limit(5);

    if (activeListError) {
      console.error('❌ 列出失敗:', activeListError.message);
    } else if (!activeRecords || activeRecords.length === 0) {
      console.log('❌ 沒有任何 active 物業！');
    } else {
      activeRecords.forEach((p, i) => {
        console.log(`[${i + 1}] ${p.code} - ${p.name} | status=${p.status} | is_deleted=${p.is_deleted}`);
      });
    }

    console.log('\n✨ 檢查完成');
  } catch (err) {
    console.error('❌ 執行失敗:', err);
    process.exit(1);
  }
}

main();
