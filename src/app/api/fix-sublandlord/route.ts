import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Supabase配置缺失' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { propertyCode, subLandlordName } = await request.json();

    // 默认值
    const targetPropertyCode = propertyCode || 'A01-P001';
    const targetName = subLandlordName || '泊車易管理有限公司';

    // 1. 查找匹配的二房东
    const { data: subLandlords, error: fetchError } = await supabase
      .from('sub_landlords')
      .select('*')
      .ilike('name', `%${targetName}%`)
      .eq('is_deleted', false);

    if (fetchError) {
      console.error('查询二房东失败:', fetchError);
      return NextResponse.json(
        { error: '查询失败', details: fetchError.message },
        { status: 500 }
      );
    }

    if (!subLandlords || subLandlords.length === 0) {
      return NextResponse.json(
        { message: `未找到名为"${targetName}"的二房东` },
        { status: 404 }
      );
    }

    const results = [];

    // 2. 更新每个匹配的二房东
    for (const subLandlord of subLandlords) {
      if (!subLandlord.tenancy_number) {
        results.push({
          id: subLandlord.id,
          name: subLandlord.name,
          status: 'skipped',
          reason: '没有出租号码'
        });
        continue;
      }

      const currentTenancyNumber = subLandlord.tenancy_number;
      
      // 移除目标物业编号
      const parts = currentTenancyNumber.split(',').map((p: string) => p.trim());
      const filteredParts = parts.filter((part: string) => {
        const normalizedPart = part.trim();
        const normalizedPropertyCode = targetPropertyCode.trim();
        
        // 完全匹配
        if (normalizedPart === normalizedPropertyCode) {
          return false; // 移除
        }
        
        // 前缀匹配
        if (normalizedPart.startsWith(normalizedPropertyCode + '-')) {
          return false; // 移除
        }
        
        // 检查是否是目标的前缀
        if (normalizedPropertyCode.startsWith(normalizedPart + '-')) {
          return false; // 移除
        }
        
        // 检查前缀是否相同（如 A01 匹配 A01-P001）
        const partDashIndex = normalizedPart.indexOf('-');
        const propertyDashIndex = normalizedPropertyCode.indexOf('-');
        if (partDashIndex > 0 && propertyDashIndex > 0) {
          const partPrefix = normalizedPart.substring(0, partDashIndex);
          const propertyPrefix = normalizedPropertyCode.substring(0, propertyDashIndex);
          if (partPrefix === propertyPrefix) {
            return false; // 移除
          }
        }
        
        return true; // 保留
      });

      const newTenancyNumber = filteredParts.join(', ').trim();
      
      if (newTenancyNumber === currentTenancyNumber) {
        results.push({
          id: subLandlord.id,
          name: subLandlord.name,
          status: 'no_change',
          reason: '未找到目标物业编号',
          oldValue: currentTenancyNumber
        });
        continue;
      }

      // 更新数据库
      const { error: updateError } = await supabase
        .from('sub_landlords')
        .update({
          tenancy_number: newTenancyNumber || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', subLandlord.id);

      if (updateError) {
        results.push({
          id: subLandlord.id,
          name: subLandlord.name,
          status: 'error',
          error: updateError.message,
          oldValue: currentTenancyNumber
        });
      } else {
        results.push({
          id: subLandlord.id,
          name: subLandlord.name,
          status: 'success',
          oldValue: currentTenancyNumber,
          newValue: newTenancyNumber || '(空)'
        });
      }
    }

    return NextResponse.json({
      message: '修复完成',
      results
    });

  } catch (error: any) {
    console.error('修复失败:', error);
    return NextResponse.json(
      { error: '修复失败', details: error.message },
      { status: 500 }
    );
  }
}
