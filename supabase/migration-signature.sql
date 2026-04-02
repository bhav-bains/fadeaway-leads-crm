-- Migration: Add signature_url to profiles
-- Run this in your Supabase SQL Editor

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS signature_url text;

-- Seed your users
-- UPDATE public.profiles SET signature_url = 'https://fadeawaycreatives.com/sports/' WHERE full_name ILIKE '%bhav%';
-- UPDATE public.profiles SET signature_url = 'https://fadeawaycreatives.com/wellness/' WHERE full_name ILIKE '%neha%';
