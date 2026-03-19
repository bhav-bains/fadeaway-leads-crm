import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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
  }

  return supabase;
}
