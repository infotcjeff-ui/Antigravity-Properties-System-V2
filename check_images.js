const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function getEnv(key) {
    const envFile = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
    for (const line of envFile.split('\n')) {
        if (line.trim().startsWith(key + '=')) return line.split('=')[1].trim();
    }
    return null;
}

const supabase = createClient(getEnv('NEXT_PUBLIC_SUPABASE_URL'), getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'));

(async () => {
    // Check all properties for image/geomap data
    const { data, error } = await supabase
        .from('properties')
        .select('id, name, code, images, geo_maps')
        .eq('is_deleted', false)
        .order('code', { ascending: true });

    if (error) { console.error(error); return; }

    console.log(`Total properties: ${data.length}\n`);
    data.forEach(p => {
        const imgCount = p.images?.length || 0;
        const geoCount = p.geo_maps?.length || 0;
        console.log(`[${p.code}] ${p.name} (${p.id.substring(0, 8)}...) -> images: ${imgCount}, geo_maps: ${geoCount}`);
    });
})();
