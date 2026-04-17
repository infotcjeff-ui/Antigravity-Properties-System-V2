/**
 * 驗證 partial 欄位讀取
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kyuezxvnufrjdevkbvkj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5dWV6eHZudWZyamRldmtidmtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4Mzg0NzIsImV4cCI6MjA4NjQxNDQ3Mn0.KlY1j8dXADzzIiz0rCpTv747h2-XhklzWbiYYeDi7BU';

const supabase = createClient(supabaseUrl, supabaseKey);

const toCamel = (obj) => {
    if (!obj) return obj;
    const newObj = {};
    for (const key in obj) {
        const camelKey = key.replace(/([-_][a-z])/ig, ($1) => $1.toUpperCase().replace('-', '').replace('_', ''));
        newObj[camelKey] = obj[key];
    }
    return newObj;
};

async function verify() {
    console.log('驗證 partial 欄位讀取...\n');

    // 讀取記錄
    const { data, error } = await supabase
        .from('rents')
        .select('*')
        .eq('id', '89ae4007-c8a6-4591-8a5f-5e52cd2f12e1')
        .single();

    if (error) {
        console.log('錯誤:', error.message);
        return;
    }

    const camel = toCamel(data);

    console.log('原數據:');
    console.log('  rent_property_lot_partial:', data.rent_property_lot_partial, '(類型:', typeof data.rent_property_lot_partial, ')');
    console.log();
    console.log('toCamel 後:');
    console.log('  rentPropertyLotPartial:', camel.rentPropertyLotPartial, '(類型:', typeof camel.rentPropertyLotPartial, ')');
    console.log();

    // 模擬 formStateFromRent 的邏輯
    console.log('模擬 formStateFromRent 解析:');
    const v = camel.rentPropertyLotPartial ?? camel.rent_property_lot_partial;
    console.log('  v =', v);
    if (typeof v === 'object' && v !== null) {
        console.log('  結果: 直接使用對象');
    } else if (typeof v === 'string' && v.trim()) {
        try {
            const parsed = JSON.parse(v);
            console.log('  結果: JSON.parse 成功 =', parsed);
        } catch (e) {
            console.log('  結果: JSON.parse 失敗');
        }
    } else {
        console.log('  結果: 返回空對象 {}');
    }
}

verify();