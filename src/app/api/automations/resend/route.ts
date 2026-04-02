import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseEmailTemplate } from '@/lib/outreach';
import { buildOutreachHtml } from '@/lib/email-template';

export async function POST(req: Request) {
    const supabase = await createClient();

    // 1. Authenticate user and get workspace
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('workspace_id, from_email, full_name, title, signature_url')
        .eq('id', user.id)
        .single();

    if (!profile?.workspace_id) {
        return NextResponse.json({ error: "No workspace found" }, { status: 400 });
    }

    // 2. Resolve "from" address from user profile + validate against workspace domain
    const { data: settings } = await supabase
        .from('settings')
        .select('sending_domain')
        .eq('workspace_id', profile.workspace_id)
        .single();

    const senderEmail = profile.from_email;
    if (!senderEmail) {
        return NextResponse.json({ error: "No sending email configured on your profile. Go to Settings to set it up." }, { status: 400 });
    }

    // Domain enforcement: if workspace has a sending_domain set, validate the user's from_email matches
    if (settings?.sending_domain) {
        const emailDomain = senderEmail.split('@')[1]?.toLowerCase();
        const allowedDomain = settings.sending_domain.toLowerCase();
        if (emailDomain !== allowedDomain) {
            return NextResponse.json({ 
                error: `Your from_email domain "${emailDomain}" does not match the workspace's allowed sending domain "${allowedDomain}".` 
            }, { status: 403 });
        }
    }

    const fromDisplay = profile.full_name 
        ? `${profile.full_name} <${senderEmail}>` 
        : senderEmail;

    // 3. Parse request body
    const { companyId, contactEmail, sequenceName, subject, rawBodyTemplate } = await req.json();

    if (!companyId || !contactEmail || !sequenceName || !subject || !rawBodyTemplate) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    try {
        // 4. Token Parser Logic
        const parsedBody = await parseEmailTemplate(rawBodyTemplate, companyId, profile.workspace_id);

        // 4b. Build HTML email with branded signature
        const htmlBody = buildOutreachHtml(parsedBody, {
            fullName: profile.full_name || senderEmail.split('@')[0],
            title: profile.title || undefined,
            signatureUrl: profile.signature_url || undefined
        });

        // 5. Send Email via Resend
        let resendId = `sim_${Date.now()}`;
        const DISABLE_EMAIL_SEND = false; 

        if (!DISABLE_EMAIL_SEND && process.env.RESEND_API_KEY) {
            const res = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    from: fromDisplay,
                    to: [contactEmail], 
                    subject: subject,
                    html: htmlBody,
                    text: parsedBody
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

        // 6. Save Engagement History
        await supabase.from('outreach_messages').insert([{
            company_id: companyId,
            sequence_name: sequenceName,
            step: 1,
            subject: subject,
            body: parsedBody,
            sent_at: new Date().toISOString(),
            status: 'sent',
            resend_id: resendId,
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
