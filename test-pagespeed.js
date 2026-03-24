const url = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://fadeawayperformance.com&strategy=mobile";
fetch(url).then(res => res.json()).then(data => {
    console.log("Status:", data.error ? data.error.message : "Success");
    console.log("Raw score:", data?.lighthouseResult?.categories?.performance?.score);
}).catch(console.error);
