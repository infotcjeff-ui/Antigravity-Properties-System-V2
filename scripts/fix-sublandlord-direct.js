// scripts/fix-sublandlord-direct.js
// 直接修復二房東與物業關聯 - 使用 Supabase 客戶端
// 運行方式: node scripts/fix-sublandlord-direct.js

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 直接讀取 .env.local 文件
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    // 忽略註釋和空行
    if (!trimmed || trimmed.startsWith('#')) return;
    // 匹配 key=value 或 key="value" 格式
    const match = trimmed.match(/^([^#=]+)=["']?(.+?)["']?$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim();
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('錯誤: 請確保 .env.local 文件中設置了 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY');
  console.error('  當前 NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '已設置' : '未設置');
  console.error('  當前 NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseKey ? '已設置' : '未設置');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixSubLandlord(propertyCode, subLandlordName) {
  console.log(`\n🔧 開始修復: 從「${subLandlordName}」移除「${propertyCode}」\n`);

  try {
    // 1. 查找匹配的二房東
    const { data: subLandlords, error: fetchError } = await supabase
      .from('sub_landlords')
      .select('*')
      .ilike('name', `%${subLandlordName}%`)
      .eq('is_deleted', false);

    if (fetchError) {
      console.error('❌ 查詢失敗:', fetchError.message);
      return;
    }

    if (!subLandlords || subLandlords.length === 0) {
      console.log(`❌ 未找到名為「${subLandlordName}」的二房東`);
      return;
    }

    // 2. 處理每個匹配的二房東
    for (const subLandlord of subLandlords) {
      if (!subLandlord.tenancy_number) {
        console.log(`⏭️ 跳過 ${subLandlord.name} (沒有出租號碼)`);
        continue;
      }

      const currentTenancyNumber = subLandlord.tenancy_number;
      console.log(`\n📋 ${subLandlord.name}`);
      console.log(`   當前出租號碼: ${currentTenancyNumber}`);

      // 移除目標物業編號
      const parts = currentTenancyNumber.split(',').map(p => p.trim());
      const filteredParts = parts.filter(part => {
        const normalizedPart = part.trim();
        const normalizedPropertyCode = propertyCode.trim();
        
        // 完全匹配
        if (normalizedPart === normalizedPropertyCode) {
          return false;
        }
        
        // 前綴匹配
        if (normalizedPart.startsWith(normalizedPropertyCode + '-')) {
          return false;
        }
        
        // 檢查是否是目標的前綴
        if (normalizedPropertyCode.startsWith(normalizedPart + '-')) {
          return false;
        }
        
        // 檢查前綴是否相同
        const partDashIndex = normalizedPart.indexOf('-');
        const propertyDashIndex = normalizedPropertyCode.indexOf('-');
        if (partDashIndex > 0 && propertyDashIndex > 0) {
          const partPrefix = normalizedPart.substring(0, partDashIndex);
          const propertyPrefix = normalizedPropertyCode.substring(0, propertyDashIndex);
          if (partPrefix === propertyPrefix) {
            return false;
          }
        }
        
        return true;
      });

      const newTenancyNumber = filteredParts.join(', ').trim();
      
      if (newTenancyNumber === currentTenancyNumber) {
        console.log(`   ℹ️ 未找到「${propertyCode}」，無需更新`);
        continue;
      }

      console.log(`   ✅ 新出租號碼: ${newTenancyNumber || '(空)'}`);

      // 更新數據庫
      const { error: updateError } = await supabase
        .from('sub_landlords')
        .update({
          tenancy_number: newTenancyNumber || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', subLandlord.id);

      if (updateError) {
        console.log(`   ❌ 更新失敗: ${updateError.message}`);
      } else {
        console.log(`   ✅ 更新成功`);
      }
    }

    console.log('\n✨ 修復完成\n');
  } catch (error) {
    console.error('❌ 執行失敗:', error);
  }
}

// 解析命令行參數
const args = process.argv.slice(2);
let propertyCode = 'A01-P001';
let subLandlordName = '泊車易管理有限公司';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--property' && args[i + 1]) {
    propertyCode = args[i + 1];
    i++;
  } else if (args[i] === '--name' && args[i + 1]) {
    subLandlordName = args[i + 1];
    i++;
  } else if (args[i] === '--help') {
    console.log(`
📖 使用方式:
  node scripts/fix-sublandlord-direct.js [選項]

選項:
  --property <編號>  指定要移除的物業編號 (默認: A01-P001)
  --name <名稱>      指定二房東名稱 (默認: 泊車易管理有限公司)
  --help             顯示幫助信息

示例:
  node scripts/fix-sublandlord-direct.js --property A01-P001 --name 泊車易管理有限公司
  node scripts/fix-sublandlord-direct.js --name 某某公司
    `);
    process.exit(0);
  }
}

fixSubLandlord(propertyCode, subLandlordName);
