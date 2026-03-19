-- Phase 2: Manual Audit Fields
-- Run this in your Supabase SQL Editor

ALTER TABLE public.companies 
  ADD COLUMN IF NOT EXISTS manual_notes text,
  ADD COLUMN IF NOT EXISTS ig_followers int,
  ADD COLUMN IF NOT EXISTS ig_activity text CHECK (ig_activity IN ('very_active', 'mid_active', 'low_active', 'not_active'));
