import geohash from 'ngeohash';
import { createClient } from '@supabase/supabase-js';
import { startEnrichmentWorker } from '@/lib/enrichment-worker';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export function normalizeName(name: string): string {
    if (!name) return "";
    let clean = name.toLowerCase();
    // Strip accents
    clean = clean.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    // Remove common suffixes using regex boundary \b
    clean = clean.replace(/\b(inc|ltd|llc|academy|club|co|corp|company)\b/g, "");
    // Remove non-alphanumeric except spaces
    clean = clean.replace(/[^a-z0-9 ]/g, " ");
    // Remove extra spaces
    clean = clean.replace(/\s+/g, " ").trim();
    return clean;
}

export function extractDomain(url: string | null | undefined): string | null {
    if (!url) return null;
    let cleanUrl = url.toLowerCase().trim();

    // Remove protocol
    if (cleanUrl.startsWith('http://')) cleanUrl = cleanUrl.substring(7);
    if (cleanUrl.startsWith('https://')) cleanUrl = cleanUrl.substring(8);

    // Remove www.
    if (cleanUrl.startsWith('www.')) cleanUrl = cleanUrl.substring(4);

    // Remove path and query and fragment
    cleanUrl = cleanUrl.split('/')[0];
    cleanUrl = cleanUrl.split('?')[0];
    cleanUrl = cleanUrl.split('#')[0];

    return cleanUrl || null;
}

export function computeGeohash(lat: number, lng: number): string {
    return geohash.encode(lat, lng, 5); // precision 5 string
}

export async function startCaptureRun(
    runId: string,
    workspaceId: string,
    query: string,
    city: string,
    lat: number,
    lng: number,
    radiusMs: number,
    limit: number,
    userToken: string
) {
    let totals = { found: 0, enriched: 0, scored: 0, saved: 0, skipped: 0 };

    // Create an authenticated client acting on behalf of the user to pass RLS
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
            headers: {
                Authorization: `Bearer ${userToken}`
            }
        }
    });

    try {
        // Step A: Fetch from Google Places API
        const apiKey = process.env.GOOGLE_PLACES_API_KEY;
        if (!apiKey) throw new Error("Missing GOOGLE_PLACES_API_KEY");

        let places: any[] = [];
        let nextPageToken: string | undefined = undefined;

        // Note: Google Places API v1 text search currently has varying support for LocationBias circle.
        // We'll use textQuery combined with locationBias.
        let pageCount = 0;
        do {
            const body: any = {
                textQuery: query,
                languageCode: 'en',
                locationBias: {
                    circle: {
                        center: { latitude: lat, longitude: lng },
                        radius: radiusMs
                    }
                }
            };
            if (nextPageToken) body.pageToken = nextPageToken;

            const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': apiKey,
                    'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.location,nextPageToken',
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Google API Error: ${errText}`);
            }

            const data = await response.json();
            if (data.places) {
                places = places.concat(data.places);
            }
            nextPageToken = data.nextPageToken;
            pageCount++;

            // Stop if we hit user limit or no more pages.
            // Safety: max 5 pages to prevent infinite loops in runaway logic
            if (places.length >= limit || pageCount >= 5) {
                places = places.slice(0, limit);
                break;
            }

        } while (nextPageToken);

        totals.found = places.length;

        // Update runs to show progress (totals.found)
        await supabaseClient.from('runs').update({ totals_json: totals }).eq('id', runId);

        for (const place of places) {
            // Step B: Normalize
            const rawName = place.displayName?.text || "Unknown Business";
            const normName = normalizeName(rawName);
            const domain = extractDomain(place.websiteUri);
            const pLat = place.location?.latitude || 0;
            const pLng = place.location?.longitude || 0;
            const geo5 = computeGeohash(pLat, pLng);
            const phone = place.nationalPhoneNumber?.replace(/\D/g, "") || "";

            // Step C: Deduplication Check
            // A lead is a duplicate IF the domain matches within the same geohash5 area OR the phone matches within the same geohash5 area.
            let isDuplicate = false;

            if (domain || phone) {
                let dupQuery = supabaseClient
                    .from('companies')
                    .select('id, rating_avg, rating_count')
                    .eq('workspace_id', workspaceId)
                    .eq('geohash5', geo5);

                let orConditions = [];
                if (domain) orConditions.push(`domain.eq."${domain}"`);
                if (phone) orConditions.push(`phone.eq."${phone}"`);

                if (orConditions.length > 0) {
                    dupQuery = dupQuery.or(orConditions.join(','));
                }

                const { data: existing, error: dupError } = await dupQuery.limit(1);

                if (existing && existing.length > 0) {
                    isDuplicate = true;
                    // Merge logic (update rating if changed)
                    const ex = existing[0];
                    if (place.rating && place.rating !== ex.rating_avg) {
                        await supabaseClient.from('companies').update({
                            rating_avg: place.rating,
                            rating_count: place.userRatingCount
                        }).eq('id', ex.id);
                    }
                }
            }

            if (isDuplicate) {
                totals.skipped++;
            } else {
                // INSERT
                const { data: company, error: insErr } = await supabaseClient.from('companies').insert({
                    workspace_id: workspaceId,
                    name: rawName,
                    normalized_name: normName,
                    domain: domain,
                    website: place.websiteUri,
                    phone: place.nationalPhoneNumber, // Keep formatted in DB, though we deduped with raw
                    street: place.formattedAddress,
                    city: city, // From the payload
                    lat: pLat,
                    lng: pLng,
                    geohash5: geo5,
                    rating_avg: place.rating || 0,
                    rating_count: place.userRatingCount || 0,
                    source: 'Google Places',
                    source_id: place.id,
                    status: 'New'
                }).select('id').single();

                if (insErr || !company) {
                    console.error("Insert error:", insErr);
                    totals.skipped++; // Count as skipped if failed
                } else {
                    totals.saved++;

                    // Trigger the enrichment worker to scrape the website payload in the background
                    // Fire-and-forget, passing the same user context
                    if (place.websiteUri) {
                        try {
                            // Don't await this so capture can proceed quickly
                            startEnrichmentWorker(company.id, place.websiteUri, city, runId, userToken).catch(e => {
                                console.error(`Async Enrichement Failed for ${company.id}`, e);
                            });
                        } catch (e) {
                            console.error(`Error triggering enrichment for ${company.id}`, e);
                        }
                    }
                }
            }

            // Periodically update runs table to show live progress
            if ((totals.saved + totals.skipped) % 10 === 0) {
                await supabaseClient.from('runs').update({ totals_json: totals }).eq('id', runId);
            }
        }

        // Step D: Finalize Run
        await supabaseClient.from('runs').update({
            status: 'done',
            finished_at: new Date().toISOString(),
            totals_json: totals
        }).eq('id', runId);

    } catch (e: any) {
        console.error("Worker error:", e);
        await supabaseClient.from('runs').update({
            status: 'error',
            finished_at: new Date().toISOString(),
            totals_json: { ...totals, error: e.message }
        }).eq('id', runId);
    }
}
