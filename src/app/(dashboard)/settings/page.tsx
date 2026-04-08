"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, AlertCircle, Mail, Shield, PenLine, Link } from "lucide-react";
import { getConfigStatus } from "@/app/actions/config";
import { getOutreachSettings, updateFromEmail, updateSendingDomain, updateSignatureInfo } from "@/app/actions/outreach-settings";
import { toast } from "sonner";

export default function SettingsPage() {
    const [config, setConfig] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Email Sending Config
    const [fromEmail, setFromEmail] = useState('');
    const [sendingDomain, setSendingDomain] = useState('');
    const [isSavingFrom, setIsSavingFrom] = useState(false);
    const [isSavingDomain, setIsSavingDomain] = useState(false);

    // Signature Config
    const [sigTitle, setSigTitle] = useState('');
    const [sigUrl, setSigUrl] = useState('');
    const [isSavingSig, setIsSavingSig] = useState(false);

    useEffect(() => {
        async function checkConfig() {
            const status = await getConfigStatus();
            setConfig(status);
            setIsLoading(false);
        }
        checkConfig();

        async function loadOutreachSettings() {
            const result = await getOutreachSettings();
            if (result.data) {
                setFromEmail(result.data.from_email || '');
                setSendingDomain(result.data.sending_domain || 'fadeawaycreatives.ca');
                setSigTitle(result.data.title || '');
                setSigUrl(result.data.signature_url || '');
            }
        }
        loadOutreachSettings();
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

            {/* Email Sending Configuration */}
            <Card className="border-orange-500/20 bg-orange-500/5 shadow-sm overflow-hidden">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-xl flex items-center gap-2">
                                <Mail className="h-5 w-5 text-orange-500" />
                                Email Sending Configuration
                            </CardTitle>
                            <CardDescription>Configure your outreach sending identity. Each team member sets their own from address.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Per-User From Email */}
                    <div className="p-4 bg-background rounded-lg border shadow-sm space-y-3">
                        <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-orange-500" />
                            <Label htmlFor="fromEmail" className="font-bold text-sm">Your Sending Email</Label>
                        </div>
                        <p className="text-xs text-muted-foreground">This is the "from" address that appears on all emails you send. Must match the workspace sending domain below.</p>
                        <div className="flex gap-3">
                            <Input
                                id="fromEmail"
                                type="email"
                                placeholder="you@yourdomain.com"
                                value={fromEmail}
                                onChange={(e) => setFromEmail(e.target.value)}
                                className="flex-1"
                            />
                            <Button
                                variant="outline"
                                disabled={isSavingFrom}
                                onClick={async () => {
                                    if (!fromEmail.trim()) {
                                        toast.error('Please enter a valid email address.');
                                        return;
                                    }
                                    setIsSavingFrom(true);
                                    const result = await updateFromEmail(fromEmail.trim());
                                    if (result.error) {
                                        toast.error(result.error);
                                    } else {
                                        toast.success('Sending email saved!');
                                    }
                                    setIsSavingFrom(false);
                                }}
                            >
                                {isSavingFrom ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                            </Button>
                        </div>
                    </div>

                    {/* Workspace Domain Control */}
                    <div className="p-4 bg-background rounded-lg border shadow-sm space-y-3">
                        <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-orange-500" />
                            <Label htmlFor="sendingDomain" className="font-bold text-sm">Workspace Sending Domain</Label>
                        </div>
                        <p className="text-xs text-muted-foreground">Only emails from this domain can be used as "from" addresses. Must be verified in your Resend dashboard. Leave blank to allow any domain.</p>
                        <div className="flex gap-3">
                            <Input
                                id="sendingDomain"
                                type="text"
                                placeholder="e.g. fadeawaycreatives.ca"
                                value={sendingDomain}
                                onChange={(e) => setSendingDomain(e.target.value)}
                                className="flex-1"
                            />
                            <Button
                                variant="outline"
                                disabled={isSavingDomain}
                                onClick={async () => {
                                    setIsSavingDomain(true);
                                    const result = await updateSendingDomain(sendingDomain.trim());
                                    if (result.error) {
                                        toast.error(result.error);
                                    } else {
                                        toast.success('Sending domain saved!');
                                    }
                                    setIsSavingDomain(false);
                                }}
                            >
                                {isSavingDomain ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                            </Button>
                        </div>
                    </div>

                    {/* Signature Info */}
                    <div className="p-4 bg-background rounded-lg border shadow-sm space-y-3">
                        <div className="flex items-center gap-2">
                            <PenLine className="h-4 w-4 text-orange-500" />
                            <Label className="font-bold text-sm">Email Signature</Label>
                        </div>
                        <p className="text-xs text-muted-foreground">Your title and landing page link appear in the branded signature at the bottom of every outreach email.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="sigTitle" className="text-xs font-semibold text-muted-foreground">Title / Role</Label>
                                <Input
                                    id="sigTitle"
                                    placeholder="e.g. Founder & Creative Head"
                                    value={sigTitle}
                                    onChange={(e) => setSigTitle(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="sigUrl" className="text-xs font-semibold text-muted-foreground">Signature Link URL</Label>
                                <Input
                                    id="sigUrl"
                                    type="url"
                                    placeholder="e.g. https://fadeawaycreatives.com/sports/"
                                    value={sigUrl}
                                    onChange={(e) => setSigUrl(e.target.value)}
                                />
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            disabled={isSavingSig}
                            className="w-full sm:w-auto"
                            onClick={async () => {
                                setIsSavingSig(true);
                                const result = await updateSignatureInfo(sigTitle.trim(), sigUrl.trim());
                                if (result.error) {
                                    toast.error(result.error);
                                } else {
                                    toast.success('Signature info saved!');
                                }
                                setIsSavingSig(false);
                            }}
                        >
                            {isSavingSig ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PenLine className="h-4 w-4 mr-2" />}
                            Save Signature
                        </Button>

                        {/* Live Preview */}
                        <div className="mt-4 p-4 bg-white rounded-lg border shadow-inner">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Signature Preview</p>
                            <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '14px', color: '#222' }}>
                                <br /><br />
                                --<br />
                                {fromEmail ? fromEmail.split('@')[0].split('.').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Your Name'}<br />
                                {sigTitle && <>{sigTitle}<br /></>}
                                <a href={sigUrl || 'https://fadeawaycreatives.ca/'} style={{ color: '#FF4F00', textDecoration: 'none', fontWeight: 500 }} target="_blank" rel="noreferrer">
                                    Fadeaway Creatives
                                </a>
                            </div>
                        </div>
                    </div>
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
