// scripts/debug-property-fetch.js
// 模擬前端 fetchProperties 函數的行為，特別是 created_by 隔離邏輯

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  console.log('🔍 模擬前端查詢\n');
  console.log('='.repeat(70));

  // 1. 列出所有物業（不過濾 is_deleted，看看實際情況）
  const { data: allProps, error: e1 } = await supabase
    .from('properties')
    .select('id, name, code, status, type, is_deleted, created_by, deleted_at')
    .order('code');

  if (e1) {
    console.error('❌ 查詢失敗:', e1.message);
    return;
  }

  console.log(`📊 全部物業（含已刪除）共 ${allProps.length} 筆\n`);

  // 按 is_deleted 分組
  const active = allProps.filter(p => p.is_deleted === false);
  const deleted = allProps.filter(p => p.is_deleted === true);

  console.log(`✅ is_deleted=false: ${active.length} 筆`);
  console.log(`❌ is_deleted=true:  ${deleted.length} 筆`);
  console.log(`❓ is_deleted=其他:  ${allProps.length - active.length - deleted.length} 筆`);

  console.log('\n--- 檢查重複編號 ---');
  const codeMap = new Map();
  active.forEach(p => {
    if (!codeMap.has(p.code)) codeMap.set(p.code, []);
    codeMap.get(p.code).push(p);
  });

  codeMap.forEach((arr, code) => {
    if (arr.length > 1) {
      console.log(`⚠️  重複編號 ${code}: ${arr.length} 筆`);
      arr.forEach(p => {
        console.log(`   - ${p.id.slice(0, 8)}... ${p.name}`);
      });
    }
  });

  console.log('\n--- 檢查 created_by 隔離 ---');
  const creatorMap = new Map();
  active.forEach(p => {
    const c = p.created_by || '(無)';
    if (!creatorMap.has(c)) creatorMap.set(c, 0);
    creatorMap.set(c, creatorMap.get(c) + 1);
  });

  creatorMap.forEach((count, creator) => {
    console.log(`👤 ${creator}: ${count} 筆物業`);
  });

  console.log('\n--- 模擬前端 usePropertiesQuery（anon key）---');
  const anonSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // 模擬用戶：先查詢所有 active 的（模擬未登入或 admin 狀態）
  const { data: anonProps, error: e2 } = await anonSupabase
    .from('properties')
    .select('id, name, code, is_deleted')
    .eq('is_deleted', false)
    .order('code');

  if (e2) {
    console.error('❌ Anon 查詢失敗:', e2.message);
    console.error('   details:', e2.details);
    console.error('   hint:', e2.hint);
    console.error('   code:', e2.code);
  } else {
    console.log(`📊 anon key 查到 ${anonProps?.length || 0} 筆物業`);
  }

  // 列出所有用戶（包括 admin）
  console.log('\n--- 用戶清單 ---');
  const { data: users, error: eu } = await supabase
    .from('users')
    .select('id, username, display_name, role');

  if (eu) {
    console.error('❌ 用戶查詢失敗:', eu.message);
  } else {
    users?.forEach(u => {
      console.log(`👤 ${u.username} | role=${u.role} | id=${u.id.slice(0, 8)}... | display=${u.display_name}`);
    });
  }

  console.log('\n✨ 模擬完成');
}

main();
