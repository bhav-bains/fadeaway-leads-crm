import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
    const cookieStore = await cookies()

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    )

    // Auth Bypass for Local Dev
    if (process.env.NEXT_PUBLIC_AUTH_BYPASS === 'true' && process.env.NODE_ENV === 'development') {
        const originalGetUser = supabase.auth.getUser.bind(supabase.auth);
        (supabase.auth as any).getUser = async (jwt?: string) => {
            const { data, error } = await originalGetUser(jwt);
            if (!data?.user) {
                return { 
                    data: { 
                        user: { 
                            id: '00000000-0000-0000-0000-000000000000', 
                            email: 'dev@fadeaway.pro',
                            user_metadata: { full_name: 'Mock Developer' },
                            aud: 'authenticated',
                            role: 'authenticated',
                            created_at: new Date().toISOString(),
                        } as any 
                    }, 
                    error: null 
                };
            }
            return { data, error };
        };

        const originalFrom = supabase.from.bind(supabase);
        (supabase as any).from = (table: string) => {
            if (table === 'profiles') {
                return {
                    select: () => ({
                        eq: () => ({
                            single: () => Promise.resolve({ 
                                data: { 
                                    id: '00000000-0000-0000-0000-000000000000',
                                    workspace_id: '00000000-0000-0000-0000-000000000000',
                                    full_name: 'Mock Developer'
                                }, 
                                error: null 
                            })
                        })
                    })
                } as any;
            }
            return originalFrom(table);
        };
    }

    return supabase;
}
