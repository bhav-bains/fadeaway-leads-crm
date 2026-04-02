-- Migration: Webhook support for outreach_messages
-- Run this in your Supabase SQL Editor

-- 1. Store Resend's email ID so we can look up messages from webhook events
ALTER TABLE public.outreach_messages
ADD COLUMN IF NOT EXISTS resend_id text;

CREATE INDEX IF NOT EXISTS idx_outreach_messages_resend_id 
ON public.outreach_messages(resend_id);

-- 2. Atomic increment function for opens (avoids race conditions)
CREATE OR REPLACE FUNCTION increment_outreach_open(resend_id text)
RETURNS void AS $$
BEGIN
    UPDATE public.outreach_messages
    SET open_count = open_count + 1
    WHERE outreach_messages.resend_id = increment_outreach_open.resend_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Atomic increment function for clicks
CREATE OR REPLACE FUNCTION increment_outreach_click(resend_id text)
RETURNS void AS $$
BEGIN
    UPDATE public.outreach_messages
    SET click_count = click_count + 1
    WHERE outreach_messages.resend_id = increment_outreach_click.resend_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
