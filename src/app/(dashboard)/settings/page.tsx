"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react";
import { getConfigStatus } from "@/app/actions/config";

export default function SettingsPage() {
    const [config, setConfig] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function checkConfig() {
            const status = await getConfigStatus();
            setConfig(status);
            setIsLoading(false);
        }
        checkConfig();
    }, []);

    const StatusBadge = ({ isSet }: { isSet: boolean }) => (
        isSet ? (
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1.5 py-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Configured
            </Badge>
        ) : (
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 flex items-center gap-1.5 py-1">
                <XCircle className="h-3.5 w-3.5" /> Missing
            </Badge>
        )
    );

    return (
        <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-12">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground mt-2">
                    Manage your workspace configurations, profile details, and API integrations.
                </p>
            </div>

            {/* NEW: Configuration Readiness Dashboard */}
            <Card className="border-primary/20 bg-primary/5 shadow-sm overflow-hidden">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-xl flex items-center gap-2">
                                <AlertCircle className="h-5 w-5 text-primary" />
                                Production Readiness
                            </CardTitle>
                            <CardDescription>Verify your critical API keys are set in your environment variables.</CardDescription>
                        </div>
                        {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center justify-between p-3 bg-background rounded-lg border shadow-sm">
                            <span className="font-semibold text-sm">Gemini (AI Outreach)</span>
                            {!isLoading && <StatusBadge isSet={config?.gemini} />}
                        </div>
                        <div className="flex items-center justify-between p-3 bg-background rounded-lg border shadow-sm">
                            <span className="font-semibold text-sm">Resend (Email Send)</span>
                            {!isLoading && <StatusBadge isSet={config?.resend} />}
                        </div>
                        <div className="flex items-center justify-between p-3 bg-background rounded-lg border shadow-sm">
                            <span className="font-semibold text-sm">Google Places (Search)</span>
                            {!isLoading && <StatusBadge isSet={config?.googlePlaces} />}
                        </div>
                        <div className="flex items-center justify-between p-3 bg-background rounded-lg border shadow-sm text-muted-foreground opacity-60 italic">
                            <span className="text-sm italic">Status: {isLoading ? 'Checking...' : 'Live Server Verified'}</span>
                        </div>
                    </div>
                    {!isLoading && (!config?.gemini || !config?.resend || !config?.googlePlaces) && (
                        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800 flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold mb-1">Missing Keys Detected</p>
                                <p>To enable these features in production, you must add the missing keys to your <strong>Vercel Dashboard</strong> under <strong>Environment Variables</strong> and redeploy.</p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Profile Information</CardTitle>
                    <CardDescription>Update your personal details here.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input id="name" placeholder="John Doe" disabled />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input id="email" type="email" placeholder="john@example.com" disabled />
                    </div>
                    <Button disabled variant="outline">Save Changes</Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Workspace Settings</CardTitle>
                    <CardDescription>Manage your team and workspace preferences.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="workspaceName">Workspace Name</Label>
                        <Input id="workspaceName" placeholder="My Awesome Agency" disabled />
                    </div>
                    <Button disabled variant="outline">Update Workspace</Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Global API Reference</CardTitle>
                    <CardDescription>Reference values from your active environment.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="googlePlacesKey">Google Places Status</Label>
                        <Input 
                            id="googlePlacesKey" 
                            type="text" 
                            disabled 
                            value={isLoading ? "Loading..." : (config?.googlePlaces ? "Configured (Active)" : "Missing from Environment")}
                            className={!config?.googlePlaces ? "text-red-500 font-bold" : ""}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="resendKey">Resend Status</Label>
                        <Input 
                            id="resendKey" 
                            type="text" 
                            disabled 
                            value={isLoading ? "Loading..." : (config?.resend ? "Configured (Active)" : "Missing from Environment")}
                            className={!config?.resend ? "text-red-500 font-bold" : ""}
                        />
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-4">Security Notice: Secrets are handled via Vercel Environment Variables only.</p>
                </CardContent>
            </Card>
        </div>
    );
}
