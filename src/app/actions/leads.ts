'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { scrapeWebsite } from '@/lib/scraper'

export async function insertLead(leadData: { name: string, address: string, city: string, phone?: string, website?: string, niche?: string, reviewCount?: number }) {
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

    // 3. Insert into companies (Replaces old 'leads' table)
    const { data: company, error: companyError } = await supabase
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

    if (companyError || !company) {
        console.error("Error inserting company:", companyError)
        return { error: companyError?.message || "Failed to create company" }
    }

    const companyId = company.id;

    // 4. Run the SEO Audit Scraper
    let scrapeResult = null;
    let urlToScrape = leadData.website;
    if (urlToScrape && !urlToScrape.startsWith('http')) {
        urlToScrape = `https://${urlToScrape}`;
    }

    if (urlToScrape) {
        scrapeResult = await scrapeWebsite(urlToScrape, leadData.city, leadData.niche || '', leadData.reviewCount || 0);

        // Insert SEO Audits
        await supabase.from('seo_audits').insert([{
            company_id: companyId,
            has_title: scrapeResult.seoAudit.has_title,
            title_len: scrapeResult.seoAudit.title_len,
            has_h1: scrapeResult.seoAudit.has_h1,
            has_booking_link: scrapeResult.seoAudit.has_booking_link,
            schema_org_types: scrapeResult.seoAudit.has_schema ? ['Found'] : []
        }]);

        // Insert Scores
        await supabase.from('scores').insert([{
            company_id: companyId,
            score_overall: scrapeResult.totalScore,
            score_contactability: scrapeResult.contactabilityScore,
            score_seo: scrapeResult.seoScore,
            score_local_intent: scrapeResult.localIntentScore,
            score_fit: scrapeResult.fitScore
        }]);

        // Insert Contacts
        if (scrapeResult.emails.length > 0) {
            const contactInserts = scrapeResult.emails.map(e => ({
                company_id: companyId,
                email: e.email,
                type: e.type,
                confidence: 90
            }));
            await supabase.from('contacts').insert(contactInserts);
        }

        // Insert Socials
        if (scrapeResult.socials.length > 0) {
            const socialInserts = scrapeResult.socials.map(s => ({
                company_id: companyId,
                platform: s.platform,
                url: s.url
            }));
            await supabase.from('socials').insert(socialInserts);
        }
    } else {
        // Fallback empty scores if no website
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
