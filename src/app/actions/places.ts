"use server";

// For MVP, we will mock the Google Places API response 
// until API keys are fully integrated in production.

export async function fetchLeads(niche: string, city: string) {
    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, 1500));

    // In production, this would look like:
    // const res = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=${niche}+in+${city}&key=${process.env.GOOGLE_PLACES_KEY}`)
    // const data = await res.json()

    console.log(`[Server Action] Querying Google Places for: ${niche} in ${city}`);

    // Mock returning data shaped mostly like our schema
    return [
        {
            id: "place_1",
            name: `${city} ${niche} Pros`,
            address: `100 Main St, ${city}`,
            city: city,
            website: `${niche.toLowerCase().replace(/\s/g, '')}${city.toLowerCase().replace(/\s/g, '')}.com`,
            phone: "(555) 123-4567",
            niche: niche
        },
        {
            id: "place_2",
            name: `Elite ${niche} Co. of ${city}`,
            address: `250 Center Ave, ${city}`,
            city: city,
            website: `elite${niche.toLowerCase().replace(/\s/g, '')}.com`,
            phone: "(555) 987-6543",
            niche: niche
        },
        {
            id: "place_3",
            name: `Discount ${niche} Services`,
            address: `88 Industrial Blvd, ${city}`,
            city: city,
            website: `budget${niche.toLowerCase().replace(/\s/g, '')}.com`,
            phone: "(555) 444-2222",
            niche: niche
        },
        {
            id: "place_4",
            name: `A+ ${niche} Experts`,
            address: `12 Tech Way, ${city}`,
            city: city,
            website: undefined,
            phone: "(555) 777-8888",
            niche: niche
        },
    ];
}
