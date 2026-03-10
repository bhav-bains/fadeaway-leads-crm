'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { scrapeWebsite } from '@/lib/scraper'

export async function insertLead(leadData: { name: string, address: string, city: string, phone?: string, website?: string, niche?: string, reviewCount?: number }, scrapeResult?: Record<string, any>) {
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

    if (!profile || !profile.workspace_id) {
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

    if (normalizedWebsite || normalizedPhone) {
        // Build OR query dynamically
        let matchQuery = '';
        if (normalizedWebsite && normalizedPhone) {
            matchQuery = `website.ilike.%${normalizedWebsite}%,phone.ilike.%${normalizedPhone}%`;
        } else if (normalizedWebsite) {
            matchQuery = `website.ilike.%${normalizedWebsite}%`;
        } else if (normalizedPhone) {
            matchQuery = `phone.ilike.%${normalizedPhone}%`;
        }

        const { data: matches, error: matchError } = await supabase
            .from('companies')
            .select('*')
            .eq('workspace_id', profile.workspace_id)
            .or(matchQuery)
            .limit(1);

        if (!matchError && matches && matches.length > 0) {
            existingCompany = matches[0];
            console.log(`[Deduplication] Blocked insertion. Found existing match for ${leadData.name} via Domain/Phone.`);
        }
    }

    // 4. Insert or Upsert into companies
    let company;
    let companyError;

    if (existingCompany) {
        // Upsert Scenario: Only update fresh scraped data, never ruin their pipeline status
        const { data: updatedCompany, error: upError } = await supabase
            .from('companies')
            .update({
                name: leadData.name, // Refresh name
                address: leadData.address,
                city: leadData.city,
                phone: leadData.phone || existingCompany.phone,
                website: leadData.website || existingCompany.website,
                // Do NOT touch 'status' or 'created_at' to preserve pipeline integrity
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
                address: leadData.address,
                city: leadData.city,
                phone: leadData.phone,
                website: leadData.website,
                status: 'New'
            }])
            .select()
            .single();

        company = newCompany;
        companyError = inError;
    }

    if (companyError || !company) {
        console.error("Error saving company:", companyError)
        return { error: companyError?.message || "Failed to save company" }
    }

    const companyId = company.id;

    // 5. Save or Update SEO Audit Results
    if (scrapeResult) {
        // Wipe existing child rows cleanly rather than crafting complex merging logic per table
        // This simulates a fresh "Upsert" of the audit data every time we re-scrape.
        if (existingCompany) {
            await supabase.from('seo_audits').delete().eq('company_id', companyId);
            await supabase.from('scores').delete().eq('company_id', companyId);
            await supabase.from('contacts').delete().eq('company_id', companyId);
            await supabase.from('socials').delete().eq('company_id', companyId);
        }

        // Insert fresh SEO Audits
        await supabase.from('seo_audits').insert([{
            company_id: companyId,
            has_title: scrapeResult.seoAudit?.has_title || false,
            title_len: scrapeResult.seoAudit?.title_len || 0,
            has_h1: scrapeResult.seoAudit?.has_h1 || false,
            has_booking_link: scrapeResult.seoAudit?.has_booking_link || false,
            schema_org_types: scrapeResult.seoAudit?.has_schema ? ['Found'] : []
        }]);

        // Insert fresh Scores
        await supabase.from('scores').insert([{
            company_id: companyId,
            score_overall: scrapeResult.totalScore || 0,
            score_contactability: scrapeResult.contactabilityScore || 0,
            score_seo: scrapeResult.seoScore || 0,
            score_local_intent: scrapeResult.localIntentScore || 0,
            score_fit: scrapeResult.fitScore || 0
        }]);

        // Insert fresh Contacts
        if (scrapeResult.emails && scrapeResult.emails.length > 0) {
            const contactInserts = scrapeResult.emails.map((e: Record<string, any>) => ({
                company_id: companyId,
                email: e.email,
                type: e.type,
                confidence: 90
            }));
            await supabase.from('contacts').insert(contactInserts);
        }

        // Insert fresh Socials
        if (scrapeResult.socials && scrapeResult.socials.length > 0) {
            const socialInserts = scrapeResult.socials.map((s: Record<string, any>) => ({
                company_id: companyId,
                platform: s.platform,
                url: s.url
            }));
            await supabase.from('socials').insert(socialInserts);
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

export async function runLocalSeoAudit(website: string, city: string, niche: string, ratingCount: number) {
    let urlToScrape = website;
    if (urlToScrape && !urlToScrape.startsWith('http')) {
        urlToScrape = `https://${urlToScrape}`;
    }

    if (!urlToScrape) {
        return { error: "No Website Found", score: 0, email: '', biggestWeakness: '🔴 No Website Found', bookingDetected: false };
    }

    try {
        const scrape = await scrapeWebsite(urlToScrape, city, niche, ratingCount);
        return {
            data: {
                score: scrape.totalScore,
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
        console.error("Error fetching leads:", error)
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
        console.error("Error updating lead status:", error)
        return { error: error.message }
    }

    revalidatePath('/pipeline')
    return { data }
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
        console.error("Error fetching paginated leads:", error);
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
        console.error("Error fetching pipeline leads:", error);
        return { error: error.message, data: [] };
    }

    return { data: data || [] };
}
