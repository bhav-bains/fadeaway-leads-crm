import * as cheerio from 'cheerio';

// ============================================================
// ENRICHMENT DATA INTERFACE (Phase 1 - Extraction Only)
// ============================================================

export interface EnrichmentData {
    contacts: {
        emails: { email: string; source: 'mailto' | 'regex'; type: 'personal' | 'generic' }[];
        hasContactForm: boolean;
        hasPhone: boolean;
    };
    seo: {
        h1Tags: { count: number; texts: string[] };
        titleTag: { text: string; isEmpty: boolean };
        metaDescription: { exists: boolean; content: string };
        hasViewport: boolean;
        hasNoIndex: boolean;
        hasSchemaMarkup: boolean;
    };
    pixels: {
        hasMetaPixel: boolean;
        hasGoogleAds: boolean;
    };
    expansionKeywords: string[];
    ctas: {
        hasGeneralCTA: boolean;
        bookingUrls: { platform: string; url: string }[];
    };
    socials: {
        instagram: { url: string; handle: string } | null;
        facebook: { url: string } | null;
        tiktok: { url: string } | null;
    };
    uxDecay: {
        copyrightYear: number | null;
        isOutdatedCopyright: boolean;
        usesCheapBuilder: boolean;
    };
}

// ============================================================
// SCORE BREAKDOWN (100-Point Engine)
// ============================================================

export interface ScoreBreakdown {
    total: number;
    uxDecayTechnical: number;   // Category 1: max 45 pts
    cashFlowMaturity: number;   // Category 2: max 30 pts
    contactability: number;     // Category 3: max 25 pts
    rulesTriggered: string[];   // Which rules fired (for UI display)
}

// ============================================================
// SCRAPE RESULT
// ============================================================

export interface ScrapeResult {
    url: string;
    // New 100-point scoring
    scoreBreakdown: ScoreBreakdown;
    // Legacy field mappings (for backward compat with scores table / enrichment-worker)
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
    enrichment: EnrichmentData;
}

// ============================================================
// CONSTANTS
// ============================================================

const GENERIC_EMAIL_PREFIXES = ['info', 'contact', 'support', 'hello', 'admin', 'sales', 'office', 'help'];

const EXPANSION_KEYWORDS = ['careers', 'locations', 'service area', 'commercial', 'corporate', 'team', 'coaches', 'programs', 'events', 'retreats'];

const CTA_KEYWORDS = ['book', 'call', 'schedule', 'quote', 'buy'];

const BOOKING_PLATFORMS: Record<string, string> = {
    'calendly.com': 'Calendly',
    'acuityscheduling.com': 'Acuity',
    'simplybook.me': 'SimplyBook',
    'square.site': 'Square',
    'mindbodyonline.com': 'Mindbody',
    'janeapp.com': 'Jane',
    'vagaro.com': 'Vagaro',
    'glofox.com': 'Glofox',
    'pike13.com': 'Pike13',
};

const CHEAP_BUILDERS = ['weebly.com', 'mysite.com', 'wixsite.com', 'godaddy.com/websites', 'yolasite.com', 'homestead.com', 'squarespace.com'];

// ============================================================
// HELPER: Safe fetch with timeout
// ============================================================

async function safeFetch(targetUrl: string): Promise<string> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const response = await fetch(targetUrl, {
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        });
        clearTimeout(timeoutId);
        if (response.ok) return await response.text();
    } catch (e) {
        console.error(`Failed to fetch ${targetUrl}:`, e);
    }
    return '';
}

// ============================================================
// EXTRACTION FUNCTIONS
// ============================================================

function extractContacts($: cheerio.CheerioAPI, rawHtml: string): EnrichmentData['contacts'] {
    const emailRegex = /[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+/gi;
    const seenEmails = new Set<string>();
    const emails: EnrichmentData['contacts']['emails'] = [];

    // 1. Extract mailto: hrefs
    $('a[href^="mailto:"]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const email = href.replace('mailto:', '').split('?')[0].toLowerCase().trim();
        if (email && !seenEmails.has(email)) {
            seenEmails.add(email);
            const prefix = email.split('@')[0];
            emails.push({
                email,
                source: 'mailto',
                type: GENERIC_EMAIL_PREFIXES.includes(prefix) ? 'generic' : 'personal',
            });
        }
    });

    // 2. Regex scan on body text
    let match;
    while ((match = emailRegex.exec(rawHtml)) !== null) {
        const email = match[0].toLowerCase();
        // Filter out image filenames and tracking domains
        if (email.endsWith('.png') || email.endsWith('.jpg') || email.endsWith('.webp') ||
            email.endsWith('.svg') || email.endsWith('.gif') || email.includes('sentry.io') ||
            email.includes('example.com')) continue;
        if (!seenEmails.has(email)) {
            seenEmails.add(email);
            const prefix = email.split('@')[0];
            emails.push({
                email,
                source: 'regex',
                type: GENERIC_EMAIL_PREFIXES.includes(prefix) ? 'generic' : 'personal',
            });
        }
    }

    // 3. Contact Form
    const hasContactForm = $('form').length > 0;

    // 4. Phone (tel: links)
    const hasPhone = $('a[href^="tel:"]').length > 0;

    return { emails, hasContactForm, hasPhone };
}

function extractSeo($: cheerio.CheerioAPI): EnrichmentData['seo'] {
    // H1 Tags
    const h1Texts: string[] = [];
    $('h1').each((_, el) => {
        const text = $(el).text().trim();
        if (text) h1Texts.push(text);
    });

    // Title Tag
    const titleText = $('title').text().trim();

    // Meta Description
    const metaDescTag = $('meta[name="description"]');
    const metaDescContent = metaDescTag.attr('content')?.trim() || '';

    // Viewport
    const hasViewport = $('meta[name="viewport"]').length > 0;

    // NoIndex ("Fatal Flaw")
    const hasNoIndex = $('meta[name="robots"][content*="noindex"]').length > 0;

    // Schema Markup
    const hasSchemaMarkup = $('script[type="application/ld+json"]').length > 0;

    return {
        h1Tags: { count: h1Texts.length, texts: h1Texts },
        titleTag: { text: titleText, isEmpty: titleText.length === 0 },
        metaDescription: { exists: metaDescTag.length > 0, content: metaDescContent },
        hasViewport,
        hasNoIndex,
        hasSchemaMarkup,
    };
}

function extractPixels($: cheerio.CheerioAPI, rawHtml: string): EnrichmentData['pixels'] {
    const htmlLower = rawHtml.toLowerCase();

    const hasMetaPixel = htmlLower.includes('connect.facebook.net') || htmlLower.includes('fbq(');
    const hasGoogleAds = htmlLower.includes('googletagmanager.com') || htmlLower.includes('gtag(');

    return { hasMetaPixel, hasGoogleAds };
}

function extractExpansionKeywords($: cheerio.CheerioAPI): string[] {
    const found: string[] = [];
    const navText = $('nav, header, [role="navigation"]').text().toLowerCase();
    const allLinkText: string[] = [];

    $('a').each((_, el) => {
        const text = $(el).text().toLowerCase().trim();
        const href = ($(el).attr('href') || '').toLowerCase();
        allLinkText.push(text);
        allLinkText.push(href);
    });

    const combined = navText + ' ' + allLinkText.join(' ');

    for (const keyword of EXPANSION_KEYWORDS) {
        if (combined.includes(keyword.toLowerCase())) {
            found.push(keyword);
        }
    }

    return found;
}

function extractCtas($: cheerio.CheerioAPI): EnrichmentData['ctas'] {
    let hasGeneralCTA = false;
    const bookingUrls: { platform: string; url: string }[] = [];
    const seenBookingUrls = new Set<string>();

    // Collect all hrefs from <a> tags and src from <iframe> tags
    const allUrls: string[] = [];
    $('a[href]').each((_, el) => {
        allUrls.push(($(el).attr('href') || '').toLowerCase());
    });
    $('iframe[src]').each((_, el) => {
        allUrls.push(($(el).attr('src') || '').toLowerCase());
    });

    for (const url of allUrls) {
        // General CTA check
        if (!hasGeneralCTA) {
            for (const kw of CTA_KEYWORDS) {
                if (url.includes(kw)) {
                    hasGeneralCTA = true;
                    break;
                }
            }
        }

        // Booking platform check
        for (const [domain, platformName] of Object.entries(BOOKING_PLATFORMS)) {
            if (url.includes(domain) && !seenBookingUrls.has(domain)) {
                seenBookingUrls.add(domain);
                bookingUrls.push({ platform: platformName, url });
            }
        }
    }

    return { hasGeneralCTA, bookingUrls };
}

function extractSocials($: cheerio.CheerioAPI): EnrichmentData['socials'] {
    let instagram: { url: string; handle: string } | null = null;
    let facebook: { url: string } | null = null;
    let tiktok: { url: string } | null = null;

    $('a[href]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const hrefLower = href.toLowerCase();

        // Instagram
        if (!instagram && hrefLower.includes('instagram.com/')) {
            const handleMatch = href.match(/instagram\.com\/([a-zA-Z0-9._]+)/i);
            instagram = {
                url: href,
                handle: handleMatch ? handleMatch[1] : '',
            };
        }

        // Facebook
        if (!facebook && hrefLower.includes('facebook.com/')) {
            facebook = { url: href };
        }

        // TikTok
        if (!tiktok && hrefLower.includes('tiktok.com/')) {
            tiktok = { url: href };
        }
    });

    return { instagram, facebook, tiktok };
}

function extractUxDecay($: cheerio.CheerioAPI, rawHtml: string): EnrichmentData['uxDecay'] {
    // 1. Outdated Copyright
    const copyrightRegex = /(?:©|Copyright)\s*(?:[0-9]{4}-)?([0-9]{4})/i;
    // Prefer footer, fall back to body
    const footerText = $('footer').text();
    const searchText = footerText || rawHtml;
    const copyrightMatch = searchText.match(copyrightRegex);
    const copyrightYear = copyrightMatch ? parseInt(copyrightMatch[1], 10) : null;
    const isOutdatedCopyright = copyrightYear !== null && copyrightYear <= 2024;

    // 2. Cheap Web Builder
    const htmlLower = rawHtml.toLowerCase();
    const usesCheapBuilder = CHEAP_BUILDERS.some(b => htmlLower.includes(b));

    return { copyrightYear, isOutdatedCopyright, usesCheapBuilder };
}

// ============================================================
// SMART ROUTING: Find up to 2 contact/about sub-pages
// ============================================================

const ROUTE_HREF_REGEX = /(contact|about|team|connect|reach|touch|staff|profile|location)/i;
const ROUTE_ANCHOR_TEXTS = ['contact', 'get in touch', 'reach us', 'about us', 'our team', 'meet the team', 'staff', 'find us', 'locations'];

function findSubPageUrls($: cheerio.CheerioAPI, baseUrl: string): string[] {
    const candidates = new Set<string>();

    // Gather links from semantic sections first, fall back to body
    const sections = $('nav a, header a, footer a');
    const linksToScan = sections.length > 0 ? sections : $('body a');

    linksToScan.each((_, el) => {
        const href = $(el).attr('href') || '';
        const anchorText = $(el).text().toLowerCase().trim();

        if (!href || href === '#' || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return;

        const hrefMatch = ROUTE_HREF_REGEX.test(href);
        const textMatch = ROUTE_ANCHOR_TEXTS.some(t => anchorText.includes(t));

        if (hrefMatch || textMatch) {
            try {
                const resolvedUrl = new URL(href, baseUrl).toString();
                // Only follow same-origin links
                if (new URL(resolvedUrl).origin === new URL(baseUrl).origin) {
                    candidates.add(resolvedUrl);
                }
            } catch {
                // invalid URL
            }
        }
    });

    // Return max 2 unique URLs
    return Array.from(candidates).slice(0, 2);
}

// ============================================================
// LIGHT EXTRACTION (for sub-pages — contact/conversion data only)
// ============================================================

interface LightExtraction {
    emails: EnrichmentData['contacts']['emails'];
    hasContactForm: boolean;
    hasPhone: boolean;
    socials: EnrichmentData['socials'];
    ctas: EnrichmentData['ctas'];
}

function extractLight($: cheerio.CheerioAPI, rawHtml: string): LightExtraction {
    const contacts = extractContacts($, rawHtml);
    const socials = extractSocials($);
    const ctas = extractCtas($);

    return {
        emails: contacts.emails,
        hasContactForm: contacts.hasContactForm,
        hasPhone: contacts.hasPhone,
        socials,
        ctas,
    };
}

// ============================================================
// MERGE HELPERS
// ============================================================

function mergeEmails(
    base: EnrichmentData['contacts']['emails'],
    incoming: EnrichmentData['contacts']['emails']
): EnrichmentData['contacts']['emails'] {
    const seen = new Set(base.map(e => e.email));
    const merged = [...base];
    for (const e of incoming) {
        if (!seen.has(e.email)) {
            seen.add(e.email);
            merged.push(e);
        }
    }
    return merged;
}

function mergeSocials(
    base: EnrichmentData['socials'],
    incoming: EnrichmentData['socials']
): EnrichmentData['socials'] {
    return {
        instagram: base.instagram || incoming.instagram,
        facebook: base.facebook || incoming.facebook,
        tiktok: base.tiktok || incoming.tiktok,
    };
}

function mergeCtas(
    base: EnrichmentData['ctas'],
    incoming: EnrichmentData['ctas']
): EnrichmentData['ctas'] {
    const seenPlatforms = new Set(base.bookingUrls.map(b => b.platform));
    const mergedBooking = [...base.bookingUrls];
    for (const b of incoming.bookingUrls) {
        if (!seenPlatforms.has(b.platform)) {
            seenPlatforms.add(b.platform);
            mergedBooking.push(b);
        }
    }
    return {
        hasGeneralCTA: base.hasGeneralCTA || incoming.hasGeneralCTA,
        bookingUrls: mergedBooking,
    };
}

// ============================================================
// MAIN SCRAPE FUNCTION
// ============================================================

export async function scrapeWebsite(
    url: string,
    city: string,
    niche: string,
    reviewCount: number = 0,
    reviewAvg: number = 0
): Promise<ScrapeResult> {
    // ============================
    // STEP 1: THE HOMEPAGE SWEEP
    // ============================
    const homepageHtml = await safeFetch(url);
    const homepage$ = cheerio.load(homepageHtml || '<html lang="en"><body></body></html>');

    // Full extraction on homepage
    let contacts = extractContacts(homepage$, homepageHtml);
    const seo = extractSeo(homepage$);
    const pixels = extractPixels(homepage$, homepageHtml);
    const expansionKeywords = extractExpansionKeywords(homepage$);
    let ctas = extractCtas(homepage$);
    let socials = extractSocials(homepage$);
    const uxDecay = extractUxDecay(homepage$, homepageHtml);

    // ============================
    // STEP 2: SMART ROUTING
    // ============================
    const subPageUrls = findSubPageUrls(homepage$, url);

    // ============================
    // STEP 3: THE DEEP DIVE (contact/conversion data only)
    // ============================
    for (const subUrl of subPageUrls) {
        const subHtml = await safeFetch(subUrl);
        if (!subHtml) continue;
        const sub$ = cheerio.load(subHtml);
        const light = extractLight(sub$, subHtml);

        // ============================
        // STEP 4: MERGE & DEDUPLICATE
        // ============================
        contacts = {
            emails: mergeEmails(contacts.emails, light.emails),
            hasContactForm: contacts.hasContactForm || light.hasContactForm,
            hasPhone: contacts.hasPhone || light.hasPhone,
        };
        socials = mergeSocials(socials, light.socials);
        ctas = mergeCtas(ctas, light.ctas);
    }

    // ============================
    // BUILD FINAL ENRICHMENT DATA
    // ============================
    const enrichment: EnrichmentData = {
        contacts,
        seo,
        pixels,
        expansionKeywords,
        ctas,
        socials,
        uxDecay,
    };

    // ============================
    // 100-POINT SCORING ENGINE
    // ============================
    const scoreBreakdown = calculateLeadScore(enrichment, { url, reviewCount, reviewAvg });

    // Legacy field mappings (for scores table: score_overall, score_contactability, score_seo, score_local_intent, score_fit)
    const has_booking_link = ctas.hasGeneralCTA || ctas.bookingUrls.length > 0;

    // Legacy socials array
    const legacySocials: { platform: string; url: string }[] = [];
    if (socials.instagram) legacySocials.push({ platform: 'instagram', url: socials.instagram.url });
    if (socials.facebook) legacySocials.push({ platform: 'facebook', url: socials.facebook.url });
    if (socials.tiktok) legacySocials.push({ platform: 'tiktok', url: socials.tiktok.url });

    // Legacy emails array
    const legacyEmails = contacts.emails.map(e => ({ email: e.email, type: e.type }));

    // Biggest weakness (derived from highest-weight triggered rule)
    let biggestWeakness = 'Solid Digital Presence';
    if (scoreBreakdown.rulesTriggered.length > 0) {
        biggestWeakness = `🔴 ${scoreBreakdown.rulesTriggered[0]}`;
    }

    return {
        url,
        scoreBreakdown,
        // Map new categories to legacy score columns
        contactabilityScore: scoreBreakdown.contactability,
        seoScore: scoreBreakdown.uxDecayTechnical,
        localIntentScore: scoreBreakdown.cashFlowMaturity,
        fitScore: 0,
        totalScore: scoreBreakdown.total,
        emails: legacyEmails,
        socials: legacySocials,
        seoAudit: {
            has_title: !seo.titleTag.isEmpty,
            title_len: seo.titleTag.text.length,
            has_h1: seo.h1Tags.count > 0,
            has_booking_link,
            has_schema: seo.hasSchemaMarkup,
        },
        biggestWeakness,
        enrichment,
    };
}

// ============================================================
// 100-POINT SCORING ENGINE
// ============================================================

const GENERIC_PREFIXES = ['info', 'contact', 'admin', 'hello', 'support', 'sales', 'office'];

interface GoogleData {
    url: string;
    reviewCount: number;
    reviewAvg: number;
}

export function calculateLeadScore(data: EnrichmentData, google: GoogleData): ScoreBreakdown {
    let total_score = 0;
    const rulesTriggered: string[] = [];

    // ============================
    // CATEGORY 1: UX Decay & Technical Failure (Max 45)
    // ============================
    let uxDecayTechnical = 0;

    // Rule 1: Outdated or Amateur UI (+10)
    if (data.uxDecay.isOutdatedCopyright || data.uxDecay.usesCheapBuilder) {
        uxDecayTechnical += 10;
        rulesTriggered.push(data.uxDecay.usesCheapBuilder ? 'Cheap Web Builder Detected' : 'Outdated Copyright');
    }

    // Rule 2: Ghost Town / High Friction (+10)
    const isTotallyIsolated = data.contacts.emails.length === 0 && !data.contacts.hasPhone && !data.contacts.hasContactForm;
    if (isTotallyIsolated || !data.ctas.hasGeneralCTA) {
        uxDecayTechnical += 10;
        rulesTriggered.push(isTotallyIsolated ? 'Ghost Town (No Contact Methods)' : 'No CTA Keywords');
    }

    // Rule 3: Fatal Search Flaw (+10)
    const isHttpNotSecure = google.url.startsWith('http://') && !google.url.startsWith('https://');
    if (isHttpNotSecure || data.seo.hasNoIndex) {
        uxDecayTechnical += 10;
        rulesTriggered.push(data.seo.hasNoIndex ? 'NoIndex Detected (Fatal)' : 'HTTP Not Secure');
    }

    // Rule 4: Mobile Bounce (+10)
    if (!data.seo.hasViewport) {
        uxDecayTechnical += 10;
        rulesTriggered.push('No Mobile Viewport');
    }

    // Rule 5: Structural SEO Failure (+5)
    if (data.seo.h1Tags.count === 0 || data.seo.h1Tags.count > 1 || data.seo.titleTag.isEmpty) {
        uxDecayTechnical += 5;
        rulesTriggered.push(data.seo.titleTag.isEmpty ? 'Empty Title Tag' : `H1 Count: ${data.seo.h1Tags.count}`);
    }

    uxDecayTechnical = Math.min(uxDecayTechnical, 45);
    total_score += uxDecayTechnical;

    // ============================
    // CATEGORY 2: Cash Flow & Maturity (Max 30)
    // ============================
    let cashFlowMaturity = 0;

    // Rule 6: Active Ad Spender (+15)
    if (data.pixels.hasMetaPixel || data.pixels.hasGoogleAds) {
        cashFlowMaturity += 15;
        rulesTriggered.push('Active Ad Spender');
    }

    // Rule 7: High Customer Volume (+10)
    if (google.reviewCount >= 40) {
        cashFlowMaturity += 10;
        rulesTriggered.push(`High Review Volume (${google.reviewCount})`);
    }

    // Rule 8: Expansion & Payroll (+5)
    if (data.expansionKeywords.length > 0) {
        cashFlowMaturity += 5;
        rulesTriggered.push(`Expansion Keywords: ${data.expansionKeywords.join(', ')}`);
    }

    cashFlowMaturity = Math.min(cashFlowMaturity, 30);
    total_score += cashFlowMaturity;

    // ============================
    // CATEGORY 3: Contactability (Max 25)
    // ============================
    let contactability = 0;

    // Rule 9: Direct Inbox Access (max 20, mutually exclusive tiers)
    const hasPersonalEmail = data.contacts.emails.some(
        e => !GENERIC_PREFIXES.some(prefix => e.email.toLowerCase().startsWith(prefix + '@'))
    );
    const hasAnyEmail = data.contacts.emails.length > 0;

    if (hasPersonalEmail) {
        contactability += 20;
        rulesTriggered.push('Personal Email Found');
    } else if (hasAnyEmail) {
        contactability += 10;
        rulesTriggered.push('Generic Email Only');
    }

    // Rule 10: Form Fallback (+5, stacks)
    if (data.contacts.hasContactForm) {
        contactability += 5;
        rulesTriggered.push('Contact Form Available');
    }

    contactability = Math.min(contactability, 25);
    total_score += contactability;

    return {
        total: Math.min(total_score, 100),
        uxDecayTechnical,
        cashFlowMaturity,
        contactability,
        rulesTriggered,
    };
}

