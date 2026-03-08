import { createClient } from '@/lib/supabase/server';

export async function parseEmailTemplate(
    templateBody: string,
    companyId: string,
    workspaceId: string
) {
    const supabase = await createClient();

    // Fetch company data
    const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .single();

    if (companyError || !company) {
        throw new Error("Company not found for token parsing.");
    }

    // Fetch workspace settings (e.g. for booking link)
    const { data: settings } = await supabase
        .from('settings')
        .select('booking_link')
        .eq('workspace_id', workspaceId)
        .single();

    // Map the tokens to their exact replacement values
    const replacements: Record<string, string> = {
        '[business_name]': company.name || 'your business',
        '[city]': company.city || 'your area',
        '[booking_link]': settings?.booking_link || 'https://calendly.com',
        '[demo_link]': 'https://example.com/demo' // Placeholder for MVP
    };

    // The Logic: String-replacement function that maps tokens
    let parsedBody = templateBody;
    for (const [token, value] of Object.entries(replacements)) {
        // Use regex with global flag to replace all instances of the exact token
        const regex = new RegExp(token.replace(/\[/g, '\\[').replace(/\]/g, '\\]'), 'g');
        parsedBody = parsedBody.replace(regex, value);
    }

    return parsedBody;
}
