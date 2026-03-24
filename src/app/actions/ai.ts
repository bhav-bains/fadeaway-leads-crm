'use server'

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function generateOutreachSuggestions(leadData: any) {
    if (!process.env.GEMINI_API_KEY) {
        return { 
            error: 'Gemini API key is not configured. Please add "GEMINI_API_KEY" to your environment variables (e.g., in the Vercel Dashboard) and redeploy.' 
        };
    }

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' });

        // Format scoring rules into human-readable bullet points
        const formatRules = (rules: any[]) => rules
            .filter((r: any) => r.isTriggered)
            .map((r: any) => `  - ${r.label}: ${r.points > 0 ? `${r.points} pts` : 'OK'}`)
            .join('\n') || '  - None detected';

        const uxRulesStr = formatRules(leadData.scoringRules?.uxRules || []);
        const maturityRulesStr = formatRules(leadData.scoringRules?.maturityRules || []);
        const contactRulesStr = formatRules(leadData.scoringRules?.contactRules || []);

        // Single comprehensive prompt combining strategy + output generation
        const prompt = `
You are a world-class sales closer trained in Alex Hormozi's "$100M Offers" and "$100M Leads" frameworks.

Your job is to write a high-converting cold outreach pitch for a digital marketing agency targeting LOCAL SPORTS & FITNESS businesses.

=== LEAD PROFILE ===
Business: ${leadData.name || 'Unknown'}
Niche: ${leadData.niche || 'Local Business'}
Website: ${leadData.website || 'No website'}

=== WEBSITE AUDIT RESULTS ===
Overall Opportunity Score: ${leadData.score || 0}/${leadData.maxScore || 85}
Website Technical Issues Found: ${leadData.seoScore || 0} out of ${leadData.uxMax || 30} (higher = more problems we can fix)
Business Maturity Score: ${leadData.localIntentScore || 0}/${leadData.maturityMax || 30} (higher = more budget, more established)
Contact Access Score: ${leadData.contactabilityScore || 0}/${leadData.contactMax || 25}

=== PAGESPEED PERFORMANCE ===
Mobile: ${leadData.pagespeedMobile ?? 'Not tested'}/100
Desktop: ${leadData.pagespeedDesktop ?? 'Not tested'}/100
Mobile Load Time: ${leadData.mobileLoadTime || 'Unknown'}

=== GOOGLE PLACES ===
Rating: ${leadData.rating || 'Unknown'}/5.0
Reviews: ${leadData.ratingCount || 0}

=== SALES INTELLIGENCE ===
Win Probability: ${leadData.winProbability || 'Not assessed'}
Instagram Followers: ${leadData.igFollowers || 'Unknown'}
Instagram Activity: ${leadData.igActivity || 'Unknown'}
Agent Notes: ${leadData.manualNotes || 'None'}

=== SPECIFIC TECHNICAL ISSUES (things we can fix and sell) ===
${uxRulesStr}

=== BUSINESS STRENGTH SIGNALS (reasons they can pay for services) ===
${maturityRulesStr}

=== CONTACT & REACHABILITY ===
${contactRulesStr}

=== YOUR TASK ===
1. Analyze the data above. Identify the SINGLE most painful, emotionally compelling problem for THIS business owner. Do not pick generically — pick the issue that would make them stop scrolling and read.
2. Write a cold email and Instagram DM using Hormozi's "Value First" approach:
   - Open with proof of research (specific number from the audit)
   - Identify their specific pain (lost bookings, lost clients, slow website etc.)
   - Make a bold, low-friction offer
   - One call to action only
3. Write 3 key findings (specific issues you found) and 2 pain points (emotional consequences for the owner)

RULES:
- Use the ACTUAL business name "${leadData.name}" — never use placeholders like [Business Name]
- Use REAL numbers from the audit (load times, scores, review counts)
- Email must be under 100 words. DM under 50 words.
- Subject line must be under 6 words, punchy, no clickbait

Return ONLY a raw JSON object (NO markdown, no explanation, just valid JSON):
{
  "keyFindings": ["finding 1 with specific data", "finding 2 with specific data", "finding 3 with specific data"],
  "painPoints": ["emotional pain point 1", "emotional pain point 2"],
  "subjectLine": "Short punchy subject",
  "emailBody": "Full Hormozi-style cold email under 100 words using real data and actual business name",
  "dmBody": "Instagram DM under 50 words with a low-friction closing question"
}
`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Strip markdown code blocks if the model wrapped it
        let cleanJson = responseText.trim();
        if (cleanJson.startsWith('```json')) {
            cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanJson.startsWith('```')) {
            cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        const data = JSON.parse(cleanJson);
        return { data: { ...data, _debug: { prompt } } };

    } catch (e: any) {
        console.error('Failed to generate AI outreach:', e);
        return { error: e.message || 'Failed to generate outreach suggestions' };
    }
}
