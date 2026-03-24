-- 🚨 CAUTION: THIS WILL DELETE ALL DATA, USERS, WORKSPACES, AND LEADS 🚨
-- Run this script in the Supabase SQL Editor to perform a hard reset.

-- 1. Wipe all dynamically created data
DELETE FROM public.fetch_log;
DELETE FROM public.outreach_messages;
DELETE FROM public.scores;
DELETE FROM public.seo_audits;
DELETE FROM public.socials;
DELETE FROM public.contacts;

-- 2. Wipe companies, leads, and tracking data
DELETE FROM public.runs;
DELETE FROM public.companies;
DELETE FROM public.leads;

-- 3. Wipe workspaces and profiles
DELETE FROM public.settings;
DELETE FROM public.profiles;
DELETE FROM public.workspaces;

-- 4. Delete all authenticated users
DELETE FROM auth.users;
