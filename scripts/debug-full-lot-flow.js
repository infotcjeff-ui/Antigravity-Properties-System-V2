/**
 * 調試腳本：檢查地段選擇功能的完整數據流
 * 1. 檢查 properties 表的 lotIndex 格式
 * 2. 檢查 rents 表的地段欄位
 * 3. 類比瀏覽器的數據轉換邏輯
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kyuezxvnufrjdevkbvkj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5dWV6eHZudWZyamRldmtidmtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4Mzg0NzIsImV4cCI6MjA4NjQxNDQ3Mn0.KlY1j8dXADzzIiz0rCpTv747h2-XhklzWbiYYeDi7BU';

const supabase = createClient(supabaseUrl, supabaseKey);

// 類比 parsePropertyLotSegments
function parsePropertyLotSegments(lotIndex) {
    if (!lotIndex?.trim()) return [];
    return lotIndex
        .split(/(?:新|舊):/)
        .map((s) => s.trim())
        .filter(Boolean);
}

// 類比 formStateFromRent
function parseRentPropertyLot(rent) {
    const v = rent.rentPropertyLot ?? rent.rent_property_lot;
    if (Array.isArray(v)) return v.map(String);
    if (typeof v === 'string' && v.trim()) {
        try {
            const parsed = JSON.parse(v);
            if (Array.isArray(parsed)) return parsed.map(String);
        } catch { /* fall through */ }
        return [v.trim()];
    }
    return [];
}

async function debug() {
    console.log('='.repeat(60));
    console.log('調試：地段選擇完整數據流');
    console.log('='.repeat(60));
    console.log();

    // Step 1: 獲取所有有地段資料的物业
    console.log('[1] 檢查物业的地段資料...');
    const { data: properties } = await supabase
        .from('properties')
        .select('id, name, code, lot_index')
        .eq('is_deleted', false)
        .not('lot_index', 'is', null);

    if (!properties || properties.length === 0) {
        console.log('沒有找到有地段資料的物业');
    } else {
        console.log(`找到 ${properties.length} 個有地段資料的物业:`);
        properties.forEach(p => {
            const segments = parsePropertyLotSegments(p.lot_index);
            console.log(`  - ${p.name} (${p.code}): lot_index = "${p.lot_index}"`);
            console.log(`    -> parsePropertyLotSegments = [${segments.map(s => '"' + s + '"').join(', ')}]`);
        });
    }
    console.log();

    // Step 2: 檢查 rents 表的地段資料
    console.log('[2] 檢查 rents 表的地段資料...');
    const { data: rents } = await supabase
        .from('rents')
        .select('id, type, property_id, rent_property_lot, rent_property_lot_partial')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

    const rentsWithLot = rents.filter(r => r.rent_property_lot);
    console.log(`總記錄數: ${rents.length}, 有地段資料: ${rentsWithLot.length}`);

    if (rentsWithLot.length > 0) {
        rentsWithLot.forEach(r => {
            console.log(`  記錄 ${r.id}:`);
            console.log(`    property_id: ${r.property_id}`);
            console.log(`    rent_property_lot: ${r.rent_property_lot}`);
            console.log(`    rent_property_lot_partial: ${r.rent_property_lot_partial}`);
        });
    }
    console.log();

    // Step 3: 模擬完整流程
    console.log('[3] 類比完整編輯流程...');
    if (rentsWithLot.length > 0) {
        const testRent = rentsWithLot[0];
        console.log(`使用記錄 ${testRent.id} 進行測試:`);

        const parsedLot = parseRentPropertyLot(testRent);
        console.log(`  parseRentPropertyLot: [${parsedLot.map(s => '"' + s + '"').join(', ')}]`);

        // 檢查是否與物业的地段匹配
        const prop = properties.find(p => p.id === testRent.property_id);
        if (prop) {
            const propSegments = parsePropertyLotSegments(prop.lot_index);
            console.log(`  對應物业地段: [${propSegments.map(s => '"' + s + '"').join(', ')}]`);

            const missing = parsedLot.filter(l => !propSegments.includes(l));
            if (missing.length > 0) {
                console.log(`  ⚠️ 警告：記錄中的地段 "${missing.join(', ')}" 不在物业地段列表中！`);
            } else {
                console.log(`  ✓ 所有地段都匹配`);
            }
        }
    }
    console.log();

    // Step 4: 測試更新地段
    console.log('[4] 測試保存地段選擇...');
    if (properties && properties.length > 0) {
        const testProperty = properties[0];
        const segments = parsePropertyLotSegments(testProperty.lot_index);

        if (segments.length > 0) {
            const testLots = [segments[0]];
            const testPartial = {};
            testPartial[segments[0]] = true;

            // 查找該物业的一條記錄
            const existingRent = rents.find(r => r.property_id === testProperty.id);
            if (existingRent) {
                console.log(`更新記錄 ${existingRent.id}:`);
                console.log(`  rent_property_lot = ${JSON.stringify(testLots)}`);
                console.log(`  rent_property_lot_partial = ${JSON.stringify(testPartial)}`);

                const { data: updated, error } = await supabase
                    .from('rents')
                    .update({
                        rent_property_lot: JSON.stringify(testLots),
                        rent_property_lot_partial: JSON.stringify(testPartial),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existingRent.id)
                    .select()
                    .single();

                if (error) {
                    console.log(`  ❌ 更新失敗: ${error.message}`);
                } else {
                    console.log(`  ✓ 更新成功`);
                    console.log(`  更新後讀取:`);
                    console.log(`    rent_property_lot = ${updated.rent_property_lot}`);
                    console.log(`    rent_property_lot_partial = ${updated.rent_property_lot_partial}`);
                }
            }
        }
    }
}

debug();