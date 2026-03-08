import { scrapeWebsite } from '@/lib/scraper';

export async function searchGooglePlaces(niche: string, city: string) {
    let cleanData: any[] = [];
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
        console.warn("No GOOGLE_PLACES_API_KEY found. Returning mock data.");
        cleanData = [
            { id: "1", name: `Apex ${niche} Solutions`, address: "123 Main St", city: city, website: "apexsolutions.com", phone: "(206) 555-0100", niche: niche, rating: 4.8, ratingCount: 45 },
            { id: "2", name: `${city} Climate Masters`, address: "456 Oak Rd", city: city, website: "climatemasters.com", phone: "(206) 555-0101", niche: niche, rating: 3.5, ratingCount: 12 },
            { id: "3", name: "Evergreen Experts", address: "789 Pine Ln", city: city, website: "evergreenexperts.com", phone: "(206) 555-0102", niche: niche, rating: 4.9, ratingCount: 120 },
            { id: "4", name: "Pacific Northwest Pros", address: "101 Maple Dr", city: city, website: "pnwpros.com", phone: "(206) 555-0103", niche: niche, rating: 4.2, ratingCount: 8 },
        ];
    } else {
        try {
            const query = `${niche} in ${city}`;
            const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': apiKey,
                    'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount',
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

            cleanData = data.places.map((place: any) => {
                return {
                    id: place.id,
                    name: place.displayName?.text || "Unknown Business",
                    address: place.formattedAddress || "No address provided",
                    city: city,
                    website: place.websiteUri || "",
                    phone: place.nationalPhoneNumber || "",
                    niche: niche,
                    rating: place.rating || 0,
                    ratingCount: place.userRatingCount || 0
                };
            });
        } catch (error: any) {
            console.error("Failed to search places:", error);
            return { error: error.message || 'An unexpected error occurred.' };
        }
    }

    // 20-Point Scraper Phase 6 Upgrade
    // Run scraping on all results in parallel.
    const enrichedPromises = cleanData.map(async (lead: any) => {
        let urlToScrape = lead.website;
        if (urlToScrape && !urlToScrape.startsWith('http')) {
            urlToScrape = `https://${urlToScrape}`;
        }

        if (!urlToScrape) {
            return { ...lead, score: 0, email: '', biggestWeakness: '🔴 No Website Found', bookingDetected: false }
        }
        try {
            const scrape = await scrapeWebsite(urlToScrape, city, niche, lead.ratingCount);
            return {
                ...lead,
                score: scrape.totalScore,
                email: scrape.emails[0]?.email || '',
                biggestWeakness: scrape.biggestWeakness,
                bookingDetected: scrape.seoAudit.has_booking_link
            }
        } catch (e) {
            return { ...lead, score: 0, email: '', biggestWeakness: '🔴 Failed to scrape website', bookingDetected: false }
        }
    });

    const enrichedData = await Promise.all(enrichedPromises);
    return { data: enrichedData };
}
