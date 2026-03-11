'use server';

import { createClient } from '@/lib/supabase/server';

export async function searchGooglePlaces(niche: string, city: string, pageToken?: string) {
    const supabase = await createClient();

    // 1. Get Workspace ID to isolate Cache
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { error: 'Not authenticated' };

    const { data: profile } = await supabase.from('profiles').select('workspace_id').eq('id', user.id).single();
    if (!profile || !profile.workspace_id) return { error: 'No workspace found for user' };

    const queryStr = `${niche} in ${city}`.toLowerCase();

    // 2. Check Cache
    if (!pageToken) {
        const { data: existingRun } = await supabase
            .from('runs')
            .select('totals_json, id')
            .eq('workspace_id', profile.workspace_id)
            .eq('query', queryStr)
            .eq('status', 'done')
            .order('started_at', { ascending: false, nullsFirst: false })
            .limit(1)
            .single();

        // Only return cached if we're not explicitly asking for a new page, and we actually have data
        // For simplicity, we just return the full aggregated list later, but cache hit here is fine for page 1
        if (existingRun && existingRun.totals_json?.results && existingRun.totals_json?.results.length > 0) {
            // Note: returning cached first page won't return the token here, but `getAllSourcedLeads` handles tokens globally
            return { data: existingRun.totals_json.results };
        }
    }

    // 3. Google API Fetch
    let cleanData: any[] = [];
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
        console.warn("No GOOGLE_PLACES_API_KEY found. Returning mock data.");
        cleanData = [
            { id: "1", name: `Apex ${niche} Solutions`, address: "123 Main St", city: city, website: "apexsolutions.com", phone: "(206) 555-0100", niche: niche, rating: 4.8, ratingCount: 45 },
            { id: "2", name: `${city} Climate Masters`, address: "456 Oak Rd", city: city, website: "climatemasters.com", phone: "(206) 555-0101", niche: niche, rating: 3.5, ratingCount: 12 },
            { id: "3", name: "Evergreen Experts", address: "789 Pine Ln", city: city, website: "evergreenexperts.com", phone: "(206) 555-0102", niche: niche, rating: 4.9, ratingCount: 120 },
            { id: "4", name: "Pacific Northwest Pros", address: "101 Maple Dr", city: city, website: "pnwpros.com", phone: "(206) 555-0103", niche: niche, rating: 4.2, ratingCount: 8 },
        ];
    } else {
        try {
            const query = `${niche} in ${city}`;
            const requestBody: any = {
                textQuery: query,
                languageCode: 'en',
            };
            if (pageToken) {
                requestBody.pageToken = pageToken;
            }

            const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': apiKey,
                    'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,nextPageToken',
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                return { error: 'Failed to fetch places from Google.' };
            }

            const data = await response.json();

            if (!data.places || data.places.length === 0) {
                return { data: [] };
            }

            cleanData = data.places.map((place: any) => {
                return {
                    id: place.id,
                    name: place.displayName?.text || "Unknown Business",
                    address: place.formattedAddress || "No address provided",
                    city: city,
                    website: place.websiteUri || "",
                    phone: place.nationalPhoneNumber || "",
                    niche: niche,
                    rating: place.rating || 0,
                    ratingCount: place.userRatingCount || 0
                };
            });
            const fetchedNextPageToken = data.nextPageToken || null;

            // 4. Save to Cache
            await supabase.from('runs').insert([{
                workspace_id: profile.workspace_id,
                query: queryStr,
                city: city.toLowerCase(),
                status: 'done',
                started_at: new Date().toISOString(),
                totals_json: { results: cleanData, nextPageToken: fetchedNextPageToken }
            }]);

            return { data: cleanData, nextPageToken: fetchedNextPageToken };
        } catch (error: any) {
            console.error("Failed to search places:", error);
            return { error: error.message || 'An unexpected error occurred.' };
        }
    }
}

export async function getCityAutocomplete(input: string) {
    if (!input || input.length < 2) return { data: [] };

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
        // Return mock data if no key is present for testing
        return {
            data: [
                { id: "1", description: "Vancouver, BC, Canada" },
                { id: "2", description: "Vancouver, WA, USA" }
            ].filter(d => d.description.toLowerCase().includes(input.toLowerCase()))
        };
    }

    try {
        const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
            },
            body: JSON.stringify({
                input: input,
                includedPrimaryTypes: ["locality", "administrative_area_level_3"],
            })
        });

        if (!response.ok) {
            return { error: 'Failed to fetch autocomplete suggestions' };
        }

        const data = await response.json();
        const suggestions = (data.suggestions || []).map((s: any) => ({
            id: s.placePrediction.placeId,
            description: s.placePrediction.text.text,
        }));

        return { data: suggestions };
    } catch (error: any) {
        console.error("Autocomplete error:", error);
        return { error: 'Failed to fetch suggestions' };
    }
}

export async function getAllSourcedLeads() {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { error: 'Not authenticated' };

    const { data: profile } = await supabase.from('profiles').select('workspace_id').eq('id', user.id).single();
    if (!profile || !profile.workspace_id) return { error: 'No workspace found for user' };

    const { data: runs, error } = await supabase
        .from('runs')
        .select('totals_json, city, query')
        .eq('workspace_id', profile.workspace_id)
        .eq('status', 'done')
        .order('started_at', { ascending: false, nullsFirst: false });

    if (error && error.code !== 'PGRST116') {
        console.error("Error fetching all sourced leads:", error);
        return { error: 'Failed to fetch historical searches' };
    }

    if (!runs || runs.length === 0) {
        return { data: [] };
    }

    // Aggregate all historical results
    const masterList: Record<string, any>[] = [];
    const seenIds = new Set<string>();
    const activeTokens: Record<string, string | null> = {};

    // Since we ordered descending, newer runs come first.
    // If a business was updated in a newer run, we keep the newer version.
    for (const run of runs) {
        // Capture the most recent nextPageToken for a given query
        if (activeTokens[run.query] === undefined) {
            activeTokens[run.query] = run.totals_json?.nextPageToken || null;
        }

        if (run.totals_json?.results && Array.isArray(run.totals_json.results)) {
            for (const business of run.totals_json.results) {
                if (business && business.id && !seenIds.has(business.id)) {
                    seenIds.add(business.id);
                    masterList.push(business);
                }
            }
        }
    }

    return { data: masterList, activeTokens };
}
