'use server';

import { scrapeWebsite, calculateLeadScore } from "@/lib/scraper";
import { EnrichmentData } from "@/lib/scraper";
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
            *,
            scores!left(*),
            seo_audits!left(*),
            contacts!left(*),
            socials!left(*),
            outreach_messages!left(*)
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
                matchingLead.win_probability = company.win_probability;
                matchingLead.instagram_url = company.instagram_url;
                matchingLead.phone = company.phone || matchingLead.phone;
                matchingLead.companyId = company.id;
                if (company.rating_count) matchingLead.ratingCount = company.rating_count;

                // Check outreach history
                const messages = company.outreach_messages || [];
                const emailMsg = [...messages].sort((a: any, b: any) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()).find((m: any) => m.sequence_name === 'AI Manual Pitch' || (m.subject && m.subject.length > 0));
                const hasEmail = !!emailMsg;
                const emailSentAt = emailMsg?.sent_at || null;
                const hasDM = messages.some((m: any) => m.sequence_name === 'Instagram DM');
                
                if (company.scores && company.scores.length > 0) {
                    const score = company.scores[0];
                    const audit = company.seo_audits?.[0];

                    // Reconstruct a compatible ScrapeResult-like object for the frontend
                    const googleData = {
                        url: matchingLead.website || '',
                        reviewCount: matchingLead.ratingCount || 0,
                        reviewAvg: 0,
                        mobilePerformance: audit?.pagespeed_mobile,
                        desktopPerformance: audit?.pagespeed_desktop
                    };

                    const reconstructedEnrichment: any = {
                        contacts: {
                            emails: company.contacts || [],
                            hasContactForm: audit?.has_contact_form ?? false,
                            hasPhone: !!matchingLead.phone,
                        },
                        seo: {
                            titleTag: { text: '', isEmpty: !audit?.has_title },
                            h1Tags: { count: audit?.h1_count ?? (audit?.has_h1 ? 1 : 0), texts: [] },
                            metaDescription: { exists: audit?.has_meta_description ?? false, content: '' },
                            hasOgImage: audit?.has_og_image ?? false,
                            hasViewport: true,
                            hasNoIndex: false,
                            hasSchemaMarkup: (audit?.schema_org_types?.length || 0) > 0,
                            revenuePagesCount: audit?.revenue_pages_count ?? 0,
                            isSinglePage: audit?.is_single_page ?? false,
                        },
                        uxDecay: {
                            copyrightYear: null,
                            isOutdatedCopyright: false,
                            usesCheapBuilder: audit?.uses_cheap_builder ?? false,
                        },
                        pixels: {
                            hasMetaPixel: audit?.has_meta_pixel ?? false,
                            hasGoogleAds: audit?.has_google_ads_tag ?? false,
                        },
                        expansionKeywords: audit?.top_keywords_found || [],
                        ctas: {
                            hasGeneralCTA: audit?.has_cta_keywords ?? false,
                            hasReviewWidget: audit?.has_review_widget ?? false,
                            bookingUrls: audit?.has_booking_link ? [{ platform: 'detected', url: '#' }] : []
                        },
                        socials: {
                            facebook: company.socials?.find((s: any) => s.platform === 'facebook'),
                            instagram: company.socials?.find((s: any) => s.platform === 'instagram'),
                            tiktok: company.socials?.find((s: any) => s.platform === 'tiktok'),
                        }
                    };

                    const scoreBreakdown = calculateLeadScore(reconstructedEnrichment as EnrichmentData, googleData);

                    // Derive biggest weakness from the live scoring engine (same as fresh audit)
                    const reconstructedWeakness = scoreBreakdown.rulesTriggered.length > 0
                        ? `🔴 ${scoreBreakdown.rulesTriggered[0]}`
                        : 'Solid Digital Presence';

                    matchingLead.score = scoreBreakdown.total; // Sync Card with Modal
                    auditedLeadsMap[matchingLead.id] = {
                        companyId: company.id,
                        score: scoreBreakdown.total,
                        max_score: scoreBreakdown.maxTotal,
                        email: company.contacts?.[0]?.email || '',
                        biggestWeakness: reconstructedWeakness,
                        bookingDetected: audit?.has_booking_link || false,
                        hasEmail,
                        hasDM,
                        emailSentAt,
                        rawScrape: {
                            totalScore: scoreBreakdown.total,
                            contactabilityScore: scoreBreakdown.contactability,
                            seoScore: scoreBreakdown.uxDecayTechnical,
                            localIntentScore: scoreBreakdown.cashFlowMaturity,
                            fitScore: 0,
                            emails: company.contacts || [],
                            socials: company.socials || [],
                            scoreBreakdown: scoreBreakdown,
                            seoAudit: {
                                has_title: audit?.has_title || false,
                                title_len: audit?.title_len || 0,
                                has_h1: audit?.has_h1 || false,
                                has_booking_link: audit?.has_booking_link || false,
                                has_schema: (audit?.schema_org_types?.length || 0) > 0,
                                pagespeed_mobile: audit?.pagespeed_mobile ?? null,
                                pagespeed_desktop: audit?.pagespeed_desktop ?? null,
                                mobile_load_time: audit?.mobile_load_time ?? null,
                                h1_count: audit?.h1_count ?? (audit?.has_h1 ? 1 : 0),
                                has_meta_description: audit?.has_meta_description ?? false,
                                has_og_image: audit?.has_og_image ?? false,
                                uses_cheap_builder: audit?.uses_cheap_builder ?? false,
                                revenue_pages_count: audit?.revenue_pages_count ?? 0,
                                is_single_page: audit?.is_single_page ?? false,
                                has_cta_keywords: audit?.has_cta_keywords ?? false,
                                has_review_widget: audit?.has_review_widget ?? false,
                                has_meta_pixel: audit?.has_meta_pixel ?? false,
                                has_google_ads_tag: audit?.has_google_ads_tag ?? false,
                                has_expansion_keywords: audit?.has_expansion_keywords ?? false,
                                has_contact_form: audit?.has_contact_form ?? false,
                            },
                            enrichment: reconstructedEnrichment
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
            const isManualLoadMore = !!pageToken;
            const MAX_AUTO_PAGES = isManualLoadMore ? 1 : 3; // Auto-paginate up to 3 pages (~60 results) on initial search

            let allPlaces: any[] = [];
            let currentPageToken: string | undefined = pageToken;
            let finalNextPageToken: string | null = null;
            let pageCount = 0;

            do {
                const requestBody: any = {
                    textQuery: query,
                    languageCode: 'en',
                    pageSize: 20,
                };
                if (currentPageToken) {
                    requestBody.pageToken = currentPageToken;
                }

                const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Goog-Api-Key': apiKey,
                        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.primaryType,nextPageToken',
                    },
                    body: JSON.stringify(requestBody)
                });

                if (!response.ok) {
                    if (allPlaces.length === 0) {
                        return { error: 'Failed to fetch places from Google.' };
                    }
                    break; // If we already have some results, return what we have
                }

                const data = await response.json();

                if (data.places && data.places.length > 0) {
                    allPlaces = allPlaces.concat(data.places);
                }

                currentPageToken = data.nextPageToken || undefined;
                pageCount++;

                // Store the last token for "Load More" UI fallback
                finalNextPageToken = currentPageToken || null;

            } while (currentPageToken && pageCount < MAX_AUTO_PAGES);

            if (allPlaces.length === 0) {
                return { data: [] };
            }

            cleanData = allPlaces.map((place: any) => {
                return {
                    id: place.id,
                    name: place.displayName?.text || "Unknown Business",
                    address: place.formattedAddress || "No address provided",
                    city: city,
                    website: place.websiteUri || "",
                    phone: place.nationalPhoneNumber || "",
                    niche: niche,
                    primary_category: place.primaryType || "",
                    rating: place.rating || 0,
                    ratingCount: place.userRatingCount || 0
                };
            });

            // 4. Save to Cache (consolidated — all auto-fetched pages in one run)
            await supabase.from('runs').insert([{
                workspace_id: profile.workspace_id,
                query: queryStr,
                city: city.toLowerCase(),
                status: 'done',
                started_at: new Date().toISOString(),
                totals_json: { results: cleanData, nextPageToken: finalNextPageToken }
            }]);

            const { leads, auditedLeads } = await getHydratedLeads(profile.workspace_id, cleanData);

            return { data: leads, nextPageToken: finalNextPageToken, auditedLeads };
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



