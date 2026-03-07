import { NextResponse } from 'next/server';
import { Resend } from 'resend';

// Initialize with a mock / optional key. Resend sdk handles missing key if gracefully handled.
const resend = new Resend(process.env.RESEND_API_KEY || 're_mock_key');

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { leadId, name, email, stage } = body;

        console.log(`[Automations] Triggering ${stage} sequence for:`, name, email);

        if (!process.env.RESEND_API_KEY) {
            console.log("[Automations] No RESEND_API_KEY found. Simulating email send.");
            return NextResponse.json({ success: true, simulated: true, mockMessage: "Email sent to output via mock." });
        }

        const data = await resend.emails.send({
            from: 'Fadeaway CRM <outbound@fadeaway-leads.com>', // Or verified domain
            to: [email],
            subject: `Hey ${name} - Question about your services`,
            html: `
                <div>
                    <p>Hi there,</p>
                    <p>I was looking for businesses in your area and noticed your team. I had a quick question about your services.</p>
                    <p>Do you have 5 minutes for a quick chat next week?</p>
                    <p>Best,<br/>Sarah<br/>Fadeaway Creatives</p>
                </div>
            `,
        });

        return NextResponse.json({ success: true, data });

    } catch (error: any) {
        console.error("[Automations] Error sending email:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
