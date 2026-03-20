'use client';

import { useState } from 'react';
import { Button } from '@heroui/react';
import { useSubLandlordsQuery } from '@/hooks/useStorage';
import { supabase } from '@/lib/supabase';

export default function FixSubLandlordPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { data: subLandlords, refetch } = useSubLandlordsQuery();

  const handleFix = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      // 查找"泊車易管理有限公司"
      const targetSubLandlord = subLandlords?.find(sl => 
        sl.name?.includes('泊車易管理有限公司')
      );

      if (!targetSubLandlord) {
        setResult({ error: '未找到"泊車易管理有限公司"' });
        return;
      }

      if (!targetSubLandlord.tenancyNumber) {
        setResult({ error: '该二房东没有出租号码' });
        return;
      }

      const currentTenancyNumber = targetSubLandlord.tenancyNumber;
      const propertyCode = 'A01-P001';

      // 移除 A01-P001
      const parts = currentTenancyNumber.split(',').map(p => p.trim());
      const filteredParts = parts.filter(part => {
        const normalizedPart = part.trim();
        const normalizedPropertyCode = propertyCode.trim();
        
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
        setResult({ 
          message: '未找到 A01-P001，无需更新',
          oldValue: currentTenancyNumber
        });
        return;
      }

      // 更新数据库
      const { error: updateError } = await supabase
        .from('sub_landlords')
        .update({
          tenancy_number: newTenancyNumber || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', targetSubLandlord.id);

      if (updateError) {
        setResult({ 
          error: '更新失败', 
          details: updateError.message 
        });
      } else {
        setResult({
          success: true,
          message: '修复成功！',
          oldValue: currentTenancyNumber,
          newValue: newTenancyNumber || '(空)'
        });
        // 刷新数据
        await refetch();
      }
    } catch (error: any) {
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">修复二房东关联</h1>
      
      <div className="mb-4">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          此工具将从"泊車易管理有限公司"的出租号码中移除 A01-P001
        </p>
        <Button 
          color="primary" 
          onPress={handleFix}
          isLoading={loading}
        >
          {loading ? '处理中...' : '执行修复'}
        </Button>
      </div>

      {result && (
        <div className={`mt-6 p-4 rounded-lg ${
          result.error ? 'bg-red-100 dark:bg-red-900/20' : 
          result.success ? 'bg-green-100 dark:bg-green-900/20' : 
          'bg-gray-100 dark:bg-gray-800'
        }`}>
          <h2 className="font-bold mb-2">
            {result.error ? '错误：' : result.success ? '成功：' : '结果：'}
          </h2>
          <div className="text-sm space-y-1">
            {result.message && <p>{result.message}</p>}
            {result.oldValue && (
              <p><strong>旧值：</strong>{result.oldValue}</p>
            )}
            {result.newValue && (
              <p><strong>新值：</strong>{result.newValue}</p>
            )}
            {result.error && <p className="text-red-600 dark:text-red-400">{result.error}</p>}
            {result.details && <p className="text-sm text-gray-600 dark:text-gray-400">{result.details}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
