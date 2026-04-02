-- Migration: Add signature fields to profiles
-- Run this in your Supabase SQL Editor

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS title text;

ALTER TABLE public.profiles  
ADD COLUMN IF NOT EXISTS signature_url text;
