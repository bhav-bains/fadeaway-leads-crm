import { signInWithOAuth } from '@/app/auth/actions'
import { Button } from "@/components/ui/button"
import Link from 'next/link'

export default async function LoginPage({
    searchParams,
}: {
    searchParams: Promise<{ error: string }>
}) {
    const params = await searchParams;

    return (
        <div className="flex min-h-screen w-full font-sans flex-col lg:flex-row">
            {/* Left Column - Branding (Desktop) / Top Header (Mobile) */}
            <div className="lg:w-1/2 flex flex-col justify-between p-12 sm:p-16 lg:p-20 xl:p-28 bg-zinc-950 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-zinc-900/40 via-zinc-950 to-black relative overflow-hidden h-[52vh] lg:min-h-screen">
                <div className="relative z-10 text-white flex flex-col h-full justify-between lg:justify-start lg:block">
                    <div className="mb-6 lg:mb-32">
                        <img 
                            src="/images/Fadeaway-Logo.png" 
                            alt="Fadeaway Creatives" 
                            className="h-14 sm:h-20 w-auto object-contain"
                        />
                    </div>
                    
                    <div className="max-w-xl">
                        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-heading leading-[1.05] mb-4 lg:mb-10">
                            Dominate Search
                            <br className="hidden sm:block" />
                            <span className="text-brand"> Results.</span>
                        </h1>
                        <p className="text-zinc-400 text-base sm:text-lg lg:text-xl leading-relaxed mb-6 lg:mb-16 font-sans max-w-[420px]">
                            The high-performance outbound engine built for agencies focused on pure results.
                        </p>
                    </div>

                    <div className="mt-auto hidden lg:flex items-center pt-16">
                        <div className="w-16 h-[2px] bg-brand mr-6"></div>
                        <span className="text-brand font-bold text-sm tracking-[0.3em] uppercase">
                            Built Like Athletes
                        </span>
                    </div>
                </div>
                
                {/* Texture overlays */}
                <div className="absolute inset-0 bg-[radial-gradient(#ffffff30_1px,transparent_1px)] [background-size:32px_32px] opacity-80 lg:opacity-40 pointer-events-none"></div>
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-80 lg:opacity-60 mix-blend-overlay pointer-events-none"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-transparent pointer-events-none"></div>
            </div>

            {/* Right Column - Auth component */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-12 lg:p-24 xl:p-32 bg-white dark:bg-zinc-900 relative z-20 -mt-10 lg:mt-0 rounded-t-[60px] lg:rounded-none shadow-[0_-25px_80px_-20px_rgba(0,0,0,0.4)] pb-24 lg:pb-0">
                <div className="w-full max-w-[480px] mx-auto flex flex-col justify-center space-y-6 lg:space-y-16">
                    
                    <div className="flex flex-col space-y-2 lg:space-y-6 text-center lg:text-left">
                        <h2 className="text-4xl sm:text-5xl font-heading font-bold flex items-baseline justify-center lg:justify-start">
                            Welcome back <span className="text-brand ml-1 text-5xl leading-none">.</span>
                        </h2>
                        <p className="text-base lg:text-lg text-muted-foreground/80 text-center lg:text-left">
                            Sign in to access your outreach pipeline and campaign metrics.
                        </p>
                    </div>

                    {params?.error && (
                        <div className="p-4 lg:p-5 text-sm font-medium text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 rounded-xl">
                            {params.error}
                        </div>
                    )}

                    <div className="grid gap-6 lg:gap-8">
                        <form action={signInWithOAuth}>
                            <input type="hidden" name="provider" value="google" />
                            <Button variant="outline" className="w-full h-14 text-base font-semibold transition-all hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm" type="submit">
                                <svg className="mr-3 h-6 w-6" viewBox="0 0 24 24">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                    <path d="M1 1h22v22H1z" fill="none" />
                                </svg>
                                Continue with Google
                            </Button>
                        </form>
                    </div>
                </div>

                <div className="absolute bottom-10 lg:bottom-12 w-full text-center">
                    <p className="text-xs font-bold tracking-[0.15em] text-muted-foreground uppercase">
                        Don't have an account? <Link href="/signup" className="text-brand hover:text-brand/80 transition-colors ml-2 hover:underline">sign up</Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
