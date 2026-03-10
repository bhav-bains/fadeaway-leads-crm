import * as cheerio from 'cheerio';

export interface ScrapeResult {
    url: string;
    contactabilityScore: number;
    seoScore: number;
    localIntentScore: number;
    fitScore: number;
    totalScore: number;
    emails: { email: string; type: 'personal' | 'generic' }[];
    socials: { platform: string; url: string }[];
    seoAudit: {
        has_title: boolean;
        title_len: number;
        has_h1: boolean;
        has_booking_link: boolean;
        has_schema: boolean;
    };
    biggestWeakness: string;
}

const GENERIC_PREFIXES = ['info', 'contact', 'support', 'hello', 'admin', 'sales', 'office', 'help'];

export async function scrapeWebsite(url: string, city: string, niche: string, reviewCount: number = 0, reviewAvg: number = 0): Promise<ScrapeResult> {
    let html = '';
    let contactHtml = '';

    // Helper to safely fetch with timeout
    const safeFetch = async (targetUrl: string) => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            const response = await fetch(targetUrl, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
            clearTimeout(timeoutId);
            if (response.ok) return await response.text();
        } catch (e) {
            console.error(`Failed to fetch ${targetUrl}:`, e);
        }
        return '';
    };

    // 1. Fetch Homepage
    html = await safeFetch(url);
    const $ = cheerio.load(html || '<html lang="en"><body></body></html>');

    // 2. Look for Contact Page
    let contactHref = '';
    $('a').each((_, el) => {
        const h = $(el).attr('href');
        if (h && (h.toLowerCase().includes('contact') || h.toLowerCase().includes('kontak') || h.toLowerCase().includes('impressum'))) {
            if (!contactHref) contactHref = h; // grab the first one
        }
    });

    // 3. Fetch Contact Page if found
    if (contactHref) {
        try {
            const contactUrl = new URL(contactHref, url).toString();
            contactHtml = await safeFetch(contactUrl);
        } catch (e) {
            // invalid URL construct
        }
    }

    // Combine text and HTML for analysis
    const combinedHtml = html + ' ' + contactHtml;
    const combined$ = cheerio.load(combinedHtml || '<html lang="en"><body></body></html>');
    const textContent = combined$('body').text().toLowerCase();

    // ==========================================
    // 1. CONTACTABILITY (0 - 6 pts)
    // ==========================================
    let contactabilityScore = 0;

    // Extract emails
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
    const foundEmails = new Set<string>();
    const emails: { email: string; type: 'personal' | 'generic' }[] = [];

    let match;
    while ((match = emailRegex.exec(html)) !== null) {
        const e = match[1].toLowerCase();
        // basic filter to prevent grabbing image names like logo@2x.png
        if (e.endsWith('.png') || e.endsWith('.jpg') || e.endsWith('.webp') || e.endsWith('.svg') || e.endsWith('sentry.io')) continue;
        foundEmails.add(e);
    }

    let hasPersonal = false;
    const hasEmail = foundEmails.size > 0;

    foundEmails.forEach(email => {
        const prefix = email.split('@')[0];
        if (GENERIC_PREFIXES.includes(prefix)) {
            emails.push({ email, type: 'generic' });
        } else {
            hasPersonal = true;
            emails.push({ email, type: 'personal' });
        }
    });

    if (hasPersonal) {
        contactabilityScore += 3; // +3 Points: If a personal-looking email is found
    }

    if (hasEmail) {
        contactabilityScore += 2; // +2 Points: If ANY email is found.
    }

    // Has Contact Form
    const hasForm = combined$('form').length > 0 || combined$('a[href*="contact"]').length > 0;
    if (hasForm && !hasEmail) {
        contactabilityScore += 1; // +1 Point: If only a contact form is present (no email found).
    }

    // ==========================================
    // 2. THE SEO GAP (0 - 7 pts)
    // ==========================================
    let seoScore = 0;

    // Has Booking Link
    const has_booking_link = combined$('a[href*="calendly"], a[href*="acuity"], a[href*="book"], a[href*="schedule"], a[href*="pricing"]').length > 0;
    if (!has_booking_link) {
        seoScore += 3; // +3 Points: If a booking or pricing link is NOT detected.
    }

    // Has H1 and Title Check
    const has_h1 = combined$('h1').length > 0;
    const title = combined$('title').text() || '';
    const has_title = title.trim().length > 5; // consider < 5 chars poor

    if (!has_h1 || !has_title) {
        seoScore += 2; // +2 Points: missing basics (no <h1> tag OR a poor/empty <title> tag)
    }

    // Has Schema.org / JSON-LD
    let has_schema = false;
    combined$('script[type="application/ld+json"]').each((_, el) => {
        try {
            const jsonText = combined$(el).html();
            if (jsonText && (jsonText.includes('Organization') || jsonText.includes('LocalBusiness'))) {
                has_schema = true;
            }
        } catch (e) { }
    });

    if (!has_schema) {
        seoScore += 1; // +1 Point: missing schema.org tags for Organization or Local Business.
    }

    // Under 20 reviews
    if (reviewCount > 0 && reviewCount < 20) {
        seoScore += 1; // +1 Point: Google rating_count is less than 20.
    }

    // ==========================================
    // 3. LOCAL INTENT (0 - 4 pts)
    // ==========================================
    let localIntentScore = 0;

    if (niche && textContent.includes(niche.toLowerCase())) {
        localIntentScore += 2; // +2 Points: scraper detected exact intent keywords
    }

    if (city && textContent.includes(city.toLowerCase())) {
        localIntentScore += 1; // +1 Point: specific city name is present on homepage
    }

    if (reviewCount > 0 && reviewAvg < 4.5) {
        localIntentScore += 1; // +1 Point: business profile exists but rating < 4.5
    }

    // ==========================================
    // 4. BUSINESS FIT (0 - 3 pts)
    // ==========================================
    let fitScore = 0;

    if (reviewCount >= 30) {
        fitScore += 2; // +2 Points: Google rating_count is greater than or equal to 30.
    }

    // Multiple programs / services
    const serviceKeywords = ['services', 'programs', 'classes', 'camps', 'private', 'group'];
    let servicesFound = 0;
    serviceKeywords.forEach(kw => {
        if (textContent.includes(kw)) servicesFound++;
    });

    if (servicesFound > 1) {
        fitScore += 1; // +1 Point: multiple programs or services are detected
    }

    // SOCIALS
    const socials: { platform: string; url: string }[] = [];
    combined$('a[href]').each((_, el) => {
        const href = $(el).attr('href') || '';
        if (href.includes('instagram.com') && !socials.find(s => s.platform === 'instagram')) socials.push({ platform: 'instagram', url: href });
        if (href.includes('facebook.com') && !socials.find(s => s.platform === 'facebook')) socials.push({ platform: 'facebook', url: href });
        if (href.includes('twitter.com') || href.includes('x.com')) {
            if (!socials.find(s => s.platform === 'x')) socials.push({ platform: 'x', url: href });
        }
        if (href.includes('tiktok.com') && !socials.find(s => s.platform === 'tiktok')) socials.push({ platform: 'tiktok', url: href });
        if (href.includes('youtube.com') && !socials.find(s => s.platform === 'youtube')) socials.push({ platform: 'youtube', url: href });
    });

    // Calculate Biggest Weakness for the UI
    let biggestWeakness = "Solid Digital Presence";
    if (!has_booking_link) {
        biggestWeakness = "🔴 No Booking Link";
    } else if (!has_h1) {
        biggestWeakness = "🔴 Missing H1 Tag";
    } else if (!has_schema) {
        biggestWeakness = "🔴 Lacking SEO Schema";
    } else if (!has_title || title.length < 10) {
        biggestWeakness = "🔴 Poor Title Tag";
    } else if (reviewCount > 0 && reviewCount < 10) {
        biggestWeakness = "🔴 Low Review Count";
    }

    return {
        url,
        contactabilityScore: Math.min(contactabilityScore, 6),
        seoScore: Math.min(seoScore, 7),
        localIntentScore: Math.min(localIntentScore, 4),
        fitScore: Math.min(fitScore, 3),
        totalScore: Math.min(contactabilityScore, 6) + Math.min(seoScore, 7) + Math.min(localIntentScore, 4) + Math.min(fitScore, 3),
        emails,
        socials,
        seoAudit: {
            has_title,
            title_len: title.length,
            has_h1,
            has_booking_link,
            has_schema
        },
        biggestWeakness
    };
}
