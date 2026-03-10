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

            // Helper to clean address
            const clean = (addr) => addr.replace(/\(.*?\)/g, '').replace(/（.*?）/g, '').trim();
            const originalBase = clean(property.address);

            // Search strategy
            const searchSteps = [
                originalFull,
                originalBase,
                originalBase.replace(/^(香港|九龍|新界|元朗|屯門|粉嶺|錦田|大埔|坑口|西貢|沙田|葵涌|青衣|荃灣|東涌|愉景灣)/, '').trim(),
            ].filter(Boolean);

            const uniqueSteps = [...new Set(searchSteps)];
            let foundLocation = null;

            // TRY OGCIO ALS FIRST
            for (const query of uniqueSteps) {
                try {
                    console.log(`Searching ALS for: ${query}`);
                    const url = `https://www.als.ogcio.gov.hk/lookup?q=${encodeURIComponent(query)}&n=1`;
                    const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
                    const data = await response.json();
                    const addr = data?.SuggestedAddress?.[0]?.Address;
                    if (addr) {
                        const geo = addr.PremisesAddress?.GeospatialInformation || addr.BuildingAddress?.GeospatialInformation;
                        if (geo?.Latitude && geo?.Longitude) {
                            foundLocation = { lat: geo.Latitude, lng: geo.Longitude };
                            break;
                        }
                    }
                } catch (e) { console.error('ALS search failed', e); }
                await delay(500);
            }

            // FALLBACK TO NOMINATIM
            if (!foundLocation) {
                for (const query of uniqueSteps) {
                    console.log(`Searching Nominatim for: ${query}`);
                    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=hk&q=${encodeURIComponent(query)}`;
                    const response = await fetch(url, {
                        headers: {
                            'User-Agent': 'AntigravityPropertiesSystem/1.0 (internal script)'
                        }
                    });
                    const data = await response.json();
                    if (data && data.length > 0) {
                        foundLocation = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
                        break;
                    }
                    await delay(1000);
                }
            }

            if (foundLocation) {
                const { lat, lng } = foundLocation;

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
                console.log('No location found for exact address, trying fallback district center...');

                // Try to detect district for a better fallback
                const districts = ['錦田', '元朗', '天水圍', '屯門', '粉嶺', '上水', '大埔', '沙田', '西貢', '中心', '中環', '灣仔', '銅鑼灣', '北角', '柴灣', '尖沙咀', '旺角', '九龍城', '觀塘', '黃大仙', '將軍澳', '荃灣', '葵涌', '青衣'];
                const detectedDistrict = districts.find(d => property.address.includes(d)) || 'Hong Kong';

                await delay(1500);
                const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=hk&q=${encodeURIComponent(detectedDistrict)}`;

                const fallbackRes = await fetch(fallbackUrl, {
                    headers: { 'User-Agent': 'AntigravityPropertiesSystem/1.0 (internal script)' }
                });
                const fallbackData = await fallbackRes.json();

                if (fallbackData && fallbackData.length > 0) {
                    const lat = parseFloat(fallbackData[0].lat) + (Math.random() * 0.006 - 0.003);
                    const lng = parseFloat(fallbackData[0].lon) + (Math.random() * 0.006 - 0.003);

                    console.log(`Fallback Found (${detectedDistrict}): Lat ${lat}, Lng ${lng}`);

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

        // Respect Nominatim rate limit
        await delay(1000);
    }

    console.log(`\nGeocoding complete!`);
    console.log(`Successfully Updated: ${successCount}`);
    console.log(`Failed/Not Found: ${failCount}`);
}

geocodeProperties();
