import json
with open('src/app/actions/leads.ts', 'r', encoding='utf-8') as f:
    orig = f.read()

# 1. PageSpeed API Key Fix
target_fetch = """        const [mobileRes, desktopRes] = await Promise.all([
            fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(urlToScrape)}&strategy=mobile`),
            fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(urlToScrape)}&strategy=desktop`)
        ]);"""
replacement_fetch = """        const apiKey = process.env.GOOGLE_PLACES_API_KEY || '';
        const keyParam = apiKey ? `&key=${apiKey}` : '';
        const [mobileRes, desktopRes] = await Promise.all([
            fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(urlToScrape)}&strategy=mobile${keyParam}`),
            fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(urlToScrape)}&strategy=desktop${keyParam}`)
        ]);"""
content = orig.replace(target_fetch, replacement_fetch)

# 2. SEO Audits Insert
target_insert = """        await supabase.from('seo_audits').insert([{
            company_id: companyId,
            has_title: scrapeResult.seoAudit?.has_title || false,
            title_len: scrapeResult.seoAudit?.title_len || 0,
            has_h1: scrapeResult.seoAudit?.has_h1 || false,
            has_booking_link: scrapeResult.seoAudit?.has_booking_link || false,
            schema_org_types: scrapeResult.seoAudit?.has_schema ? ['Found'] : [],
            top_keywords_found: scrapeResult.enrichment?.expansionKeywords || []
        }]);"""
replacement_insert = """        await supabase.from('seo_audits').insert([{
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
            has_contact_form: scrapeResult.seoAudit?.has_contact_form || false
        }]);"""

if target_insert in content:
    content = content.replace(target_insert, replacement_insert)
else:
    print("Could not find insert payload")
    
if content != orig:
    with open('src/app/actions/leads.ts', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patched leads.ts")
else:
    print("No changes made to leads.ts")
