export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role key to bypass RLS for server-side webhook processing
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Very basic extraction of an email from typical webhook payloads (e.g. Calendly, Cal.com)
        const email = body.email || body.payload?.email || body.payload?.invitee?.email || body.attendee?.email;

        if (!email) {
            return NextResponse.json({ error: 'No email found in webhook payload' }, { status: 400 });
        }

        console.log(`[Webhook] Calendar event received`);

        // Find the lead matching this email
        const { data: leads, error: findError } = await supabase
            .from('leads')
            .select('id, status')
            .ilike('owner_email', email)
            .order('created_at', { ascending: false })
            .limit(1);

        if (findError || !leads || leads.length === 0) {
            console.log(`[Webhook] No matching lead found for incoming event`);
            return NextResponse.json({ success: true, message: 'No matching lead found. Ignored.' });
        }

        const leadId = leads[0].id;

        // Update the lead's status to "Meeting Booked"
        const { error: updateError } = await supabase
            .from('leads')
            .update({ status: 'Meeting Booked' })
            .eq('id', leadId);

        if (updateError) {
            console.error('[Webhook] Failed to update lead status:', updateError);
            return NextResponse.json({ error: 'Failed to update database' }, { status: 500 });
        }

        console.log(`[Webhook] Successfully updated lead ${leadId} to Meeting Booked status.`);
        return NextResponse.json({ success: true, message: 'Lead upgraded to Meeting Booked.' });

    } catch (error: any) {
        console.error('[Webhook] Internal error processing webhook:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
