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

        // Stringify the raw audit for the LLM to inspect directly
        const rawAuditString = JSON.stringify(leadData.rawAudit || {}, null, 2);

        // STEP 1: Generate a Hormozi-style strategy prompt
        const strategyPrompt = `
You are a world-class sales strategist specialized in Alex Hormozi's "$100M Offers" and "Lead Generation" frameworks. 
I have a lead for a ${leadData.niche || 'local business'} called "${leadData.name || 'this company'}".

Business Data Summary:
- Website: ${leadData.website || 'None'}
- Audit Score: ${leadData.score || 0}/100 (Overall)
- UX/SEO Score: ${leadData.seoScore || 0}/45 (Category: Technical/SEO)
- Local Trust Score: ${leadData.localIntentScore || 0}/30 (Category: Reviews/Maps)
- Contactability: ${leadData.contactabilityScore || 0}/25 (Category: Inbox/Form access)
- Biggest Weakness: ${leadData.biggestWeakness || 'None'}
- Manual Notes: ${leadData.manualNotes || 'None'}.

DETAILED AUDIT DATA (Raw JSON):
${rawAuditString}

Your task:
1. Analyze the RAW AUDIT DATA to find specific "gold nuggets" or "fatal flaws" to mention.
2. Generate a HIGHLY OPTIMIZED PROMPT for another AI. 
   This prompt should instruct the AI to write a cold email and DM using Hormozi's "Value First" approach.
Focus on:
1. Identifying a "High-Value Problem" we can solve for "${leadData.name}" based on your evaluation.
2. Building a "Grand Slam Offer" (high value, low friction).
3. Using the specific audit results as a "Reason why" we are reaching out.

Return ONLY the optimized instructions (prompt) that I should give the next AI. Do not include any other text.
`;

        const strategyResult = await model.generateContent(strategyPrompt);
        const customPrompt = strategyResult.response.text();

        // STEP 2: Execute the custom-built prompt
        const finalPrompt = `
${customPrompt}

Lead Context:
Name: ${leadData.name || 'Unknown'}
Website: ${leadData.website || 'No website'}
Overall Score: ${leadData.score || 'Unknown'}/100
SEO Score: ${leadData.seoScore || 0}/45
Trust Score: ${leadData.localIntentScore || 0}/30
Contactability: ${leadData.contactabilityScore || 0}/25
Biggest Weakness: ${leadData.biggestWeakness || 'None detected'}

Please return a raw JSON object (NO Markdown formatting, just valid JSON) with exactly this structure:
{
  "keyFindings": ["3 critical issues"],
  "painPoints": ["2 emotional pain points"],
  "subjectLine": "Short, punchy subject (under 6 words)",
  "emailBody": "Hormozi style email (under 100 words). Value first. Direct call to action. Use the actual name '${leadData.name}' instead of variables.",
  "dmBody": "Instagram DM (under 50 words). Low friction question at end."
}
`;

        const result = await model.generateContent(finalPrompt);
        const responseText = result.response.text();

        // Strip markdown code blocks if the model wrapped it in ```json
        let cleanJson = responseText.trim();
        if (cleanJson.startsWith('```json')) {
            cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanJson.startsWith('```')) {
            cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        const data = JSON.parse(cleanJson);
        return { data };

    } catch (e: any) {
        console.error('Failed to generate AI outreach:', e);
        return { error: e.message || 'Failed to generate outreach suggestions' };
    }
}
