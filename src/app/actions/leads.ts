'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { scrapeWebsite, calculateLeadScore } from '@/lib/scraper'

export async function insertLead(
    leadData: { 
        name: string; 
        address: string; 
        city: string; 
        phone?: string; 
        website?: string; 
        niche?: string; 
        reviewCount?: number; 
        googlePlaceId?: string;
        primary_category?: string;
        win_probability?: number;
    }, 
    scrapeResult?: Record<string, any>
) {
    const supabase = await createClient()

    // 1. Get current authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { error: 'Not authenticated' }
    }

    // 2. Get user's profile to find their workspace_id
    const { data: profile } = await supabase
        .from('profiles')
        .select('workspace_id')
        .eq('id', user.id)
        .single()

    if (!profile) {
        return { error: 'Profile not found' }
    }
    if (!profile.workspace_id) {
        return { error: 'No workspace found for user' }
    }

    // --- NORMALIZATION (THE BOUNCER) --- //

    // 1. Normalize Domain (strip protocols, www, and trailing slashes)
    let normalizedWebsite = leadData.website?.toLowerCase().trim();
    if (normalizedWebsite) {
        normalizedWebsite = normalizedWebsite.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    }

    // 2. Normalize Phone (strip to just digits and plus signs for E.164-lite matching)
    let normalizedPhone = leadData.phone?.trim();
    if (normalizedPhone) {
        normalizedPhone = normalizedPhone.replace(/[^\d+]/g, '');
    }

    // 3. Search for Existing Match (Deduplication)
    let existingCompany = null;

    // A. Try matching by Google Place ID first (Source ID)
    if (leadData.googlePlaceId) {
        const { data: idMatch } = await supabase
            .from('companies')
            .select('*')
            .eq('workspace_id', profile.workspace_id)
            .eq('source_id', leadData.googlePlaceId)
            .limit(1)
            .single();
        
        if (idMatch) existingCompany = idMatch;
    }

    // B. Fallback to Website/Phone match if no ID match found
    if (!existingCompany && (normalizedWebsite || normalizedPhone)) {
        // Build OR query dynamically
        let matchQuery = '';
        if (normalizedWebsite && normalizedPhone) {
            matchQuery = `website.ilike.%${normalizedWebsite}%,phone.ilike.%${normalizedPhone}%`;
        } else if (normalizedWebsite) {
            matchQuery = `website.ilike.%${normalizedWebsite}%`;
        } else if (normalizedPhone) {
            matchQuery = `phone.ilike.%${normalizedPhone}%`;
        }

        const { data: matches } = await supabase
            .from('companies')
            .select('*')
            .eq('workspace_id', profile.workspace_id)
            .or(matchQuery)
            .limit(1);

        if (matches && matches.length > 0) {
            existingCompany = matches[0];
        }
    }

    // 4. Insert or Upsert into companies
    let company;
    let companyError;

    if (existingCompany) {
        // Upsert Scenario
        const { data: updatedCompany, error: upError } = await supabase
            .from('companies')
            .update({
                name: leadData.name,
                street: leadData.address,
                city: leadData.city,
                phone: leadData.phone || existingCompany.phone,
                website: leadData.website || existingCompany.website,
                source_id: leadData.googlePlaceId || existingCompany.source_id,
                niche: leadData.niche || existingCompany.niche,
                primary_category: leadData.primary_category || existingCompany.primary_category,
                rating_count: leadData.reviewCount || existingCompany.rating_count,
                rating_avg: leadData.reviewCount ? existingCompany.rating_avg : existingCompany.rating_avg, // ratingAvg not passed yet but keeping place
                status: (existingCompany.status === 'New' && scrapeResult) ? 'Audited' : existingCompany.status,
            })
            .eq('id', existingCompany.id)
            .select()
            .single();

        company = updatedCompany;
        companyError = upError;
    } else {
        // Clean Insert Scenario
        const { data: newCompany, error: inError } = await supabase
            .from('companies')
            .insert([{
                workspace_id: profile.workspace_id,
                name: leadData.name,
                street: leadData.address,
                city: leadData.city,
                phone: leadData.phone,
                website: leadData.website,
                source_id: leadData.googlePlaceId,
                niche: leadData.niche,
                primary_category: leadData.primary_category,
                rating_count: leadData.reviewCount,
                status: scrapeResult ? 'Audited' : 'New'
            }])
            .select()
            .single();

        company = newCompany;
        companyError = inError;
    }

    if (companyError || !company) {
        return { error: companyError?.message || "Failed to save company" }
    }

    const companyId = company.id;

    // 5. Save or Update SEO Audit Results
    if (scrapeResult) {

        // 5a. Technical & Performance Refresh (Technical data overrides)
        const seoData = {
            company_id: companyId,
            has_title: scrapeResult.seoAudit?.has_title || false,
            title_len: scrapeResult.seoAudit?.title_len || 0,
            has_h1: scrapeResult.seoAudit?.has_h1 || false,
            has_booking_link: scrapeResult.seoAudit?.has_booking_link || false,
            schema_org_types: scrapeResult.seoAudit?.has_schema ? ['Found'] : [],
            top_keywords_found: scrapeResult.enrichment?.expansionKeywords || [],
            h1_count: scrapeResult.seoAudit?.h1_count || 0,
            has_meta_description: scrapeResult.seoAudit?.has_meta_description || false,
            has_og_image: scrapeResult.seoAudit?.has_og_image || false,
            uses_cheap_builder: scrapeResult.seoAudit?.uses_cheap_builder || false,
            revenue_pages_count: scrapeResult.seoAudit?.revenue_pages_count || 0,
            is_single_page: scrapeResult.seoAudit?.is_single_page || false,
            has_cta_keywords: scrapeResult.seoAudit?.has_cta_keywords || false,
            has_review_widget: scrapeResult.seoAudit?.has_review_widget || false,
            has_meta_pixel: scrapeResult.seoAudit?.has_meta_pixel || false,
            has_google_ads_tag: scrapeResult.seoAudit?.has_google_ads_tag || false,
            has_expansion_keywords: scrapeResult.seoAudit?.has_expansion_keywords || false,
            has_contact_form: scrapeResult.seoAudit?.has_contact_form || false,
            pagespeed_mobile: scrapeResult.seoAudit?.pagespeed_mobile || null,
            pagespeed_desktop: scrapeResult.seoAudit?.pagespeed_desktop || null
        };

        const scoreData = {
            company_id: companyId,
            score_overall: (scrapeResult as any).scoreBreakdown?.total || 0,
            score_max: (scrapeResult as any).scoreBreakdown?.maxTotal || 85,
            score_contactability: (scrapeResult as any).contactabilityScore || 0,
            score_seo: (scrapeResult as any).seoScore || 0,
            score_local_intent: (scrapeResult as any).localIntentScore || 0,
            score_fit: (scrapeResult as any).fitScore || 0
        };

        // Write fresh SEO Audits & Scores using check-then-act logic to be absolutely bulletproof
        const { data: existingSeoAudit } = await supabase.from('seo_audits').select('id').eq('company_id', companyId).maybeSingle();
        if (existingSeoAudit) {
            const { error } = await supabase.from('seo_audits').update(seoData).eq('company_id', companyId);
            if (error) console.error("SEO Audit Update Error:", error);
        } else {
            const { error } = await supabase.from('seo_audits').insert([seoData]);
            if (error) console.error("SEO Audit Insert Error:", error);
        }

        const { data: existingScore } = await supabase.from('scores').select('id').eq('company_id', companyId).maybeSingle();
        if (existingScore) {
            const { error } = await supabase.from('scores').update(scoreData).eq('company_id', companyId);
            if (error) console.error("Score Update Error:", error);
        } else {
            const { error } = await supabase.from('scores').insert([scoreData]);
            if (error) console.error("Score Insert Error:", error);
        }

        // 5d. "Sticky" Contacts & Socials (Additive logic)
        // We only insert ones that don't already exist for this company
        if (scrapeResult.emails && scrapeResult.emails.length > 0) {
            const { data: existingEmails } = await supabase.from('contacts').select('email').eq('company_id', companyId);
            const seenEmails = new Set(existingEmails?.map((e: any) => e.email.toLowerCase()) || []);
            
            const newEmails = scrapeResult.emails.filter((e: any) => !seenEmails.has(e.email.toLowerCase()));
            if (newEmails.length > 0) {
                const contactInserts = newEmails.map((e: Record<string, any>) => ({
                    company_id: companyId,
                    email: e.email,
                    type: e.type,
                    confidence: 90
                }));
                await supabase.from('contacts').insert(contactInserts);
            }
        }

        if (scrapeResult.socials && scrapeResult.socials.length > 0) {
            const { data: existingSocials } = await supabase.from('socials').select('url').eq('company_id', companyId);
            const seenUrls = new Set(existingSocials?.map((s: any) => s.url.toLowerCase()) || []);

            const newSocials = scrapeResult.socials.filter((s: any) => !seenUrls.has(s.url.toLowerCase()));
            if (newSocials.length > 0) {
                const socialInserts = newSocials.map((s: Record<string, any>) => ({
                    company_id: companyId,
                    platform: s.platform,
                    url: s.url
                }));
                await supabase.from('socials').insert(socialInserts);
            }
        }
    } else if (!existingCompany) {
        // Fallback empty scores only if this is a brand new company with no website
        await supabase.from('scores').insert([{
            company_id: companyId,
            score_overall: 0,
            score_contactability: 0,
            score_seo: 0,
            score_local_intent: 0,
            score_fit: 0
        }]);
    }

    revalidatePath('/pipeline')
    revalidatePath('/lead-finder')
    return { data: { company, scrapeResult } }
}

export async function runLocalSeoAudit(
    website: string,
    city: string,
    niche: string,
    leadMeta?: { 
        name: string; 
        address: string; 
        phone?: string; 
        reviewCount?: number; 
        googlePlaceId?: string;
        primary_category?: string;
    }
) {
    let urlToScrape = website;
    if (urlToScrape && !urlToScrape.startsWith('http')) {
        urlToScrape = `https://${urlToScrape}`;
    }

    if (!urlToScrape) {
        return { error: "No Website Found", score: 0, email: '', biggestWeakness: '🔴 No Website Found', bookingDetected: false };
    }

    try {
        const supabase = await createClient();
        
        // Try to find existing performance scores if this is a re-audit
        let existingAudit = null;
        if (leadMeta?.googlePlaceId) {
            const { data: comp } = await supabase
                .from('companies')
                .select('id, seo_audits(pagespeed_mobile, pagespeed_desktop)')
                .eq('source_id', leadMeta.googlePlaceId)
                .single();
            if (comp?.seo_audits?.[0]) {
                existingAudit = comp.seo_audits[0];
            }
        }

        // Instant Audit: Scrape Website only (Cheerio)
        const scrape = await scrapeWebsite(
            urlToScrape, 
            city, 
            niche, 
            leadMeta?.reviewCount || 0, 
            0, // reviewAvg fallback
            existingAudit?.pagespeed_mobile,
            existingAudit?.pagespeed_desktop
        );

        let finalCompanyId: string | undefined;

        // Auto-save audit to Supabase if we have lead metadata
        if (leadMeta) {
            const result = await insertLead(
                {
                    name: leadMeta.name,
                    address: leadMeta.address,
                    city,
                    phone: leadMeta.phone,
                    website,
                    niche,
                    reviewCount: leadMeta.reviewCount,
                    googlePlaceId: leadMeta.googlePlaceId,
                    primary_category: leadMeta.primary_category
                },
                scrape as unknown as Record<string, any>
            );

            if (result.error) {
            } else {
                if (result.data?.company) {
                    finalCompanyId = result.data.company.id;
                }
            }
        }

        return {
            data: {
                companyId: finalCompanyId,
                score: scrape.scoreBreakdown.total,
                max_score: scrape.scoreBreakdown.maxTotal,
                email: scrape.emails[0]?.email || '',
                biggestWeakness: scrape.biggestWeakness,
                bookingDetected: scrape.seoAudit.has_booking_link,
                rawScrape: scrape
            }
        };
    } catch (e: unknown) {
        const error = e as Error;
        return { error: error.message || 'Failed to scrape website', score: 0, email: '', biggestWeakness: '🔴 Audit Failed', bookingDetected: false };
    }
}


export async function fetchLeads() {
    const supabase = await createClient()

    // Fetch companies alongside their scores, audits, and contacts
    const { data, error } = await supabase
        .from('companies')
        .select(`
            *,
            scores (*),
            seo_audits (*),
            contacts (*)
        `)
        .order('created_at', { ascending: false })

    if (error) {
        return { error: error.message, data: [] }
    }

    return { data: data || [] }
}

export async function updateLeadStatusAction(companyId: string, newStatus: string) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('companies')
        .update({ status: newStatus })
        .eq('id', companyId)
        .select()
        .single()

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/pipeline')
    return { data }
}

export async function updateLeadManualData(
    companyId: string,
    updates: {
        manual_notes?: string;
        ig_followers?: number | null;
        ig_activity?: string | null;
        manual_email?: string;
        manual_phone?: string;
        instagram_url?: string;
        win_probability?: string | null;
    }
) {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { error: 'Not authenticated' }

    // 1. Update company-level fields
    const companyUpdate: Record<string, any> = {}
    if (updates.manual_notes !== undefined) companyUpdate.manual_notes = updates.manual_notes
    if (updates.ig_followers !== undefined) companyUpdate.ig_followers = updates.ig_followers
    if (updates.ig_activity !== undefined) companyUpdate.ig_activity = updates.ig_activity
    if (updates.manual_phone) companyUpdate.phone = updates.manual_phone
    if (updates.instagram_url !== undefined) companyUpdate.instagram_url = updates.instagram_url
    if (updates.win_probability !== undefined) companyUpdate.win_probability = updates.win_probability

    if (Object.keys(companyUpdate).length > 0) {
        const { error } = await supabase
            .from('companies')
            .update(companyUpdate)
            .eq('id', companyId)
        if (error) {
            return { error: error.message }
        }
    }

    // 2. Add manual email to contacts table if provided
    if (updates.manual_email) {
        // Check if this email already exists for this company
        const { data: existing } = await supabase
            .from('contacts')
            .select('id')
            .eq('company_id', companyId)
            .eq('email', updates.manual_email)
            .limit(1)

        if (!existing || existing.length === 0) {
            await supabase.from('contacts').insert([{
                company_id: companyId,
                email: updates.manual_email,
                type: 'personal',
                confidence: 100
            }])
        }
    }
    
    revalidatePath('/pipeline')
    // 3. Recalculate Score
    await recalculateAndSaveScore(companyId, supabase);

    revalidatePath('/lead-finder')
    return { success: true }
}

export async function fetchLeadsPaginated(opts: {
    page: number;
    pageSize: number;
    search?: string;
    city?: string;
    minScore?: number;
    hasEmail?: boolean;
    ratingRange?: string; // 'all' | 'high' | 'low'
}) {
    const supabase = await createClient();

    // Start base query
    let query = supabase
        .from('companies')
        .select(`
            *,
            scores!inner (*),
            seo_audits!left (*),
            contacts!left (*)
        `, { count: 'exact' });

    // Text Search
    if (opts.search) {
        query = query.ilike('name', `%${opts.search}%`);
    }

    // City Dropdown
    if (opts.city && opts.city !== 'all') {
        query = query.ilike('city', `%${opts.city}%`);
    }

    // Min Score
    if (opts.minScore !== undefined && opts.minScore > 0) {
        query = query.gte('scores.score_overall', opts.minScore);
    }

    // Rating Filter
    if (opts.ratingRange === 'high') {
        query = query.gte('rating_avg', 4.0);
    } else if (opts.ratingRange === 'low') {
        query = query.lt('rating_avg', 4.0);
    }

    // Calculate ranges for pagination
    const from = (opts.page - 1) * opts.pageSize;
    const to = from + opts.pageSize - 1;

    query = query
        .order('created_at', { ascending: false })
        .range(from, to);

    const { data: rawData, error, count } = await query;

    if (error) {
        return { error: error.message, data: [], count: 0 };
    }

    // JavaScript post-filter for "hasEmail" since it's hard to filter on a 1-to-many join purely in Supabase Postgrest without custom RPC
    let filteredData = rawData || [];
    if (opts.hasEmail) {
        filteredData = filteredData.filter(d => d.contacts && d.contacts.length > 0);
    }

    return { data: filteredData, count: count || 0 };
}

export async function fetchPipelineLeads() {
    const supabase = await createClient();

    // Fetch all leads for the board, focusing on outreach history and scores
    const { data, error } = await supabase
        .from('companies')
        .select(`
            *,
            scores!left (*),
            outreach_messages!left (*)
        `)
        .order('updated_at', { ascending: false })
        .limit(200);

    if (error) {
        return { error: error.message, data: [] };
    }

    return { data: data || [] };
}
export async function updateLeadStatus(companyId: string, status: string) {
    const supabase = await createClient()
    const { error } = await supabase
        .from('companies')
        .update({ status })
        .eq('id', companyId)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/lead-finder')
    // 3. Recalculate Score
    await recalculateAndSaveScore(companyId, supabase);

    revalidatePath('/pipeline')
    revalidatePath('/lead-finder')
    return { success: true }
}

export async function fetchPageSpeedMetrics(website: string) {
    if (!website) return { error: "No website provided" };
    let urlToScrape = website;
    if (!urlToScrape.startsWith('http')) {
        urlToScrape = `https://${urlToScrape}`;
    }

    try {
        const apiKey = process.env.GOOGLE_PLACES_API_KEY || '';
        const keyParam = apiKey ? `&key=${apiKey}` : '';
        const [mobileRes, desktopRes] = await Promise.all([
            fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(urlToScrape)}&strategy=mobile${keyParam}`),
            fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(urlToScrape)}&strategy=desktop${keyParam}`)
        ]);

        const mobileData = await mobileRes.json();
        const desktopData = await desktopRes.json();

        const mobileScoreRaw = mobileData?.lighthouseResult?.categories?.performance?.score;
        const desktopScoreRaw = desktopData?.lighthouseResult?.categories?.performance?.score;

        const pagespeed_mobile = mobileScoreRaw !== undefined ? Math.round(mobileScoreRaw * 100) : null;
        const pagespeed_desktop = desktopScoreRaw !== undefined ? Math.round(desktopScoreRaw * 100) : null;
        const mobile_load_time = mobileData?.lighthouseResult?.audits?.['speed-index']?.displayValue || null;

        return { pagespeed_mobile, pagespeed_desktop, mobile_load_time };
    } catch (error) {
        console.error("PageSpeed Fetch Error:", error);
        return { error: "Failed to fetch PageSpeed" };
    }
}

async function recalculateAndSaveScore(companyId: string, supabase: any) {
    // 1. Get current data to reconstruct EnrichmentData
    const { data: companyDetails } = await supabase
        .from('companies')
        .select(`
            *,
            seo_audits(*),
            contacts(*),
            socials(*),
            scores(*)
        `)
        .eq('id', companyId)
        .single();

    if (!companyDetails) return null;

    const audit = companyDetails.seo_audits?.[0];
    if (!audit) return null;

    // 2. Map to EnrichmentData
    const mockEnrichment: any = {
        contacts: {
            emails: companyDetails.contacts?.map((c: any) => ({ email: c.email, type: c.type || 'generic' })) || [],
            hasContactForm: audit.has_contact_form || false,
            hasPhone: !!companyDetails.phone || !!audit.has_phone,
        },
        seo: {
            h1Tags: { count: audit.h1_count || 0, texts: [] },
            titleTag: { text: '', isEmpty: !audit.has_title },
            metaDescription: { exists: !!audit.has_meta_description, content: '' },
            hasOgImage: !!audit.has_og_image,
            hasViewport: true,
            hasNoIndex: false,
            hasSchemaMarkup: (audit.schema_org_types && audit.schema_org_types.length > 0) || !!audit.has_schema,
            revenuePagesCount: audit.revenue_pages_count || 0,
            isSinglePage: audit.is_single_page || false,
        },
        pixels: {
            hasMetaPixel: !!audit.has_meta_pixel,
            hasGoogleAds: !!audit.has_google_ads_tag,
        },
        expansionKeywords: audit.top_keywords_found || [],
        ctas: {
            hasGeneralCTA: !!audit.has_cta_keywords,
            hasReviewWidget: !!audit.has_review_widget,
            bookingUrls: audit.has_booking_link ? [{ platform: 'detected', url: '' }] : []
        },
        socials: { 
            instagram: companyDetails.socials?.find((s: any) => s.platform === 'instagram') ? { url: '', handle: '' } : null,
            facebook: companyDetails.socials?.find((s: any) => s.platform === 'facebook') ? { url: '' } : null,
            tiktok: companyDetails.socials?.find((s: any) => s.platform === 'tiktok') ? { url: '' } : null,
        },
        uxDecay: {
            copyrightYear: null,
            isOutdatedCopyright: false,
            usesCheapBuilder: !!audit.uses_cheap_builder
        }
    };

    // 3. Recalculate
    const newScore = calculateLeadScore(mockEnrichment, {
        url: companyDetails.website || '',
        reviewCount: companyDetails.rating_count || 0,
        reviewAvg: companyDetails.rating_avg || 0,
        mobilePerformance: audit.pagespeed_mobile,
        desktopPerformance: audit.pagespeed_desktop
    });

    // 4. Save to DB
    await supabase.from('scores').update({
        score_overall: newScore.total,
        score_max: newScore.maxTotal,
        score_contactability: newScore.contactability,
        score_seo: newScore.uxDecayTechnical,
        score_local_intent: newScore.cashFlowMaturity,
        score_fit: 0
    }).eq('company_id', companyId);

    return newScore;
}

export async function fetchAndSavePageSpeed(companyId: string, website: string) {
    try {
        const metrics = await fetchPageSpeedMetrics(website);
        if ('error' in metrics) throw new Error(metrics.error);

        const { pagespeed_mobile, pagespeed_desktop, mobile_load_time } = metrics;

        const supabase = await createClient();
        
        // 1. Get current data to reconstruct EnrichmentData for score recalculation
        const { data: companyDetails } = await supabase
            .from('companies')
            .select(`
                *,
                seo_audits(*),
                contacts(*),
                socials(*),
                scores(*)
            `)
            .eq('id', companyId)
            .single();

        if (!companyDetails) throw new Error("Company not found");

        const audit = companyDetails.seo_audits?.[0];
        if (!audit) throw new Error("SEO Audit record missing");

        // 2. Perform DB Update for PageSpeed
        const { error: updateError } = await supabase
            .from('seo_audits')
            .update({ pagespeed_mobile, pagespeed_desktop, mobile_load_time })
            .eq('company_id', companyId);

        if (updateError) throw new Error(updateError.message);

        // 2. Recalculate Score with new performance metrics
        const newScore = await recalculateAndSaveScore(companyId, supabase);

        revalidatePath('/lead-finder');
        revalidatePath('/pipeline');
        
        return { success: true, pagespeed_mobile, pagespeed_desktop, mobile_load_time, newScore };
    } catch (error: any) {
        return { error: error.message || 'Failed to fetch PageSpeed' };
    }
}
