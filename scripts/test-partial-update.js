/**
 * 調試腳本：直接更新一個記錄的 partial 欄位
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kyuezxvnufrjdevkbvkj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5dWV6eHZudWZyamRldmtidmtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4Mzg0NzIsImV4cCI6MjA4NjQxNDQ3Mn0.KlY1j8dXADzzIiz0rCpTv747h2-XhklzWbiYYeDi7BU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    console.log('測試更新 partial 欄位...\n');

    // 找到一個有地段資料的記錄
    const { data: existingRecords } = await supabase
        .from('rents')
        .select('id, rent_property_lot, rent_property_lot_partial')
        .eq('is_deleted', false)
        .not('rent_property_lot', 'is', null)
        .limit(1);

    if (!existingRecords || existingRecords.length === 0) {
        console.log('沒有找到有地段資料的記錄');
        return;
    }

    const recordId = existingRecords[0].id;
    console.log('找到記錄 ID:', recordId);
    console.log('現有 rent_property_lot:', existingRecords[0].rent_property_lot);
    console.log('現有 rent_property_lot_partial:', existingRecords[0].rent_property_lot_partial);
    console.log();

    // 嘗試更新 partial 欄位
    const partialData = JSON.stringify({
        'DD111 LOT 3151': true,
        'DD111 LOT 1524': false
    });

    console.log('嘗試更新 partial 為:', partialData);
    console.log();

    const { data, error, status } = await supabase
        .from('rents')
        .update({
            rent_property_lot_partial: partialData,
            updated_at: new Date().toISOString()
        })
        .eq('id', recordId)
        .select()
        .single();

    if (error) {
        console.log('更新失敗!');
        console.log('錯誤:', error.message);
        console.log('代碼:', error.code);
        console.log('詳情:', error.details);
        console.log('提示:', error.hint);
    } else {
        console.log('更新成功!');
        console.log('更新後的 rent_property_lot_partial:', data.rent_property_lot_partial);
    }
}

test();