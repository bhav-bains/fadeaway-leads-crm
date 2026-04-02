import { NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { createServiceClient } from '@/lib/supabase/service';

// Resend signs all webhook payloads using svix.
// Get your webhook signing secret from: Resend Dashboard → Webhooks → your endpoint → Signing Secret
const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;

export async function POST(req: Request) {
    if (!WEBHOOK_SECRET) {
        console.error('[Resend Webhook] RESEND_WEBHOOK_SECRET is not set.');
        return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    // 1. Extract svix signature headers
    const svixId = req.headers.get('svix-id');
    const svixTimestamp = req.headers.get('svix-timestamp');
    const svixSignature = req.headers.get('svix-signature');

    if (!svixId || !svixTimestamp || !svixSignature) {
        return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 });
    }

    // 2. Verify signature
    const body = await req.text();
    let event: any;

    try {
        const wh = new Webhook(WEBHOOK_SECRET);
        event = wh.verify(body, {
            'svix-id': svixId,
            'svix-timestamp': svixTimestamp,
            'svix-signature': svixSignature,
        });
    } catch (err) {
        console.error('[Resend Webhook] Signature verification failed:', err);
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const { type, data } = event;
    console.log(`[Resend Webhook] Event received: ${type}`, data);

    // 3. Look up outreach_message by Resend email ID
    // Resend sends the email ID as data.email_id
    const resendEmailId = data?.email_id;
    if (!resendEmailId) {
        return NextResponse.json({ received: true });
    }

    const supabase = createServiceClient();

    // 4. Handle each event type
    try {
        switch (type) {
            case 'email.opened': {
                await supabase.rpc('increment_outreach_open', { resend_id: resendEmailId });
                console.log(`[Resend Webhook] Open tracked for ${resendEmailId}`);
                break;
            }
            case 'email.clicked': {
                await supabase.rpc('increment_outreach_click', { resend_id: resendEmailId });
                console.log(`[Resend Webhook] Click tracked for ${resendEmailId}`);
                break;
            }
            case 'email.bounced': {
                await supabase
                    .from('outreach_messages')
                    .update({ status: 'bounced' })
                    .eq('resend_id', resendEmailId);
                console.log(`[Resend Webhook] Bounce recorded for ${resendEmailId}`);
                break;
            }
            case 'email.complained': {
                await supabase
                    .from('outreach_messages')
                    .update({ status: 'complained' })
                    .eq('resend_id', resendEmailId);
                console.log(`[Resend Webhook] Complaint recorded for ${resendEmailId}`);
                break;
            }
            case 'email.delivery_delayed': {
                await supabase
                    .from('outreach_messages')
                    .update({ status: 'delayed' })
                    .eq('resend_id', resendEmailId);
                break;
            }
            default:
                console.log(`[Resend Webhook] Unhandled event type: ${type}`);
        }
    } catch (err) {
        console.error('[Resend Webhook] DB update failed:', err);
        // Still return 200 so Resend doesn't retry indefinitely
    }

    return NextResponse.json({ received: true });
}
