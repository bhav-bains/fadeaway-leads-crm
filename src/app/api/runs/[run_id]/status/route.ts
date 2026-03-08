import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request, { params }: { params: Promise<{ run_id: string }> }) {
    try {
        const resolvedParams = await params;
        const runId = resolvedParams.run_id;
        if (!runId || runId === 'undefined') {
            return NextResponse.json({ error: 'Invalid run_id' }, { status: 400 });
        }

        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: run, error: runErr } = await supabase
            .from('runs')
            .select('status, totals_json')
            .eq('id', runId)
            .single();

        if (runErr || !run) {
            return NextResponse.json({ error: runErr?.message || 'Run not found' }, { status: 404 });
        }

        return NextResponse.json({
            status: run.status,
            totals_json: run.totals_json
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
