import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseEmailTemplate } from '@/lib/outreach';

export async function POST(req: Request) {
    const supabase = await createClient();

    // 1. Authenticate user and get workspace
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('workspace_id')
        .eq('id', user.id)
        .single();

    if (!profile?.workspace_id) {
        return NextResponse.json({ error: "No workspace found" }, { status: 400 });
    }

    // 2. Parse request body
    const { companyId, contactEmail, sequenceName, subject, rawBodyTemplate } = await req.json();

    if (!companyId || !contactEmail || !sequenceName || !subject || !rawBodyTemplate) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    try {
        // 3. Token Parser Logic
        const parsedBody = await parseEmailTemplate(rawBodyTemplate, companyId, profile.workspace_id);

        // 4. Send Email via Resend
        // (If RESEND_API_KEY is not set or disabled, we simulate a successful send for dev MVP)
        let resendId = `sim_${Date.now()}`;
        const DISABLE_EMAIL_SEND = true; // Added to temporarily stop automatic emails

        if (!DISABLE_EMAIL_SEND && process.env.RESEND_API_KEY) {
            const res = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    from: 'Fadeaway Leads <hello@fadeawayleads.com>', // MUST BE verified in Resend
                    to: [contactEmail],
                    subject: subject,
                    text: parsedBody // Sending as plain text for max deliverability
                })
            });

            if (!res.ok) {
                const err = await res.text();
                throw new Error(`Resend API Error: ${err}`);
            }

            const resendData = await res.json();
            resendId = resendData.id;
        } else {
            console.log(`[Email Simulated] Subject: ${subject}`);
        }

        // 5. Save Engagement History
        await supabase.from('outreach_messages').insert([{
            company_id: companyId,
            sequence_name: sequenceName,
            step: 1,
            subject: subject,
            body: parsedBody,
            sent_at: new Date().toISOString(),
            status: 'sent',
            open_count: 0,
            click_count: 0,
            reply_flag: false
        }]);

        // 6. Auto-Movement (Contacted)
        await supabase.from('companies')
            .update({ status: 'Contacted' })
            .eq('id', companyId);

        return NextResponse.json({ success: true, messageId: resendId, parsedBody });

    } catch (e: any) {
        console.error("Outreach dispatch failed:", e);
        return NextResponse.json({ error: e.message || "Failed to dispatch sequence" }, { status: 500 });
    }
}
