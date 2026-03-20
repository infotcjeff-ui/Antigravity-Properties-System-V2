// 临时脚本：移除 A01-P001 与"泊車易管理有限公司"的关联
import { createClient } from '@supabase/supabase-js';

// 注意：需要从环境变量获取 Supabase 配置
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('请设置 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixSubLandlordAssociation() {
  try {
    // 1. 查找名为"泊車易管理有限公司"的二房东
    const { data: subLandlords, error: fetchError } = await supabase
      .from('sub_landlords')
      .select('*')
      .ilike('name', '%泊車易管理有限公司%');

    if (fetchError) {
      console.error('查询二房东失败:', fetchError);
      return;
    }

    if (!subLandlords || subLandlords.length === 0) {
      console.log('未找到名为"泊車易管理有限公司"的二房东');
      return;
    }

    console.log(`找到 ${subLandlords.length} 个匹配的二房东:`);
    subLandlords.forEach((sl, idx) => {
      console.log(`${idx + 1}. ID: ${sl.id}, 名称: ${sl.name}, 出租号码: ${sl.tenancy_number}`);
    });

    // 2. 更新每个匹配的二房东，从 tenancy_number 中移除 A01-P001
    for (const subLandlord of subLandlords) {
      if (!subLandlord.tenancy_number) {
        console.log(`跳过 ${subLandlord.name} (ID: ${subLandlord.id})，因为没有出租号码`);
        continue;
      }

      const currentTenancyNumber = subLandlord.tenancy_number;
      console.log(`\n处理: ${subLandlord.name} (ID: ${subLandlord.id})`);
      console.log(`当前出租号码: ${currentTenancyNumber}`);

      // 移除 A01-P001
      const parts = currentTenancyNumber.split(',').map(p => p.trim());
      const filteredParts = parts.filter(part => {
        const normalizedPart = part.trim();
        const propertyCode = 'A01-P001';
        
        // 完全匹配
        if (normalizedPart === propertyCode) {
          return false; // 移除
        }
        
        // 前缀匹配
        if (normalizedPart.startsWith(propertyCode + '-')) {
          return false; // 移除
        }
        
        // 检查是否是 A01-P001 的前缀
        if (propertyCode.startsWith(normalizedPart + '-')) {
          return false; // 移除
        }
        
        // 检查前缀是否相同（如 A01 匹配 A01-P001）
        const partDashIndex = normalizedPart.indexOf('-');
        const propertyDashIndex = propertyCode.indexOf('-');
        if (partDashIndex > 0 && propertyDashIndex > 0) {
          const partPrefix = normalizedPart.substring(0, partDashIndex);
          const propertyPrefix = propertyCode.substring(0, propertyDashIndex);
          if (partPrefix === propertyPrefix) {
            return false; // 移除
          }
        }
        
        return true; // 保留
      });

      const newTenancyNumber = filteredParts.join(', ').trim();
      
      if (newTenancyNumber === currentTenancyNumber) {
        console.log(`  无需更新，未找到 A01-P001`);
        continue;
      }

      console.log(`  新出租号码: ${newTenancyNumber || '(空)'}`);

      // 更新数据库
      const { error: updateError } = await supabase
        .from('sub_landlords')
        .update({
          tenancy_number: newTenancyNumber || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', subLandlord.id);

      if (updateError) {
        console.error(`  更新失败 (ID: ${subLandlord.id}):`, updateError);
      } else {
        console.log(`  ✓ 成功更新`);
      }
    }

    console.log('\n完成！');
  } catch (error) {
    console.error('执行失败:', error);
  }
}

fixSubLandlordAssociation();
