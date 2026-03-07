import { signInWithOAuth } from '@/app/auth/actions'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function LoginPage({
    searchParams,
}: {
    searchParams: Promise<{ error: string }>
}) {
    const params = await searchParams;

    return (
        <div className="flex h-screen w-screen items-center justify-center bg-gray-50/50">
            <Card className="w-full max-w-sm">
                <CardHeader className="space-y-1 text-center">
                    <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
                    <CardDescription>
                        Sign in to your Fadeaway Leads account
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {params?.error && (
                        <div className="p-3 mb-4 text-sm text-red-500 bg-red-100/50 rounded-md">
                            {params.error}
                        </div>
                    )}

                    <form action={signInWithOAuth}>
                        <input type="hidden" name="provider" value="google" />
                        <Button variant="outline" className="w-full" type="submit">
                            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                                <path
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    fill="#4285F4"
                                />
                                <path
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    fill="#34A853"
                                />
                                <path
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    fill="#FBBC05"
                                />
                                <path
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    fill="#EA4335"
                                />
                                <path d="M1 1h22v22H1z" fill="none" />
                            </svg>
                            Continue with Google
                        </Button>
                    </form>

                    <form action={signInWithOAuth}>
                        <input type="hidden" name="provider" value="azure" />
                        <Button variant="outline" className="w-full" type="submit">
                            <svg className="mr-2 h-4 w-4" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
                                <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                                <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                                <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                                <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                            </svg>
                            Continue with Microsoft
                        </Button>
                    </form>

                    <form action={signInWithOAuth}>
                        <input type="hidden" name="provider" value="apple" />
                        <Button variant="outline" className="w-full" type="submit">
                            <svg className="mr-2 h-4 w-4 text-black dark:text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M16.365 21.056c-.053-.016-.108-.029-.163-.042A9.953 9.953 0 0112 22a9.953 9.953 0 01-4.202-.938c-.055.013-.11.026-.163.042C3.155 18.525 0 14.162 0 9 0 4.029 4.029 0 9 0s9 4.029 9 9c0 5.162-3.155 9.525-7.635 12.056z" fill="none" />
                                <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z" />
                            </svg>
                            Continue with Apple
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
