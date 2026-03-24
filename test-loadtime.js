require('dotenv').config({ path: '.env.local' });
const key = process.env.GOOGLE_PLACES_API_KEY;
const url = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://stripe.com&strategy=mobile&key=${key}`;
fetch(url).then(res => res.json()).then(data => {
    console.log("FCP:", data?.lighthouseResult?.audits?.['first-contentful-paint']?.displayValue);
    console.log("Speed Index:", data?.lighthouseResult?.audits?.['speed-index']?.displayValue);
    console.log("Interactive:", data?.lighthouseResult?.audits?.['interactive']?.displayValue);
}).catch(console.error);
