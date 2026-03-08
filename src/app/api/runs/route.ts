import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { startCaptureRun } from '@/lib/capture-worker';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { query, city, lat, lng, radius_m, limit } = body;

        // Basic validation
        if (!query || !lat || !lng) {
            return NextResponse.json({ error: 'Missing required fields: query, lat, lng' }, { status: 400 });
        }

        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: profile } = await supabase.from('profiles').select('workspace_id').eq('id', user.id).single();
        if (!profile || !profile.workspace_id) {
            return NextResponse.json({ error: 'No workspace found' }, { status: 400 });
        }

        // Create run
        const { data: run, error: runErr } = await supabase.from('runs').insert({
            workspace_id: profile.workspace_id,
            query: query,
            city: city,
            lat: lat,
            lng: lng,
            radius_m: radius_m || 50000,
            status: 'in_progress',
            started_at: new Date().toISOString(),
            totals_json: { found: 0, enriched: 0, scored: 0, saved: 0, skipped: 0 }
        }).select('id').single();

        if (runErr || !run) {
            console.error("Failed to create run:", runErr);
            return NextResponse.json({ error: runErr?.message || 'Failed to create run' }, { status: 500 });
        }

        // We need to pass the user's auth token to the background worker so it can bypass RLS 
        // as the authenticated user, without needing the dangerous Service Role Key.
        const authHeader = req.headers.get('authorization');
        let token = authHeader?.replace('Bearer ', '');

        // If no auth header, try to extract from cookies (Supabase auth helper standard)
        if (!token) {
            const cookies = req.headers.get('cookie');
            if (cookies) {
                // very basic cookie parsing for the session token; better to use the robust method
                // but since Next.js route handlers with Supabase usually rely on the cookie store
                const cookieObj = Object.fromEntries(cookies.split('; ').map(c => c.split('=')));
                const sbCookie = Object.keys(cookieObj).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
                if (sbCookie) {
                    try {
                        const parsed = JSON.parse(decodeURIComponent(cookieObj[sbCookie]));
                        token = parsed[0]; // access_token is typically the first item
                    } catch (e) { }
                }
            }
        }

        // Fire and forget worker
        // In local/Node environment, this executes asynchronously in the background.
        // On Vercel (serverless), it may require waitUntil or a background job queue (e.g., Inngest) to guarantee life-cycle.
        startCaptureRun(
            run.id,
            profile.workspace_id,
            query,
            city || "Unknown",
            lat,
            lng,
            radius_m || 50000,
            limit || 50,
            token || ''
        ).catch(e => console.error("Background worker failed:", e));

        // Immediately return run_id
        return NextResponse.json({ run_id: run.id });

    } catch (e: any) {
        console.error("POST /api/runs error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
