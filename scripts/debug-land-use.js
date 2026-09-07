const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf-8');
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const match = trimmed.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data, error } = await supabase
    .from('properties')
    .select('id, name, code, status, land_use, is_deleted')
    .eq('is_deleted', false)
    .order('code');

  if (error) {
    console.error(error);
    return;
  }

  console.log('Total active properties:', data.length);

  const dist = {};
  data.forEach(p => {
    const lu = p.land_use || '(null)';
    if (!dist[lu]) dist[lu] = [];
    dist[lu].push(p.code);
  });

  console.log('\n--- land_use distribution ---');
  for (const [lu, codes] of Object.entries(dist)) {
    console.log(lu + ': ' + codes.length + ' properties - ' + codes.slice(0, 5).join(', ') + (codes.length > 5 ? '...' : ''));
  }

  console.log('\n--- Sample (first 10 properties) ---');
  data.slice(0, 10).forEach(p => {
    console.log(p.code, '|', JSON.stringify(p.land_use), '|', p.status);
  });

  // Filter by status = renting
  const renting = data.filter(p => (p.status || '').split(',').map(s => s.trim()).includes('renting'));
  console.log('\nTotal renting properties:', renting.length);
  renting.slice(0, 10).forEach(p => {
    console.log(p.code, '|', JSON.stringify(p.land_use), '|', p.status);
  });
}

main();
