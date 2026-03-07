import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // refreshing the auth token
    const {
        data: { user },
    } = await supabase.auth.getUser()

    // Bouncer logic:
    // If user is NOT logged in and trying to access protected routes, redirect to /login
    const protectedRoutes = ['/', '/dashboard', '/pipeline', '/lead-finder', '/settings']

    // Basic check: if path is in protectedRoutes or starts with any of them (but not generic check so we don't block everything)
    const isProtectedRoute = protectedRoutes.some(route =>
        request.nextUrl.pathname === route ||
        (route !== '/' && request.nextUrl.pathname.startsWith(`${route}/`))
    );

    const isAuthCallback = request.nextUrl.pathname.startsWith('/api/auth');

    console.log(`[Middleware] Path: ${request.nextUrl.pathname} | User: ${!!user} | Prot: ${isProtectedRoute} | AuthCB: ${isAuthCallback}`);

    if (!user && isProtectedRoute && !isAuthCallback) {
        console.log(`[Middleware] Redirecting unauthenticated user to /login from ${request.nextUrl.pathname}`);
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    // If user IS logged in and trying to access /login or /signup, redirect to dashboard
    if (user && (request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/signup'))) {
        console.log(`[Middleware] Redirecting authenticated user to /dashboard from ${request.nextUrl.pathname}`);
        const url = request.nextUrl.clone()
        url.pathname = '/'
        return NextResponse.redirect(url)
    }

    return supabaseResponse
}
