-- Adding PageSpeed Insights columns to the seo_audits table
ALTER TABLE public.seo_audits
ADD COLUMN pagespeed_mobile int,
ADD COLUMN pagespeed_desktop int;
