import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function geocodeProperties() {
    console.log('Fetching properties without location...');

    // Fetch all properties
    const { data: properties, error } = await supabase
        .from('properties')
        .select('id, name, address, location');

    if (error) {
        console.error('Error fetching properties:', error);
        return;
    }

    const propertiesToUpdate = properties.filter(p => !p.location && p.address && p.address.trim() !== '');

    console.log(`Found ${propertiesToUpdate.length} properties to geocode.`);

    let successCount = 0;
    let failCount = 0;

    for (const property of propertiesToUpdate) {
        try {
            console.log(`\nGeocoding: ${property.name} (${property.address})`);

            let searchAddress = property.address;

            // Remove text in parentheses (e.g., "(租車易)")
            searchAddress = searchAddress.replace(/\(.*?\)/g, '').replace(/（.*?）/g, '').trim();

            if (!searchAddress.toLowerCase().includes('hong kong') && !searchAddress.includes('香港')) {
                searchAddress += ', Hong Kong';
            }

            console.log(`Searching for: ${searchAddress}`);

            const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(searchAddress)}`;
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'AntigravityPropertiesSystem/1.0 (internal script)'
                }
            });
            const data = await response.json();

            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lng = parseFloat(data[0].lon);

                console.log(`Found: Lat ${lat}, Lng ${lng}`);

                // Update property
                const { error: updateError } = await supabase
                    .from('properties')
                    .update({
                        location: {
                            lat,
                            lng,
                            address: property.address
                        }
                    })
                    .eq('id', property.id);

                if (updateError) {
                    console.error('Error updating property:', updateError);
                    failCount++;
                } else {
                    console.log('Successfully updated property ID:', property.id);
                    successCount++;
                }

            } else {
                console.log('No location found for exact address, trying fallback generic area (Kam Tin)...');

                await delay(1500); // respect rate limits before fallback query
                const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent('Kam Tin, Hong Kong')}`;

                const fallbackRes = await fetch(fallbackUrl, {
                    headers: { 'User-Agent': 'AntigravityPropertiesSystem/1.0 (internal script)' }
                });
                const fallbackData = await fallbackRes.json();

                if (fallbackData && fallbackData.length > 0) {
                    // Add a tiny bit of random jitter so multiple pins at Kam Tin don't perfectly overlap
                    const lat = parseFloat(fallbackData[0].lat) + (Math.random() * 0.01 - 0.005);
                    const lng = parseFloat(fallbackData[0].lon) + (Math.random() * 0.01 - 0.005);

                    console.log(`Fallback Found: Lat ${lat}, Lng ${lng}`);

                    const { error: fallbackUpdateError } = await supabase
                        .from('properties')
                        .update({
                            location: {
                                lat,
                                lng,
                                address: property.address
                            }
                        })
                        .eq('id', property.id);

                    if (fallbackUpdateError) {
                        console.error('Error updating property on fallback:', fallbackUpdateError);
                        failCount++;
                    } else {
                        console.log('Successfully updated property ID with fallback:', property.id);
                        successCount++;
                    }
                } else {
                    console.log('Even fallback failed.');
                    failCount++;
                }
            }

        } catch (err) {
            console.error('Error during geocoding:', err);
            failCount++;
        }

        // Respect Nominatim rate limit: maximum 1 request per second
        await delay(1500);
    }

    console.log(`\nGeocoding complete!`);
    console.log(`Successfully Updated: ${successCount}`);
    console.log(`Failed/Not Found: ${failCount}`);
}

geocodeProperties();
