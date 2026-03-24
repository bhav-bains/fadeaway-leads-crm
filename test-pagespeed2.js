require('dotenv').config({ path: '.env.local' });
const key = process.env.GOOGLE_PLACES_API_KEY;
console.log("Using key:", Boolean(key));
const url = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://stripe.com&strategy=mobile&key=${key}`;
fetch(url).then(res => res.json()).then(data => {
    console.log("Status:", data.error ? data.error.message : "Success");
    console.log("Raw score:", data?.lighthouseResult?.categories?.performance?.score);
}).catch(console.error);
