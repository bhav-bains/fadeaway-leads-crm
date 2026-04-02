'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getOutreachSettings() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('workspace_id, from_email, full_name, title, signature_url')
        .eq('id', user.id)
        .single()

    if (!profile?.workspace_id) return { error: 'No workspace' }

    const { data: settings } = await supabase
        .from('settings')
        .select('sending_domain, booking_link')
        .eq('workspace_id', profile.workspace_id)
        .single()

    return {
        data: {
            from_email: profile.from_email || '',
            full_name: profile.full_name || '',
            title: profile.title || '',
            signature_url: profile.signature_url || '',
            sending_domain: settings?.sending_domain || '',
            booking_link: settings?.booking_link || '',
        }
    }
}

export async function updateFromEmail(fromEmail: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    // Get workspace sending_domain for validation
    const { data: profile } = await supabase
        .from('profiles')
        .select('workspace_id')
        .eq('id', user.id)
        .single()

    if (!profile?.workspace_id) return { error: 'No workspace' }

    const { data: settings } = await supabase
        .from('settings')
        .select('sending_domain')
        .eq('workspace_id', profile.workspace_id)
        .single()

    // Validate domain if workspace has a sending_domain set
    if (settings?.sending_domain && fromEmail) {
        const emailDomain = fromEmail.split('@')[1]?.toLowerCase()
        const allowedDomain = settings.sending_domain.toLowerCase()
        if (emailDomain !== allowedDomain) {
            return { error: `Email must use the @${allowedDomain} domain.` }
        }
    }

    const { error } = await supabase
        .from('profiles')
        .update({ from_email: fromEmail })
        .eq('id', user.id)

    if (error) return { error: error.message }

    revalidatePath('/settings')
    return { success: true }
}

export async function updateSendingDomain(sendingDomain: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('workspace_id, role')
        .eq('id', user.id)
        .single()

    if (!profile?.workspace_id) return { error: 'No workspace' }

    // Upsert into settings (may not exist yet)
    const { error } = await supabase
        .from('settings')
        .upsert({
            workspace_id: profile.workspace_id,
            sending_domain: sendingDomain || null
        }, { onConflict: 'workspace_id' })

    if (error) return { error: error.message }

    revalidatePath('/settings')
    return { success: true }
}

export async function updateSignatureInfo(title: string, signatureUrl: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const { error } = await supabase
        .from('profiles')
        .update({ title: title || null, signature_url: signatureUrl || null })
        .eq('id', user.id)

    if (error) return { error: error.message }

    revalidatePath('/settings')
    return { success: true }
}
