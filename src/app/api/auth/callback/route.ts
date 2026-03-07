import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    // if "next" is in param, use it as the redirect URL
    const next = searchParams.get('next') ?? '/'

    if (code) {
        console.log("OAuth callback triggered with code:", code.substring(0, 5) + "...");
        const supabase = await createClient()
        const { data: authData, error } = await supabase.auth.exchangeCodeForSession(code)

        if (error) {
            console.error("Supabase exchangeCodeForSession error:", error);
        } else {
            console.log("Session exchanged successfully for user:", authData?.user?.id);
        }

        if (!error && authData.user) {
            // Force the session to save to cookies by immediately reading it
            await supabase.auth.getUser();

            // Ensure profile and workspace exist
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', authData.user.id)
                .single()

            if (!profile || !profile.workspace_id) {
                console.log("No profile/workspace found. Creating new workspace...");
                // First time login: Create default workspace by providing the UUID directly
                // (This avoids .select() failures where RLS blocks reading the newly inserted row before the profile is linked)
                const workspaceId = crypto.randomUUID();
                const defaultWorkspaceName = `${authData.user.user_metadata?.full_name || 'My'} Workspace`

                const { error: insertError } = await supabase
                    .from('workspaces')
                    .insert([{ id: workspaceId, name: defaultWorkspaceName }])

                if (!insertError) {
                    const { error: profileError } = await supabase
                        .from('profiles')
                        .upsert({
                            id: authData.user.id,
                            full_name: authData.user.user_metadata?.full_name || authData.user.email,
                            workspace_id: workspaceId,
                            role: 'admin'
                        })
                    if (profileError) console.error("Profile creation error:", profileError);
                } else {
                    console.error("Workspace creation error:", insertError);
                }
            }
        }
    } else {
        console.warn("No code found in searchParams.");
    }

    // return the user to an error page with instructions
    const redirectUrl = `${origin}${next}`;
    console.log("Redirecting to:", redirectUrl);
    return NextResponse.redirect(redirectUrl)
}
