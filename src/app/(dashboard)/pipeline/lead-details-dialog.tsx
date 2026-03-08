"use client";

import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Lead, useLeadStore } from "@/store/leadStore";
import { toast } from "sonner";
import { Activity, AlertOctagon, Mail, Phone, ExternalLink } from "lucide-react";

const STAGES = ['New', 'Contacted', 'Booked', 'Closed'];

interface LeadDetailsDialogProps {
    lead: Lead;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function LeadDetailsDialog({ lead, open, onOpenChange }: LeadDetailsDialogProps) {
    const { updateLeadStatus } = useLeadStore();
    const [status, setStatus] = useState(lead.status);

    useEffect(() => {
        setStatus(lead.status);
    }, [lead]);

    const handleSave = () => {
        if (status !== lead.status) {
            updateLeadStatus(lead.id, status as Lead['status']);
        }
        toast.success("Lead updated successfully.");
        onOpenChange(false);
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-md overflow-y-auto">
                <SheetHeader>
                    <SheetTitle className="text-xl flex items-center justify-between mt-2">
                        {lead.name}
                        {lead.score !== undefined && (
                            <Badge variant={lead.score >= 12 ? 'default' : 'secondary'} className="text-sm px-2 py-0.5">
                                {lead.score}/20 Score
                            </Badge>
                        )}
                    </SheetTitle>
                    <SheetDescription>
                        Full SEO Audit, Enrichment Details, and Action Center.
                    </SheetDescription>
                </SheetHeader>

                <div className="flex flex-col gap-6 py-6">
                    {/* SEO AUDIT HIGHLIGHT BOX */}
                    <div className="bg-muted/50 border rounded-lg p-4 space-y-3">
                        <div className="flex items-center text-sm font-semibold text-foreground/80">
                            <Activity className="h-4 w-4 mr-2 text-primary" />
                            Scraper Intelligence
                        </div>
                        <div className="bg-background border rounded-md p-3 text-sm">
                            <div className="flex items-start gap-2 text-red-600 font-medium pb-2 border-b mb-2">
                                <AlertOctagon className="h-4 w-4 shrink-0 mt-0.5" />
                                <span>{lead.biggestWeakness || "No major weakness found"}</span>
                            </div>
                            <div className="space-y-2 mt-3 text-muted-foreground text-xs">
                                <div className="flex justify-between">
                                    <span>Website</span>
                                    <span className="font-medium text-foreground">{lead.website ? <a href={`https://${lead.website}`} target="_blank" className="flex items-center hover:underline">{lead.website} <ExternalLink className="h-3 w-3 ml-1" /></a> : 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Address</span>
                                    <span className="font-medium text-foreground text-right max-w-[200px] truncate" title={lead.address}>{lead.address || 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    <div className="grid gap-3">
                        <Label htmlFor="status" className="font-semibold text-muted-foreground">Pipeline Stage</Label>
                        <Select value={status} onValueChange={(v) => setStatus(v as Lead['status'])}>
                            <SelectTrigger id="status" className="w-full">
                                <SelectValue placeholder="Select stage" />
                            </SelectTrigger>
                            <SelectContent>
                                {STAGES.map((s: string) => (
                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-3">
                        <Label className="font-semibold text-muted-foreground">Contact Details</Label>
                        <div className="grid gap-2">
                            <div className="relative">
                                <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input id="phone" defaultValue={lead.phone} className="pl-9" placeholder="Phone" />
                            </div>
                            <div className="relative">
                                <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input id="email" type="email" defaultValue={lead.email} className="pl-9" placeholder="owner@company.com" />
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="notes" className="font-semibold text-muted-foreground">Notes & Logs</Label>
                        <Textarea id="notes" placeholder="e.g. Needs Analysis call scheduled for Friday..." className="min-h-[100px]" />
                    </div>

                </div>

                <SheetFooter className="absolute bottom-0 left-0 right-0 p-4 border-t bg-background mt-auto">
                    <div className="flex w-full gap-2">
                        <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button className="w-full" onClick={handleSave}>Save changes</Button>
                    </div>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
