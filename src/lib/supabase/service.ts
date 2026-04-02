import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Service role client — bypasses RLS.
 * Use ONLY in server-side API routes that have no user session context
 * (e.g. webhook receivers, cron jobs, background tasks).
 * NEVER expose this to the client.
 */
export function createServiceClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !serviceKey) {
        throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    }

    return createSupabaseClient(url, serviceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        }
    })
}
