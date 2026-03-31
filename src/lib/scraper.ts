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

export interface ScoringRule {
    label: string;
    points: number;
    isTriggered: boolean;
}

export interface ScoreBreakdown {
    total: number;
    maxTotal: number;
    uxDecayTechnical: number;   // Category 1: max 45 pts (or 30 if no speed)
    uxMax: number;
    cashFlowMaturity: number;   // Category 2: max 30 pts
    maturityMax: number;
    contactability: number;     // Category 3: max 25 pts
    contactMax: number;
    rulesTriggered: string[];   // Legacy: Full list
    // New categorized rules
    uxRules?: ScoringRule[];
    maturityRules?: ScoringRule[];
    contactRules?: ScoringRule[];
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
    const uxRules: ScoringRule[] = [];
    const maturityRules: ScoringRule[] = [];
    const contactRules: ScoringRule[] = [];
    const rulesTriggered: string[] = [];

    // ============================
    // CATEGORY 1: UX Decay & Technical Failure (Max 45) - Instant (Cheerio Only)
    // ============================
    let uxDecayTechnical = 0; 
    const uxMax = 45;
    const maxTotal = 100;

    // 1. PageSpeed (Informational Only - Not in 100-pt total)
    const mobileScore = google.mobilePerformance ?? null;
    const hasSpeedData = mobileScore !== null;
    
    if (hasSpeedData) {
        let speedPenalty = 0;
        if (mobileScore <= 50) speedPenalty = 15;
        else if (mobileScore <= 80) speedPenalty = 10;
        else if (mobileScore <= 90) speedPenalty = 5;
        
        const speedMsg = `Mobile Speed: ${mobileScore}/100`;
        uxRules.push({ 
            label: speedMsg, 
            points: 0, // 0 points for the core total
            isTriggered: speedPenalty > 0 
        });
    } else {
        uxRules.push({ 
            label: "PageSpeed Insights (Fetching...)", 
            points: 0, 
            isTriggered: true 
        });
    }

    // 2. SEO Fundamentals (Max 15 Penalty)
    let seoPenalty = 0;
    
    // H1 (Penalty 10)
    const isH1Fail = data.seo.h1Tags.count === 0 || data.seo.h1Tags.count > 1;
    if (isH1Fail) seoPenalty += 10;
    uxRules.push({ 
        label: `H1 Tag Structure (${data.seo.h1Tags.count} found)`, 
        points: isH1Fail ? 10 : 0, 
        isTriggered: isH1Fail 
    });
    
    // Meta Description (Penalty 5)
    const isMetaFail = !data.seo.metaDescription.exists;
    if (isMetaFail) seoPenalty += 5;
    uxRules.push({ 
        label: isMetaFail ? 'Meta Description Missing' : 'Meta Description Found', 
        points: isMetaFail ? 5 : 0, 
        isTriggered: isMetaFail 
    });
    
    uxDecayTechnical += seoPenalty;

    // 3. Structural & AI Search (Max 15 Penalty)
    let structuralPenalty = 0;
    
    // Content Depth (Penalty 10)
    const isContentFail = data.seo.revenuePagesCount <= 1 || data.seo.isSinglePage;
    if (isContentFail) structuralPenalty += 10;
    uxRules.push({ 
        label: data.seo.isSinglePage ? 'Single Page Site Structure' : 'Thin Service Content', 
        points: isContentFail ? 10 : 0, 
        isTriggered: isContentFail 
    });
    
    // Schema (Penalty 5)
    const isSchemaFail = !data.seo.hasSchemaMarkup;
    if (isSchemaFail) structuralPenalty += 5;
    uxRules.push({ 
        label: 'Schema.org JSON-LD Markup', 
        points: isSchemaFail ? 5 : 0, 
        isTriggered: isSchemaFail 
    });
    
    uxDecayTechnical += structuralPenalty;

    // 4. Conversion Friction (Max 15 Penalty)
    let conversionPenalty = 0;
    
    // Booking & CTA Keywords (Penalty 10)
    const hasBooking = data.ctas.bookingUrls.length > 0;
    const isCtaFail = !data.ctas.hasGeneralCTA || !hasBooking;
    if (isCtaFail) conversionPenalty += 10;
    uxRules.push({ 
        label: 'CTA & Booking Friction', 
        points: isCtaFail ? 10 : 0, 
        isTriggered: isCtaFail 
    });
    
    // Trust Signals (Penalty 5)
    const isTrustFail = !data.ctas.hasReviewWidget || !data.seo.hasOgImage;
    if (isTrustFail) conversionPenalty += 5;
    uxRules.push({ 
        label: 'Review Widget & OG Image', 
        points: isTrustFail ? 5 : 0, 
        isTriggered: isTrustFail 
    });
    
    uxDecayTechnical += conversionPenalty;
    uxDecayTechnical = Math.min(uxDecayTechnical, uxMax);

    // ============================
    // CATEGORY 2: Cash Flow & Maturity (Max 30)
    // ============================
    let cashFlowMaturity = 0;

    // 1. Paid Traffic
    const hasAds = data.pixels.hasMetaPixel || data.pixels.hasGoogleAds;
    const adsPoints = hasAds ? 15 : 0;
    const adsMsg = data.pixels.hasMetaPixel ? 'Active Meta Ads Traffic' : 'Active Google Ads Traffic';
    maturityRules.push({ label: hasAds ? adsMsg : 'No Active Paid Ads Found', points: adsPoints, isTriggered: hasAds });
    if (hasAds) {
        cashFlowMaturity += adsPoints;
    }

    // 2. Review Maturity
    const isMature = google.reviewCount >= 40;
    const maturePoints = isMature ? 10 : 0;
    const matureMsg = `GMB Review Maturity (${google.reviewCount} reviews)`;
    maturityRules.push({ label: matureMsg, points: maturePoints, isTriggered: isMature });
    if (isMature) {
        cashFlowMaturity += maturePoints;
    }

    // 3. Growth Tracking
    const isGrowth = data.expansionKeywords.length > 0;
    const growthPoints = isGrowth ? 5 : 0;
    const growthMsg = 'Growth Mode (Hiring/Careers Page)';
    maturityRules.push({ label: growthMsg, points: growthPoints, isTriggered: isGrowth });
    if (isGrowth) {
        cashFlowMaturity += growthPoints;
    }

    cashFlowMaturity = Math.min(cashFlowMaturity, 30);

    // ============================
    // CATEGORY 3: Contact Access (Max 25)
    // ============================
    let contactability = 0;
    const personalEmails = data.contacts.emails.filter(e => e.type?.toLowerCase() === 'personal');
    const genericEmails = data.contacts.emails.filter(e => e.type?.toLowerCase() === 'generic');

    // 1. Email Tier
    if (personalEmails.length > 0) {
        contactability += 20;
        const msg = 'Direct Owner/Personal Email Access';
        contactRules.push({ label: msg, points: 20, isTriggered: true });
    } else if (genericEmails.length > 0) {
        contactability += 10;
        const msg = 'Generic Business Email (Gatekeeper)';
        contactRules.push({ label: msg, points: 10, isTriggered: true });
    } else {
        contactRules.push({ label: 'No Valid Email Contacts Found', points: 0, isTriggered: false });
    }

    // 2. Fallback Channels
    const hasSocials = data.socials.instagram || data.socials.facebook || data.socials.tiktok;
    const isContactForm = data.contacts.hasContactForm;
    if (isContactForm || hasSocials) {
        const points = 5;
        contactability += points;
        const msg = isContactForm ? 'Direct Web Inquiry Form' : 'Social Media Intake Channels';
        contactRules.push({ label: msg, points: 5, isTriggered: true });
    } else {
        contactRules.push({ label: 'Secondary Contact Channels Missing', points: 0, isTriggered: false });
    }

    contactability = Math.min(contactability, 25);

    const total_score = uxDecayTechnical + cashFlowMaturity + contactability;

    // Rules Triggered for Biggest Weakness (Prioritizing Category 1)
    uxRules.forEach(r => {
        if (r.isTriggered && r.points > 0) rulesTriggered.push(`${r.label}`);
    });
    maturityRules.forEach(r => {
        if (r.isTriggered && r.points > 0) rulesTriggered.push(`${r.label}`);
    });
    contactRules.forEach(r => {
        if (r.isTriggered && r.points > 0) rulesTriggered.push(`${r.label}`);
    });

    return {
        total: total_score,
        maxTotal,
        uxDecayTechnical,
        uxMax,
        cashFlowMaturity,
        maturityMax: 30,
        contactability,
        contactMax: 25,
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

    const subResults = await Promise.all(subPageUrls.map(async (subUrl) => {
        try {
            const subHtml = await safeFetch(subUrl);
            if (!subHtml) return null;
            const sub$ = cheerio.load(subHtml);
            return extractLight(sub$, subHtml);
        } catch (e) {
            console.error(`Error scraping sub-page ${subUrl}:`, e);
            return null;
        }
    }));

    for (const light of subResults) {
        if (!light) continue;
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
