'use server'

export async function searchGooglePlaces(niche: string, city: string) {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
        console.warn("No GOOGLE_PLACES_API_KEY found. Returning mock data.");
        // Simulate network delay
        await new Promise(res => setTimeout(res, 1500));
        return {
            data: [
                { id: "1", name: `Apex ${niche} Solutions`, address: "123 Main St", city: city, website: "apexsolutions.com", phone: "(206) 555-0100", niche: niche },
                { id: "2", name: `${city} Climate Masters`, address: "456 Oak Rd", city: city, website: "climatemasters.com", phone: "(206) 555-0101", niche: niche },
                { id: "3", name: "Evergreen Experts", address: "789 Pine Ln", city: city, website: "evergreenexperts.com", phone: "(206) 555-0102", niche: niche },
                { id: "4", name: "Pacific Northwest Pros", address: "101 Maple Dr", city: city, website: "pnwpros.com", phone: "(206) 555-0103", niche: niche },
            ]
        };
    }

    try {
        const query = `${niche} in ${city}`;
        const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri',
            },
            body: JSON.stringify({
                textQuery: query,
                languageCode: 'en',
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Google Places API error:", errorText);
            return { error: 'Failed to fetch places from Google.' };
        }

        const data = await response.json();

        if (!data.places || data.places.length === 0) {
            return { data: [] };
        }

        // Clean and map the data to match our frontend interface
        const cleanData = data.places.map((place: any) => {
            // Very simple extraction of the city/address
            // In a production app, address components could be parsed more specifically.
            return {
                id: place.id,
                name: place.displayName?.text || "Unknown Business",
                address: place.formattedAddress || "No address provided",
                city: city, // Passing through the queried city as a fallback
                website: place.websiteUri || "",
                phone: place.nationalPhoneNumber || "",
                niche: niche,
            };
        });

        return { data: cleanData };

    } catch (error: any) {
        console.error("Failed to search places:", error);
        return { error: error.message || 'An unexpected error occurred.' };
    }
}
