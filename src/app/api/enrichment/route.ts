import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { startEnrichmentWorker } from '@/lib/enrichment-worker';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { company_id, run_id } = body;

        if (!company_id) {
            return NextResponse.json({ error: 'Missing required field: company_id' }, { status: 400 });
        }

        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify company belongs to user's workspace
        const { data: company, error: companyErr } = await supabase
            .from('companies')
            .select('id, website, city')
            .eq('id', company_id)
            .single();

        if (companyErr || !company) {
            return NextResponse.json({ error: 'Company not found or access denied' }, { status: 404 });
        }

        // We need to pass the user's auth token to the background worker so it can bypass RLS 
        const authHeader = req.headers.get('authorization');
        let token = authHeader?.replace('Bearer ', '');

        if (!token) {
            const cookies = req.headers.get('cookie');
            if (cookies) {
                const cookieObj = Object.fromEntries(cookies.split('; ').map(c => c.split('=')));
                const sbCookie = Object.keys(cookieObj).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
                if (sbCookie) {
                    try {
                        const parsed = JSON.parse(decodeURIComponent(cookieObj[sbCookie]));
                        token = parsed[0];
                    } catch (e) { }
                }
            }
        }

        // Fire and forget worker
        startEnrichmentWorker(
            company.id,
            company.website,
            company.city || '',
            run_id,
            token || ''
        ).catch(e => console.error("Enrichment worker failed:", e));

        return NextResponse.json({ success: true, message: 'Enrichment started' });

    } catch (e: any) {
        console.error("POST /api/enrichment error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
