"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
    return (
        <div className="flex flex-col gap-6 max-w-4xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground mt-2">
                    Manage your workspace configurations, profile details, and API integrations.
                </p>
            </div>

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
                    <Button disabled>Save Changes</Button>
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
                    <Button disabled>Update Workspace</Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>API Integrations</CardTitle>
                    <CardDescription>Manage your external service keys.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="googlePlacesKey">Google Places API Key</Label>
                        <Input id="googlePlacesKey" type="password" placeholder="AIzaSy..." disabled />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="resendKey">Resend API Key</Label>
                        <Input id="resendKey" type="password" placeholder="re_..." disabled />
                    </div>
                    <Button disabled>Save Integrations</Button>
                </CardContent>
            </Card>
        </div>
    );
}
