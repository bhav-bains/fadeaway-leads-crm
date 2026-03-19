'use server';

import { createClient } from '@/lib/supabase/server';
import { normalizeQueryKey } from '@/lib/utils';

async function getHydratedLeads(workspaceId: string, leads: any[]) {
    const supabase = await createClient();
    if (!leads || leads.length === 0) return { leads: [], auditedLeads: {} };

    const sourceIds = leads.map(l => l.id).filter(Boolean);
    if (sourceIds.length === 0) return { leads, auditedLeads: {} };

    // 4. Hydrate Audited Leads from DB
    // We fetch all companies that have been audited in this workspace
    const { data: auditedCompanies } = await supabase
        .from('companies')
        .select(`
            id,
            source_id,
            website,
            city,
            status,
            manual_notes,
            ig_followers,
            ig_activity,
            rating_count,
            scores!left (score_overall, score_contactability, score_seo, score_local_intent, score_fit),
            seo_audits!left (has_title, title_len, has_h1, has_booking_link, schema_org_types, top_keywords_found),
            contacts!left (email, type),
            socials!left (platform, url)
        `)
        .eq('workspace_id', workspaceId)
        .in('source_id', sourceIds);

    const auditedLeadsMap: Record<string, any> = {};
    
    if (auditedCompanies) {
        for (const company of auditedCompanies) {
            // Find the matching lead in our masterList by Google Place ID (source_id)
            const matchingLead = leads.find(l => l.id === company.source_id);
            
            if (matchingLead) {
                // Merge status and manual data into the search result lead object
                matchingLead.status = company.status;
                matchingLead.manual_notes = company.manual_notes;
                matchingLead.ig_followers = company.ig_followers;
                matchingLead.ig_activity = company.ig_activity;
                matchingLead.companyId = company.id;

                if (company.scores && company.scores.length > 0) {
                    const score = company.scores[0];
                    const audit = company.seo_audits?.[0];
                    
                    let reconstructedWeakness = 'Solid Digital Presence';
                    if (audit) {
                        if (!audit.has_title) reconstructedWeakness = '🔴 Empty Title Tag';
                        else if (!audit.has_h1) reconstructedWeakness = '🔴 Missing H1 Tag';
                        else if (!audit.has_booking_link) reconstructedWeakness = '🔴 No Booking Link';
                    } else if (score.score_overall > 0) {
                        reconstructedWeakness = 'Audit Complete';
                    }

                    // Reconstruct a compatible ScrapeResult-like object for the frontend
                    auditedLeadsMap[matchingLead.id] = {
                        companyId: company.id,
                        score: score.score_overall,
                        email: company.contacts?.[0]?.email || '',
                        biggestWeakness: reconstructedWeakness, 
                        bookingDetected: audit?.has_booking_link || false,
                        rawScrape: {
                            totalScore: score.score_overall,
                            contactabilityScore: score.score_contactability,
                            seoScore: score.score_seo,
                            localIntentScore: score.score_local_intent,
                            fitScore: score.score_fit,
                            emails: company.contacts || [],
                            socials: company.socials || [],
                            scoreBreakdown: {
                                total: score.score_overall,
                                uxDecayTechnical: score.score_seo || 0,
                                cashFlowMaturity: score.score_local_intent || 0,
                                contactability: score.score_contactability || 0,
                                rulesTriggered: []
                            },
                            seoAudit: {
                                has_title: audit?.has_title || false,
                                title_len: audit?.title_len || 0,
                                has_h1: audit?.has_h1 || false,
                                has_booking_link: audit?.has_booking_link || false,
                                has_schema: (audit?.schema_org_types?.length || 0) > 0,
                            },
                            enrichment: {
                                contacts: {
                                    emails: company.contacts || [],
                                    hasContactForm: company.contacts?.some((c: any) => c.type === 'form_only') || false,
                                    hasPhone: !!matchingLead.phone,
                                },
                                seo: {
                                    titleTag: { text: '', isEmpty: !audit?.has_title },
                                    h1Tags: { count: audit?.has_h1 ? 1 : 0, texts: [] },
                                    metaDescription: { exists: false, content: '' },
                                    hasViewport: true,
                                    hasNoIndex: false,
                                    hasSchemaMarkup: (audit?.schema_org_types?.length || 0) > 0,
                                },
                                socials: {
                                    facebook: company.socials?.find((s: any) => s.platform === 'facebook'),
                                    instagram: company.socials?.find((s: any) => s.platform === 'instagram'),
                                    tiktok: company.socials?.find((s: any) => s.platform === 'tiktok'),
                                }
                            }
                        }
                    };
                }
            }
        }
    }
    return { leads, auditedLeads: auditedLeadsMap };
}

export async function searchGooglePlaces(niche: string, city: string, pageToken?: string) {
    const supabase = await createClient();

    // 1. Get Workspace ID to isolate Cache
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { error: 'Not authenticated' };

    const { data: profile } = await supabase.from('profiles').select('workspace_id').eq('id', user.id).single();
    if (!profile || !profile.workspace_id) return { error: 'No workspace found for user' };

    const queryStr = normalizeQueryKey(niche, city);

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

        if (existingRun && existingRun.totals_json?.results && existingRun.totals_json?.results.length > 0) {
            const { leads, auditedLeads } = await getHydratedLeads(profile.workspace_id, existingRun.totals_json.results);
            return { data: leads, auditedLeads };
        }
    }

    // 3. Google API Fetch
    let cleanData: any[] = [];
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
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

            const { leads, auditedLeads } = await getHydratedLeads(profile.workspace_id, cleanData);

            return { data: leads, nextPageToken: fetchedNextPageToken, auditedLeads };
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

    for (const run of runs) {
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

    const { leads, auditedLeads } = await getHydratedLeads(profile.workspace_id, masterList);

    return { data: leads, activeTokens, auditedLeads };
}



