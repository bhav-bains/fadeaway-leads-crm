-- Apply these changes to your existing Supabase database to support the new Scraper Specifications

-- 1. Updates to the `companies` table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS primary_category TEXT,
ADD COLUMN IF NOT EXISTS win_probability INT DEFAULT 0;

-- 2. Updates to the `seo_audits` table
ALTER TABLE public.seo_audits 
ADD COLUMN IF NOT EXISTS pagespeed_mobile INT,
ADD COLUMN IF NOT EXISTS pagespeed_desktop INT,
ADD COLUMN IF NOT EXISTS mobile_load_time TEXT,
ADD COLUMN IF NOT EXISTS h1_count INT,
ADD COLUMN IF NOT EXISTS has_meta_description BOOLEAN,
ADD COLUMN IF NOT EXISTS has_og_image BOOLEAN,
ADD COLUMN IF NOT EXISTS uses_cheap_builder BOOLEAN,
ADD COLUMN IF NOT EXISTS revenue_pages_count INT,
ADD COLUMN IF NOT EXISTS is_single_page BOOLEAN,
ADD COLUMN IF NOT EXISTS has_cta_keywords BOOLEAN,
ADD COLUMN IF NOT EXISTS has_review_widget BOOLEAN,
ADD COLUMN IF NOT EXISTS has_meta_pixel BOOLEAN,
ADD COLUMN IF NOT EXISTS has_google_ads_tag BOOLEAN,
ADD COLUMN IF NOT EXISTS has_expansion_keywords BOOLEAN,
ADD COLUMN IF NOT EXISTS has_contact_form BOOLEAN,
ADD COLUMN IF NOT EXISTS top_keywords_found TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS schema_org_types TEXT[] DEFAULT '{}';
