/**
 * 除錯腳本：查看特定物業的已出租地段數
 * 先確認「紅毛潭6號」的 property_id，然後查看其 rent_out 記錄
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kyuezxvnufrjdevkbvkj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5dWV6eHZudWZyamRldmtidmtqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDgzODQ3MiwiZXhwIjoyMDg2NDE0NDcyfQ.chlpZ-HHkOMVF6hRJgewh1HfGSRHcmc0jIPxKPUSgkw'
);

async function main() {
  // 1. 找出「紅毛潭」相關的 properties
  console.log('=== 搜尋「紅毛潭」物業 ===');
  const { data: properties, error: propError } = await supabase
    .from('properties')
    .select('id, name, code, status')
    .ilike('name', '%紅毛潭%');

  if (propError) {
    console.error('物業查詢錯誤:', propError);
    return;
  }

  if (!properties || properties.length === 0) {
    console.log('找不到「紅毛潭」相關物業');
    // 嘗試用地址搜索
    const { data: byAddress } = await supabase
      .from('properties')
      .select('id, name, code, status')
      .ilike('address', '%紅毛潭%');
    console.log('按地址搜尋:', byAddress);
    return;
  }

  properties.forEach(p => {
    console.log(`\n[物業] ${p.name} (${p.code})`);
    console.log(`    ID: ${p.id}`);
    console.log(`    Status: ${p.status}`);
  });

  // 2. 對每個找到的物業，查詢其 rent_out 記錄
  for (const prop of properties) {
    console.log(`\n=== 查詢物業 ${prop.name} (${prop.id}) 的出租記錄 ===`);

    const { data: rents, error: rentError } = await supabase
      .from('rents')
      .select('id, type, rent_out_status, status, rent_property_lot')
      .eq('property_id', prop.id)
      .eq('type', 'rent_out');

    if (rentError) {
      console.error('租金查詢錯誤:', rentError);
      continue;
    }

    if (!rents || rents.length === 0) {
      console.log('  無出租記錄');
      continue;
    }

    console.log(`  共 ${rents.length} 筆記錄`);

    // 3. 顯示 active 記錄（renting 或 status=active）
    const activeRents = rents.filter(r =>
      r.rent_out_status === 'renting' || r.status === 'active'
    );

    console.log(`\n  Active 記錄（符合計算條件）: ${activeRents.length} 筆`);
    activeRents.forEach((r, i) => {
      console.log(`  [${i + 1}] rent_out_status: ${r.rent_out_status}, status: ${r.status}`);
      console.log(`      rent_property_lot: ${JSON.stringify(r.rent_property_lot)}`);
    });

    // 4. 顯示所有記錄的狀態分佈
    const statusMap = {};
    rents.forEach(r => {
      const key = `${r.rent_out_status}/${r.status}`;
      statusMap[key] = (statusMap[key] || 0) + 1;
    });
    console.log('  狀態分佈:', statusMap);
  }
}

main().catch(console.error);
