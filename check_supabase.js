
const supabaseUrl = 'https://kyuezxvnufrjdevkbvkj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5dWV6eHZudWZyamRldmtidmtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4Mzg0NzIsImV4cCI6MjA4NjQxNDQ3Mn0.KlY1j8dXADzzIiz0rCpTv747h2-XhklzWbiYYeDi7BU';

async function checkTable(tableName) {
    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/${tableName}?select=*`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });

        if (!response.ok) {
            console.error(`Fetch ${tableName} failed:`, response.status, response.statusText);
            return 0;
        }

        const data = await response.json();
        console.log(`Table ${tableName}: Found ${data.length} records.`);
        if (data.length > 0) {
            data.slice(0, 2).forEach(r => console.log(`  - ${r.name || r.id}`));
        }
        return data.length;
    } catch (err) {
        console.error(`Error ${tableName}:`, err.message);
        return 0;
    }
}

async function run() {
    console.log('Checking all Supabase tables...');
    await checkTable('properties');
    await checkTable('proprietors');
    await checkTable('rents');
}

run();
