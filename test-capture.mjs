import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qctxvbbttorqprnbgxxu.supabase.co';
const supabaseKey = 'sb_publishable_ztmqgk77L7XZET4GacIOtQ_Pfh4KsiL';
// need service key to create an auto-confirmed test user
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sbAdmin = createClient(supabaseUrl, serviceKey || supabaseKey);
const sbUser = createClient(supabaseUrl, supabaseKey);

async function run() {
    if (!serviceKey) {
        console.error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable. Cannot auto-confirm test user.");
        return;
    }

    const testEmail = 'test_worker_auto@fadeaway.com';
    const testPassword = 'password123';

    console.log("Setting up auto-confirmed test user...");
    const { data: adminUser, error: adminErr } = await sbAdmin.auth.admin.createUser({
        email: testEmail,
        password: testPassword,
        email_confirm: true
    });

    if (adminErr && adminErr.message !== 'User already registered') {
        console.error("Failed to create user via admin API:", adminErr);
        return;
    }

    console.log("Signing in as test user...");
    const { data: user, error: signinErr } = await sbUser.auth.signInWithPassword({
        email: testEmail,
        password: testPassword
    });

    if (signinErr) {
        console.error("Sign in failed:", signinErr.message);
        return;
    }

    const token = user.session?.access_token;
    if (!token) {
        console.error("Failed to get auth token");
        return;
    }

    console.log("Successfully authenticated. Token aquired.");

    console.log("Triggering POST /api/runs...");
    const postRes = await fetch('http://localhost:3000/api/runs', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
            query: 'Basketball Academies',
            city: 'Vancouver',
            lat: 49.2827,
            lng: -123.1207,
            radius_m: 50000,
            limit: 5
        })
    });

    const postData = await postRes.json();
    console.log("POST Response:", postData);

    if (!postData.run_id) {
        console.error("Did not receive a run_id. Aborting test.");
        return;
    }

    let attempts = 0;
    const runId = postData.run_id;

    console.log(`Polling status for run_id: ${runId}...`);
    const poll = setInterval(async () => {
        const statusRes = await fetch(`http://localhost:3000/api/runs/${runId}/status`, {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });

        const statusData = await statusRes.json();
        console.log(`[Attempt ${attempts}] Status:`, statusData);

        if (statusData.status === 'done' || statusData.status === 'error' || attempts > 15) {
            clearInterval(poll);
            console.log("Test finished.");
        }
        attempts++;
    }, 3000);
}

run();
