'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function insertLead(leadData: { name: string, address: string, city: string, phone?: string, website?: string, niche?: string }) {
    const supabase = await createClient()

    // 1. Get current authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return { error: 'Not authenticated' }
    }

    // 2. Get user's profile to find their workspace_id
    const { data: profile } = await supabase
        .from('profiles')
        .select('workspace_id')
        .eq('id', user.id)
        .single()

    if (!profile || !profile.workspace_id) {
        return { error: 'No workspace found for user' }
    }

    // 3. Insert lead with their workspace_id to adhere to RLS
    const { data, error } = await supabase
        .from('leads')
        .insert([
            {
                workspace_id: profile.workspace_id,
                assigned_to: user.id,
                company_name: leadData.name,
                address: leadData.address,
                city: leadData.city,
                niche: leadData.niche,
                phone: leadData.phone,
                website: leadData.website,
                status: 'Sourced',
            }
        ])
        .select()
        .single()

    if (error) {
        console.error("Error inserting lead:", error)
        return { error: error.message }
    }

    revalidatePath('/pipeline')
    return { data }
}

export async function fetchLeads() {
    const supabase = await createClient()

    // RLS will automatically filter this down to only the user's workspace leads
    const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) {
        console.error("Error fetching leads:", error)
        return { error: error.message, data: [] }
    }

    return { data: data || [] }
}

export async function updateLeadStatusAction(leadId: string, newStatus: string) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('leads')
        .update({ status: newStatus })
        .eq('id', leadId)
        .select()
        .single()

    if (error) {
        console.error("Error updating lead status:", error)
        return { error: error.message }
    }

    revalidatePath('/pipeline')
    return { data }
}
