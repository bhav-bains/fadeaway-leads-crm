'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Provider } from '@supabase/supabase-js'

export async function signInWithOAuth(formData: FormData) {
    const provider = formData.get('provider') as Provider
    const supabase = await createClient()

    // Build the redirect URL pointing to our callback route
    const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
            redirectTo: `${origin}/api/auth/callback`,
        },
    })

    if (error) {
        redirect('/login?error=Could not authenticate user')
    }

    if (data.url) {
        redirect(data.url)
    }
}

export async function logout() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
}
