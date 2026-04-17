/**
 * 調試腳本：類比瀏覽器的 fetchRents 查詢
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kyuezxvnufrjdevkbvkj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5dWV6eHZudWZyamRldmtidmtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4Mzg0NzIsImV4cCI6MjA4NjQxNDQ3Mn0.KlY1j8dXADzzIiz0rCpTv747h2-XhklzWbiYYeDi7BU';

const supabase = createClient(supabaseUrl, supabaseKey);

// 模擬 toCamel 函數
const toCamel = (obj) => {
    if (!obj) return obj;
    const newObj = {};
    for (const key in obj) {
        const camelKey = key.replace(/([-_][a-z])/ig, ($1) => $1.toUpperCase().replace('-', '').replace('_', ''));
        newObj[camelKey] = obj[key];
    }
    return newObj;
};

async function debug() {
    console.log('調試：fetchRents 返回的 rent_property_lot_partial 欄位\n');

    try {
        // 模擬 fetchRents 的查詢
        const { data, error } = await supabase
            .from('rents')
            .select('*')
            .eq('is_deleted', false)
            .order('created_at', { ascending: false });

        if (error) {
            console.log('查詢錯誤:', error.message);
            return;
        }

        // 找到有地段資料的記錄
        const recordsWithLot = data.filter(r => r.rent_property_lot || r.rentPropertyLot);

        console.log('有地段資料的記錄數量:', recordsWithLot.length);
        console.log();

        recordsWithLot.forEach(r => {
            const camel = toCamel(r);
            
            console.log('記錄 ID:', r.id);
            console.log('  === 原生欄位 ===');
            console.log('    rent_property_lot:', r.rent_property_lot);
            console.log('    rent_property_lot_partial:', r.rent_property_lot_partial);
            console.log('    (類型:', typeof r.rent_property_lot_partial, ')');
            
            console.log('  === toCamel 後 ===');
            console.log('    rentPropertyLot:', camel.rentPropertyLot);
            console.log('    rentPropertyLotPartial:', camel.rentPropertyLotPartial);
            console.log('    (類型:', typeof camel.rentPropertyLotPartial, ')');
            
            if (typeof camel.rentPropertyLotPartial === 'string') {
                try {
                    const parsed = JSON.parse(camel.rentPropertyLotPartial);
                    console.log('  === JSON.parse 後 ===');
                    console.log('    parsed:', parsed);
                } catch (e) {
                    console.log('  === JSON.parse 失敗 ===');
                    console.log('    錯誤:', e.message);
                }
            }
            console.log();
        });

    } catch (err) {
        console.error('錯誤:', err);
    }
}

debug();