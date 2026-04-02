-- Migration: Add from_email to profiles and sending_domain to settings
-- Run this in your Supabase SQL Editor

-- 1. Per-user sending email (e.g. bhav@fadeawaycreatives.ca, neha@fadeawaycreatives.ca)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS from_email text;

-- 2. Workspace-level domain control (e.g. fadeawaycreatives.ca)
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS sending_domain text;

-- 3. Seed your current users (update UUIDs to match your actual profile IDs)
-- UPDATE public.profiles SET from_email = 'bhav@fadeawaycreatives.ca' WHERE full_name ILIKE '%bhav%';
-- UPDATE public.profiles SET from_email = 'neha@fadeawaycreatives.ca' WHERE full_name ILIKE '%neha%';

-- 4. Set workspace sending domain
-- UPDATE public.settings SET sending_domain = 'fadeawaycreatives.ca';
