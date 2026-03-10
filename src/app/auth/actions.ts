'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { Provider } from '@supabase/supabase-js'

export async function signInWithOAuth(formData: FormData) {
    const provider = formData.get('provider') as Provider
    const supabase = await createClient()

    // Build the redirect URL pointing to our callback route dynamically
    const headersList = await headers()
    const host = headersList.get('host') || 'localhost:3000'
    const protocol = headersList.get('x-forwarded-proto') || 'http'
    const isDev = process.env.NODE_ENV === 'development' || host.includes('localhost')
    const origin = isDev ? `${protocol}://${host}` : (process.env.NEXT_PUBLIC_SITE_URL || `${protocol}://${host}`)

    const redirectTarget = `${origin}/api/auth/callback`
    console.log("[Auth Action] Detected Host:", host)
    console.log("[Auth Action] Generated Redirect Target:", redirectTarget)

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
            redirectTo: redirectTarget,
        },
    })

    if (error) {
        redirect('/login?error=Could not authenticate user')
    }

    if (data.url) {
        redirect(data.url)
    }
}
export async function signInWithEmail(formData: FormData) {
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const supabase = await createClient()

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (error) {
        redirect(`/login?error=${error.message}`)
    }

    redirect('/pipeline')
}

export async function signUpWithEmail(formData: FormData) {
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const supabase = await createClient()

    const { error } = await supabase.auth.signUp({
        email,
        password,
    })

    if (error) {
        redirect(`/signup?error=${error.message}`)
    }

    redirect('/pipeline')
}

export async function logout() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
}
