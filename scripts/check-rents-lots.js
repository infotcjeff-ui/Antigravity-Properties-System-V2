/**
 * 檢查 rents 表中哪些記錄有地段資料
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kyuezxvnufrjdevkbvkj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5dWV6eHZudWZyamRldmtidmtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4Mzg0NzIsImV4cCI6MjA4NjQxNDQ3Mn0.KlY1j8dXADzzIiz0rCpTv747h2-XhklzWbiYYeDi7BU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log('檢查 rents 表中的地段資料...\n');

    try {
        // 查找有地段資料的記錄
        const { data, error } = await supabase
            .from('rents')
            .select('id, type, rent_property_lot, rent_property_lot_partial, rent_property_lot_standalone')
            .eq('is_deleted', false)
            .not('rent_property_lot', 'is', null);

        if (error) {
            console.log('錯誤:', error.message);
            return;
        }

        console.log('有地段資料的記錄數量: ' + (data?.length || 0));
        console.log();

        if (data && data.length > 0) {
            data.forEach(r => {
                console.log('記錄 ID: ' + r.id);
                console.log('  type: ' + r.type);
                console.log('  rent_property_lot: ' + JSON.stringify(r.rent_property_lot));
                console.log('  rent_property_lot_partial: ' + JSON.stringify(r.rent_property_lot_partial));
                console.log('  rent_property_lot_standalone: ' + JSON.stringify(r.rent_property_lot_standalone));
                console.log();
            });
        }

        // 也檢查有多少記錄有 partial 資料
        const { data: partialData, error: partialError } = await supabase
            .from('rents')
            .select('id, type, rent_property_lot_partial')
            .eq('is_deleted', false)
            .not('rent_property_lot_partial', 'is', null);

        console.log('有 partial 資料的記錄數量: ' + (partialData?.length || 0));

    } catch (err) {
        console.error('錯誤:', err);
    }
}

check();