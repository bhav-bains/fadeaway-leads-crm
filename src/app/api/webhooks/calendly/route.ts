import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
    try {
        const payload = await req.json();

        // Basic validation for Calendly's payload structure
        // 'invitee.created' is the typical event when someone books a meeting
        if (payload.event === 'invitee.created') {
            const inviteeEmail = payload.payload.email;

            if (inviteeEmail) {
                const supabase = await createClient();

                // 1. Find the company associated with this email
                const { data: contacts, error: contactError } = await supabase
                    .from('contacts')
                    .select('company_id')
                    .eq('email', inviteeEmail);

                if (contactError || !contacts || contacts.length === 0) {
                    console.log(`Webhook received but email ${inviteeEmail} not found in CRM.`);
                    return NextResponse.json({ received: true, status: 'no_match' });
                }

                // 2. Auto-Movement (Booked)
                // If the email is in multiple companies, we update all (edge case)
                for (const contact of contacts) {
                    await supabase
                        .from('companies')
                        .update({ status: 'Booked' })
                        .eq('id', contact.company_id);
                }

                return NextResponse.json({ received: true, status: 'booked_success', updatedCount: contacts.length });
            }
        }

        return NextResponse.json({ received: true, status: 'ignored_event' });
    } catch (e: any) {
        console.error("Webhook processing error:", e);
        return NextResponse.json({ error: "Invalid payload formatting" }, { status: 400 });
    }
}
