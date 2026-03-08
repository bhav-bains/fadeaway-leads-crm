import { createClient } from '@supabase/supabase-js';
import { scrapeWebsite } from '@/lib/scraper';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function startEnrichmentWorker(
    companyId: string,
    websiteUrl: string | null,
    city: string,
    runId: string | undefined,
    userToken: string
) {
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
            headers: { Authorization: `Bearer ${userToken}` }
        }
    });

    try {
        let urlToScrape = websiteUrl;

        if (!urlToScrape) {
            await logFetch(supabaseClient, companyId, 'Init', 'Skipped', 'No website URL provided');
            return;
        }

        if (!urlToScrape.startsWith('http')) {
            urlToScrape = `https://${urlToScrape}`;
        }

        // Log the start
        await logFetch(supabaseClient, companyId, 'Scrape_Start', 'In Progress', `Starting enrichment for ${urlToScrape}`);

        // Grab existing details needed for scoring (reviews)
        const { data: companyDetails } = await supabaseClient
            .from('companies')
            .select('rating_avg, rating_count')
            .eq('id', companyId)
            .single();

        const rCount = companyDetails?.rating_count || 0;
        const rAvg = companyDetails?.rating_avg || 0;

        // 1. Scrape Website (2-Page Strategy)
        const scrapeResult = await scrapeWebsite(urlToScrape, city, '', rCount, rAvg); // basic defaults

        // 2. Database Writes

        // Contacts
        if (scrapeResult.emails.length > 0) {
            const contactInserts = scrapeResult.emails.map(e => ({
                company_id: companyId,
                email: e.email,
                type: e.type,
                confidence: 90
            }));
            await supabaseClient.from('contacts').insert(contactInserts);
        }

        // Socials
        if (scrapeResult.socials.length > 0) {
            const socialInserts = scrapeResult.socials.map(s => ({
                company_id: companyId,
                platform: s.platform,
                url: s.url
            }));
            await supabaseClient.from('socials').insert(socialInserts);
        }

        // SEO Audits
        // Check if row already exists from creation (Pipeline flow) vs new Capture Engine flow
        const { data: existingAudit } = await supabaseClient.from('seo_audits').select('id').eq('company_id', companyId).limit(1);

        const auditPayload = {
            company_id: companyId,
            has_title: scrapeResult.seoAudit.has_title,
            title_len: scrapeResult.seoAudit.title_len,
            has_h1: scrapeResult.seoAudit.has_h1,
            has_booking_link: scrapeResult.seoAudit.has_booking_link,
            schema_org_types: scrapeResult.seoAudit.has_schema ? ['Found'] : []
        };

        if (existingAudit && existingAudit.length > 0) {
            await supabaseClient.from('seo_audits').update(auditPayload).eq('company_id', companyId);
        } else {
            await supabaseClient.from('seo_audits').insert([auditPayload]);
        }

        // Scores (Optional based on pipeline flow, but good to ensure they exist)
        const { data: existingScore } = await supabaseClient.from('scores').select('id').eq('company_id', companyId).limit(1);
        const scorePayload = {
            company_id: companyId,
            score_overall: scrapeResult.totalScore,
            score_contactability: scrapeResult.contactabilityScore,
            score_seo: scrapeResult.seoScore,
            score_local_intent: scrapeResult.localIntentScore,
            score_fit: scrapeResult.fitScore
        };

        if (existingScore && existingScore.length > 0) {
            await supabaseClient.from('scores').update(scorePayload).eq('company_id', companyId);
        } else {
            await supabaseClient.from('scores').insert([scorePayload]);
        }

        // Log completion
        await logFetch(supabaseClient, companyId, 'Scrape_Complete', 'Success', `Extracted ${scrapeResult.emails.length} emails and ${scrapeResult.socials.length} socials.`);

        // 3. Update Runs totals_json if a run_id was provided
        if (runId) {
            const { data: run } = await supabaseClient.from('runs').select('totals_json').eq('id', runId).single();
            if (run && run.totals_json) {
                const updatedTotals = { ...run.totals_json };
                updatedTotals.enriched = (updatedTotals.enriched || 0) + 1;
                updatedTotals.scored = (updatedTotals.scored || 0) + 1;
                await supabaseClient.from('runs').update({ totals_json: updatedTotals }).eq('id', runId);
            }
        }

    } catch (e: any) {
        console.error("Enrichment Worker error:", e);
        await logFetch(supabaseClient, companyId, 'Scrape_Failed', 'Error', e.message);
    }
}

async function logFetch(supabase: any, companyId: string, step: string, status: string, notes: string) {
    try {
        await supabase.from('fetch_log').insert({
            company_id: companyId,
            url: '', // optional
            step: step,
            status: status,
            notes: notes
        });
    } catch (e) {
        console.error("Failed to write to fetch_log", e);
    }
}
