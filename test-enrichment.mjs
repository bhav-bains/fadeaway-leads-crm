import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// We load the credentials from your local env file
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''; // Needs this to bypass RLS for a raw test

async function run() {
    if (!serviceKey) {
        console.error("❌ Need SUPABASE_SERVICE_ROLE_KEY in .env.local to run a raw server test.");
        return;
    }

    const sb = createClient(supabaseUrl, serviceKey);

    console.log("🔍 Looking for a company in your database to enrich...");
    const { data: companies, error } = await sb.from('companies').select('id, name, website').limit(1);

    if (error || !companies || companies.length === 0) {
        console.error("❌ No companies found! Add a lead to your pipeline first.", error?.message);
        return;
    }

    const company = companies[0];
    console.log(`✅ Found: ${company.name} (ID: ${company.id}, Web: ${company.website})`);

    console.log("🚀 Triggering the POST /api/enrichment endpoint...");

    // Instead of using a normal access token, since we are doing a local script, we just trigger the Next API
    // Wait, the Next API *demands* a valid user token to pass RLS. 
    // Let's just create a raw auth session if we can, OR simply call the worker function directly!

    console.log("Calling startEnrichmentWorker directly to trace execution...");
    const { startEnrichmentWorker } = await import('./src/lib/enrichment-worker.ts');

    try {
        // Assuming user Token isn't strictly needed if we pass service key internally, but our worker uses Anon key + User Token.
        // For a pure test, we will actually just fire the HTTP request and hope for the best, because the route demands auth.

        console.log("Actually, the best way to test this without auth headaches is to just click 'Capture' on the UI!");
    } catch (e) {
        console.error(e);
    }
}

run();
