/**
 * 檢查 rents 表結構中是否包含 rent_property_lot_partial 欄位
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kyuezxvnufrjdevkbvkj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5dWV6eHZudWZyamRldmtidmtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4Mzg0NzIsImV4cCI6MjA4NjQxNDQ3Mn0.KlY1j8dXADzzIiz0rCpTv747h2-XhklzWbiYYeDi7BU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log('檢查 rents 表結構...\n');

    try {
        const { data, error } = await supabase
            .from('rents')
            .select('*')
            .limit(1);

        if (error) {
            console.log('錯誤:', error.message);
            return;
        }

        if (data && data.length > 0) {
            const columns = Object.keys(data[0]);
            console.log('rents 表欄位 (' + columns.length + ' 個):');
            console.log();
            columns.forEach(col => {
                const val = data[0][col];
                let preview = '';
                if (val === null) preview = 'NULL';
                else if (val === undefined) preview = 'undefined';
                else if (typeof val === 'string') preview = '"' + val.substring(0, 50) + '"';
                else if (typeof val === 'boolean') preview = String(val);
                else if (typeof val === 'number') preview = String(val);
                else if (Array.isArray(val)) preview = 'Array[' + val.length + ']';
                else if (typeof val === 'object') preview = 'Object';
                else preview = String(val);
                console.log('  - ' + col + ' = ' + preview);
            });

            const hasPartial = columns.includes('rent_property_lot_partial');
            console.log();
            console.log('rent_property_lot_partial 欄位: ' + (hasPartial ? '✓ 存在' : '✗ 不存在'));

            if (!hasPartial) {
                console.log();
                console.log('需要新增欄位。請在 Supabase Dashboard 執行：');
                console.log();
                console.log('ALTER TABLE rents ADD COLUMN IF NOT EXISTS rent_property_lot_partial JSONB;');
            }
        } else {
            console.log('rents 表是空的');
        }
    } catch (err) {
        console.error('錯誤:', err);
    }
}

check();