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
        hasOgImage: boolean;
        hasViewport: boolean;
        hasNoIndex: boolean;
        hasSchemaMarkup: boolean;
        revenuePagesCount: number;
        isSinglePage: boolean;
    };
    pixels: {
        hasMetaPixel: boolean;
        hasGoogleAds: boolean;
    };
    expansionKeywords: string[];
    ctas: {
        hasGeneralCTA: boolean;
        hasReviewWidget: boolean;
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
    rulesTriggered: string[];   // Legacy: Full list
    // New categorized rules
    uxRules?: string[];
    maturityRules?: string[];
    contactRules?: string[];
}

// ============================================================
// SCRAPE RESULT
// ============================================================

export interface ScrapeResult {
    url: string;
    scoreBreakdown: ScoreBreakdown;
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
        h1_count: number;
        has_meta_description: boolean;
        has_og_image: boolean;
        uses_cheap_builder: boolean;
        revenue_pages_count: number;
        is_single_page: boolean;
        has_cta_keywords: boolean;
        has_review_widget: boolean;
        has_meta_pixel: boolean;
        has_google_ads_tag: boolean;
        has_expansion_keywords: boolean;
        has_contact_form: boolean;
        pagespeed_mobile?: number | null;
        pagespeed_desktop?: number | null;
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

    let match;
    while ((match = emailRegex.exec(rawHtml)) !== null) {
        const email = match[0].toLowerCase();
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

    const hasContactForm = $('form').length > 0;
    const hasPhone = $('a[href^="tel:"]').length > 0;

    return { emails, hasContactForm, hasPhone };
}

function extractSeo($: cheerio.CheerioAPI): EnrichmentData['seo'] {
    const h1Texts: string[] = [];
    $('h1').each((_, el) => {
        const text = $(el).text().trim();
        if (text) h1Texts.push(text);
    });

    const titleText = $('title').text().trim();
    const metaDescTag = $('meta[name="description"]');
    const metaDescContent = metaDescTag.attr('content')?.trim() || '';
    const hasViewport = $('meta[name="viewport"]').length > 0;
    const hasNoIndex = $('meta[name="robots"][content*="noindex"]').length > 0;
    const hasSchemaMarkup = $('script[type="application/ld+json"]').length > 0;
    const hasOgImage = $('meta[property="og:image"]').length > 0;

    let revenuePagesCount = 0;
    const revWords = ['/service', '/treatment', '/class', '/product', '/pricing'];
    let isSinglePage = false;
    const navLinks = $('nav a, header a');
    if (navLinks.length > 0) {
        isSinglePage = true;
        navLinks.each((_, el) => {
            const href = $(el).attr('href') || '';
            if (href && !href.startsWith('#')) isSinglePage = false;
        });
    }

    $('a').each((_, el) => {
        const href = ($(el).attr('href') || '').toLowerCase();
        if (revWords.some(w => href.includes(w))) {
            revenuePagesCount++;
        }
    });

    return {
        h1Tags: { count: h1Texts.length, texts: h1Texts },
        titleTag: { text: titleText, isEmpty: titleText.length === 0 },
        metaDescription: { exists: metaDescTag.length > 0, content: metaDescContent },
        hasViewport,
        hasNoIndex,
        hasSchemaMarkup,
        hasOgImage,
        revenuePagesCount,
        isSinglePage
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
    let hasReviewWidget = false;
    const bookingUrls: { platform: string; url: string }[] = [];
    const seenBookingUrls = new Set<string>();

    const htmlLower = $.html().toLowerCase();
    if (htmlLower.includes('elfsight') || htmlLower.includes('trustpilot') || htmlLower.includes('google reviews') || htmlLower.includes('birdeye')) {
        hasReviewWidget = true;
    }

    const allUrls: string[] = [];
    $('a[href]').each((_, el) => {
        allUrls.push(($(el).attr('href') || '').toLowerCase());
    });
    $('iframe[src]').each((_, el) => {
        allUrls.push(($(el).attr('src') || '').toLowerCase());
    });

    for (const url of allUrls) {
        if (!hasGeneralCTA) {
            for (const kw of CTA_KEYWORDS) {
                if (url.includes(kw)) {
                    hasGeneralCTA = true;
                    break;
                }
            }
        }

        for (const [domain, platformName] of Object.entries(BOOKING_PLATFORMS)) {
            if (url.includes(domain) && !seenBookingUrls.has(domain)) {
                seenBookingUrls.add(domain);
                bookingUrls.push({ platform: platformName, url });
            }
        }
    }

    return { hasGeneralCTA, hasReviewWidget, bookingUrls };
}

function extractSocials($: cheerio.CheerioAPI): EnrichmentData['socials'] {
    let instagram: { url: string; handle: string } | null = null;
    let facebook: { url: string } | null = null;
    let tiktok: { url: string } | null = null;

    $('a[href]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const hrefLower = href.toLowerCase();

        if (!instagram && hrefLower.includes('instagram.com/')) {
            const handleMatch = href.match(/instagram\.com\/([a-zA-Z0-9._]+)/i);
            instagram = { url: href, handle: handleMatch ? handleMatch[1] : '' };
        }
        if (!facebook && hrefLower.includes('facebook.com/')) {
            facebook = { url: href };
        }
        if (!tiktok && hrefLower.includes('tiktok.com/')) {
            tiktok = { url: href };
        }
    });

    return { instagram, facebook, tiktok };
}

function extractUxDecay($: cheerio.CheerioAPI, rawHtml: string): EnrichmentData['uxDecay'] {
    const copyrightRegex = /(?:©|Copyright)\s*(?:[0-9]{4}-)?([0-9]{4})/i;
    const footerText = $('footer').text();
    const searchText = footerText || rawHtml;
    const copyrightMatch = searchText.match(copyrightRegex);
    const copyrightYear = copyrightMatch ? parseInt(copyrightMatch[1], 10) : null;
    const isOutdatedCopyright = copyrightYear !== null && copyrightYear <= 2024;

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
                if (new URL(resolvedUrl).origin === new URL(baseUrl).origin) {
                    candidates.add(resolvedUrl);
                }
            } catch {}
        }
    });

    return Array.from(candidates).slice(0, 2);
}

// ============================================================
// LIGHT EXTRACTION (for sub-pages)
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

function mergeEmails(base: EnrichmentData['contacts']['emails'], incoming: EnrichmentData['contacts']['emails']): EnrichmentData['contacts']['emails'] {
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

function mergeSocials(base: EnrichmentData['socials'], incoming: EnrichmentData['socials']): EnrichmentData['socials'] {
    return {
        instagram: base.instagram || incoming.instagram,
        facebook: base.facebook || incoming.facebook,
        tiktok: base.tiktok || incoming.tiktok,
    };
}

function mergeCtas(base: EnrichmentData['ctas'], incoming: EnrichmentData['ctas']): EnrichmentData['ctas'] {
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
        hasReviewWidget: base.hasReviewWidget || incoming.hasReviewWidget,
        bookingUrls: mergedBooking,
    };
}

// ============================================================
// 100-POINT SCORING ENGINE
// ============================================================

interface GoogleData {
    url: string;
    reviewCount: number;
    reviewAvg: number;
    mobilePerformance?: number | null;
    desktopPerformance?: number | null;
}

export function calculateLeadScore(data: EnrichmentData, google: GoogleData): ScoreBreakdown {
    let total_score = 0;
    const rulesTriggered: string[] = [];
    const uxRules: string[] = [];
    const maturityRules: string[] = [];
    const contactRules: string[] = [];

    // ============================
    // CATEGORY 1: UX Decay & Technical Failure (Max 45)
    // ============================
    let uxDecayTechnical = 0;

    const mobileScore = google.mobilePerformance ?? 100;
    const desktopScore = google.desktopPerformance ?? 100;
    if (mobileScore < 60 || desktopScore < 60) {
        uxDecayTechnical += 15;
        const msg = mobileScore < 60 ? `Mobile Speed Tool: ${mobileScore}/100 (+15)` : `Desktop Speed Tool: ${desktopScore}/100 (+15)`;
        rulesTriggered.push(msg);
        uxRules.push(msg);
    }

    let seoPenalty = 0;
    if (data.seo.h1Tags.count === 0 || data.seo.h1Tags.count > 1) {
        seoPenalty += 5;
        const msg = `H1 Count Error: ${data.seo.h1Tags.count} (+5)`;
        rulesTriggered.push(msg);
        uxRules.push(msg);
    }
    if (!data.seo.metaDescription.exists || data.seo.titleTag.isEmpty) {
        seoPenalty += 5;
        const msg = data.seo.titleTag.isEmpty ? 'Missing Meta Title (+5)' : 'Missing Meta Description (+5)';
        rulesTriggered.push(msg);
        uxRules.push(msg);
    }
    uxDecayTechnical += Math.min(seoPenalty, 10);

    let structuralPenalty = 0;
    if (!data.seo.hasSchemaMarkup) {
        structuralPenalty += 5;
        const msg = 'Missing Schema.org Markup (+5)';
        rulesTriggered.push(msg);
        uxRules.push(msg);
    }
    if (data.seo.revenuePagesCount <= 1 || data.seo.isSinglePage) {
        structuralPenalty += 5;
        const msg = data.seo.isSinglePage ? 'Single Page Site (+5)' : 'Thin Service Content (+5)';
        rulesTriggered.push(msg);
        uxRules.push(msg);
    }
    uxDecayTechnical += Math.min(structuralPenalty, 10);

    let conversionPenalty = 0;
    const hasBooking = data.ctas.bookingUrls.length > 0;
    if (!data.ctas.hasGeneralCTA || !hasBooking) {
        conversionPenalty += 5;
        const msg = !hasBooking ? 'No Online Booking (+5)' : 'No CTA Keywords (+5)';
        rulesTriggered.push(msg);
        uxRules.push(msg);
    }
    if (!data.ctas.hasReviewWidget || !data.seo.hasOgImage) {
        conversionPenalty += 5;
        const msg = !data.ctas.hasReviewWidget ? 'Missing Review Widget (+5)' : 'Missing OG Social Image (+5)';
        rulesTriggered.push(msg);
        uxRules.push(msg);
    }
    uxDecayTechnical += Math.min(conversionPenalty, 10);
    uxDecayTechnical = Math.min(uxDecayTechnical, 45);

    // ============================
    // CATEGORY 2: Cash Flow & Maturity (Max 30)
    // ============================
    let cashFlowMaturity = 0;

    if (data.pixels.hasMetaPixel || data.pixels.hasGoogleAds) {
        cashFlowMaturity += 15;
        const msg = data.pixels.hasMetaPixel ? 'Active Meta Ads (+15)' : 'Active Google Ads (+15)';
        rulesTriggered.push(msg);
        maturityRules.push(msg);
    }
    if (google.reviewCount >= 40) {
        cashFlowMaturity += 10;
        const msg = `Review Maturity (${google.reviewCount} reviews) (+10)`;
        rulesTriggered.push(msg);
        maturityRules.push(msg);
    }
    if (data.expansionKeywords.length > 0) {
        cashFlowMaturity += 5;
        const msg = 'Growth Mode (Hiring/Careers) (+5)';
        rulesTriggered.push(msg);
        maturityRules.push(msg);
    }
    cashFlowMaturity = Math.min(cashFlowMaturity, 30);

    // ============================
    // CATEGORY 3: Contact Access (Max 25)
    // ============================
    let contactability = 0;
    const personalEmails = data.contacts.emails.filter(e => e.type?.toLowerCase() === 'personal');
    const genericEmails = data.contacts.emails.filter(e => e.type?.toLowerCase() === 'generic');

    if (personalEmails.length > 0) {
        contactability += 20;
        const msg = 'Direct DM Access (+20)';
        rulesTriggered.push(msg);
        contactRules.push(msg);
    } else if (genericEmails.length > 0) {
        contactability += 10;
        const msg = 'Gatekeeper (Info/Contact) (+10)';
        rulesTriggered.push(msg);
        contactRules.push(msg);
    }

    const hasSocials = data.socials.instagram || data.socials.facebook || data.socials.tiktok;
    if (data.contacts.hasContactForm || hasSocials) {
        contactability += 5;
        const msg = data.contacts.hasContactForm ? 'Contact Form Detected (+5)' : 'Social Channels Found (+5)';
        rulesTriggered.push(msg);
        contactRules.push(msg);
    }
    contactability = Math.min(contactability, 25);

    total_score = uxDecayTechnical + cashFlowMaturity + contactability;

    return {
        total: total_score,
        uxDecayTechnical,
        cashFlowMaturity,
        contactability,
        rulesTriggered: rulesTriggered.slice(0, 5),
        uxRules,
        maturityRules,
        contactRules
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
    reviewAvg: number = 0,
    mobilePerformance?: number | null,
    desktopPerformance?: number | null
): Promise<ScrapeResult> {
    const homepageHtml = await safeFetch(url);
    const homepage$ = cheerio.load(homepageHtml || '<html lang="en"><body></body></html>');

    let contacts = extractContacts(homepage$, homepageHtml);
    const seo = extractSeo(homepage$);
    const pixels = extractPixels(homepage$, homepageHtml);
    const expansionKeywords = extractExpansionKeywords(homepage$);
    let ctas = extractCtas(homepage$);
    let socials = extractSocials(homepage$);
    const uxDecay = extractUxDecay(homepage$, homepageHtml);

    const subPageUrls = findSubPageUrls(homepage$, url);

    for (const subUrl of subPageUrls) {
        const subHtml = await safeFetch(subUrl);
        if (!subHtml) continue;
        const sub$ = cheerio.load(subHtml);
        const light = extractLight(sub$, subHtml);

        contacts = {
            emails: mergeEmails(contacts.emails, light.emails),
            hasContactForm: contacts.hasContactForm || light.hasContactForm,
            hasPhone: contacts.hasPhone || light.hasPhone,
        };
        socials = mergeSocials(socials, light.socials);
        ctas = mergeCtas(ctas, light.ctas);
    }

    const enrichment: EnrichmentData = { contacts, seo, pixels, expansionKeywords, ctas, socials, uxDecay };

    const scoreBreakdown = calculateLeadScore(enrichment, { 
        url, reviewCount, reviewAvg, mobilePerformance, desktopPerformance 
    });

    const has_booking_link = ctas.hasGeneralCTA || ctas.bookingUrls.length > 0;
    const legacySocials: { platform: string; url: string }[] = [];
    if (socials.instagram) legacySocials.push({ platform: 'instagram', url: socials.instagram.url });
    if (socials.facebook) legacySocials.push({ platform: 'facebook', url: socials.facebook.url });
    if (socials.tiktok) legacySocials.push({ platform: 'tiktok', url: socials.tiktok.url });

    const legacyEmails = contacts.emails.map(e => ({ email: e.email, type: e.type }));
    let biggestWeakness = 'Solid Digital Presence';
    if (scoreBreakdown.rulesTriggered.length > 0) {
        biggestWeakness = `🔴 ${scoreBreakdown.rulesTriggered[0]}`;
    }

    return {
        url,
        scoreBreakdown,
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
            h1_count: seo.h1Tags.count,
            has_meta_description: seo.metaDescription.exists,
            has_og_image: seo.hasOgImage,
            uses_cheap_builder: uxDecay.usesCheapBuilder,
            revenue_pages_count: seo.revenuePagesCount,
            is_single_page: seo.isSinglePage,
            has_cta_keywords: ctas.hasGeneralCTA,
            has_review_widget: ctas.hasReviewWidget,
            has_meta_pixel: pixels.hasMetaPixel,
            has_google_ads_tag: pixels.hasGoogleAds,
            has_expansion_keywords: expansionKeywords.length > 0,
            has_contact_form: contacts.hasContactForm,
            pagespeed_mobile: mobilePerformance,
            pagespeed_desktop: desktopPerformance,
        },
        biggestWeakness,
        enrichment,
    };
}
