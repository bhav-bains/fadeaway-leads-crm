'use server'

export async function getConfigStatus() {
    return {
        gemini: !!process.env.GEMINI_API_KEY,
        resend: !!process.env.RESEND_API_KEY,
        googlePlaces: !!process.env.GOOGLE_PLACES_API_KEY,
        supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    };
}
