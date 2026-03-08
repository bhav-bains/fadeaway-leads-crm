"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchLeadsPaginated, updateLeadStatusAction, fetchPipelineLeads } from "@/app/actions/leads";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Search, MapPin, Download, Send, Plus, ChevronLeft, ChevronRight, Mail, Phone, Globe, Star, CheckCircle2, XCircle, FileJson } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

import { DndContext, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// --- OUTREACH TEMPLATES ---
const TEMPLATES = {
    "V1 (Pattern Interrupt)": {
        subject: "Quick question regarding [business_name]",
        body: "Hey, noticed [business_name] is missing a clear booking system on your site. I run a local agency in [city] and we fix this specific issue to drive more revenue.\n\nGrab 15 mins here: [booking_link]"
    },
    "V2 (Value Add)": {
        subject: "Driving more revenue in [city]",
        body: "Hey, I was looking at [business_name] and noticed some areas where we could help you double your online registrations.\n\nWe recently helped a similar business see a massive increase in bookings by fixing their SEO gap.\n\nWorth a brief chat? Book a time here: [booking_link]"
    },
    "V3 (CTA Push)": {
        subject: "Free SEO Audit for [business_name]",
        body: "Hey,\n\nWe provide free automated SEO audits for highly-rated businesses in [city] like [business_name]. Our recent audit flagged a few critical missing items on your homepage that are costing you leads.\n\nAre you open to a quick 15-minute review? [booking_link]"
    }
};

const KANBAN_STAGES = ['New', 'Contacted', 'Booked', 'Closed'];

function KanbanCard({ lead }: { lead: any }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id });
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="bg-white p-3 rounded-md shadow-sm border mb-2 cursor-grab active:cursor-grabbing text-sm group">
            <div className="flex justify-between items-start mb-1">
                <span className="font-semibold truncate pr-2">{lead.name}</span>
                <Badge variant={lead.scores?.[0]?.score_overall >= 12 ? 'default' : 'secondary'} className="text-[10px] px-1 h-4 shrink-0">{lead.scores?.[0]?.score_overall || 0}/20</Badge>
            </div>
            <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><MapPin className="h-3 w-3" />{lead.city}</div>
            <div className="flex flex-col gap-1">
                {lead.contacts?.[0]?.email && <div className="text-[10px] flex items-center gap-1 text-slate-600"><Mail className="h-3 w-3" />{lead.contacts[0].email}</div>}
                {lead.phone && <div className="text-[10px] flex items-center gap-1 text-slate-600"><Phone className="h-3 w-3" />{lead.phone}</div>}
            </div>
            {lead.seo_audits?.[0] && !lead.seo_audits[0].has_booking_link && (
                <div className="mt-2 text-[10px] text-red-600 font-medium bg-red-50 p-1 rounded">🔴 Missing Booking Link</div>
            )}
        </div>
    );
}

export default function CommandDashboard() {
    // Top-Level State
    const [currentTab, setCurrentTab] = useState("list");

    // Table Pagination & Filters
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [totalCount, setTotalCount] = useState(0);
    const [search, setSearch] = useState("");
    const [city, setCity] = useState("all");
    const [minScore, setMinScore] = useState([7]);
    const [hasEmail, setHasEmail] = useState(false);
    const [ratingRange, setRatingRange] = useState("all");

    // Data State
    const [leads, setLeads] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [pipelineLeads, setPipelineLeads] = useState<any[]>([]);

    // Interaction State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [activeLead, setActiveLead] = useState<any | null>(null);

    // Send Sequence Modal State
    const [isSendModalOpen, setIsSendModalOpen] = useState(false);
    const [targetLeads, setTargetLeads] = useState<any[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<keyof typeof TEMPLATES>("V1 (Pattern Interrupt)");
    const [emailSubject, setEmailSubject] = useState(TEMPLATES["V1 (Pattern Interrupt)"].subject);
    const [emailBody, setEmailBody] = useState(TEMPLATES["V1 (Pattern Interrupt)"].body);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        if (currentTab === "list") {
            const { data, count, error } = await fetchLeadsPaginated({
                page, pageSize, search, city, minScore: minScore[0], hasEmail, ratingRange
            });
            if (error) toast.error("Failed to load leads: " + error);
            else { setLeads(data); setTotalCount(count); }
        } else {
            const { data, error } = await fetchPipelineLeads();
            if (error) toast.error("Failed to load pipeline: " + error);
            else setPipelineLeads(data);
        }
        setIsLoading(false);
    }, [currentTab, page, pageSize, search, city, minScore, hasEmail, ratingRange]);

    useEffect(() => {
        const timer = setTimeout(() => { loadData(); }, 300);
        return () => clearTimeout(timer);
    }, [loadData, search, city, currentTab]);

    useEffect(() => { loadData(); }, [page, pageSize, minScore, hasEmail, ratingRange]);

    const handleSelectAll = (checked: boolean) => {
        if (checked) setSelectedIds(new Set(leads.map(l => l.id)));
        else setSelectedIds(new Set());
    };

    const handleSelectRow = (id: string, checked: boolean) => {
        const newSet = new Set(selectedIds);
        if (checked) newSet.add(id);
        else newSet.delete(id);
        setSelectedIds(newSet);
    };

    const openSendSequenceModal = (singleTarget?: any) => {
        const targets = singleTarget ? [singleTarget] : leads.filter(l => selectedIds.has(l.id));
        if (targets.length === 0) return;
        setTargetLeads(targets);
        setIsSendModalOpen(true);
    };

    const handleTemplateChange = (val: string) => {
        const templateKey = val as keyof typeof TEMPLATES;
        setSelectedTemplate(templateKey);
        setEmailSubject(TEMPLATES[templateKey].subject);
        setEmailBody(TEMPLATES[templateKey].body);
    };

    const handleSendSequence = async () => {
        setIsSendModalOpen(false);
        const toastId = toast.loading(`Assigning outreach sequence to ${targetLeads.length} leads...`);
        let successCount = 0;

        for (const lead of targetLeads) {
            try {
                const res = await fetch("/api/automations/resend", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        companyId: lead.id,
                        contactEmail: lead.contacts?.[0]?.email || "founder@example.com",
                        sequenceName: selectedTemplate,
                        subject: emailSubject,
                        rawBodyTemplate: emailBody
                    })
                });

                if (res.ok) {
                    successCount++;
                } else {
                    console.error("Failed to send sequence for lead:", lead.id);
                }
            } catch (err) {
                console.error("Automation error:", err);
            }
        }

        toast.success(`Started outreach for ${successCount} leads!`, { id: toastId });
        setSelectedIds(new Set());
        loadData(); // Will refresh list or pipeline to reflect auto-motion to "Contacted"
    };

    const handleExportCSV = () => {
        const targets = leads.filter(l => selectedIds.has(l.id));
        if (targets.length === 0) return;

        const headers = ["Business Name", "City", "Rating", "Email", "Phone", "Booking Link", "Total Score"];
        const rows = targets.map(l => [
            `"${l.name}"`, `"${l.city}"`,
            l.rating_avg ? `${l.rating_avg} (${l.rating_count})` : "N/A",
            `"${l.contacts?.[0]?.email || ''}"`, `"${l.phone || ''}"`,
            l.seo_audits?.[0]?.has_booking_link ? "Yes" : "No",
            l.scores?.[0]?.score_overall || 0
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `fadeaway_leads_export.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        toast.success("CSV Exported successfully.");
    };

    // Dnd-Kit Hooks for Kanban
    const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

    const handleDragEnd = async (event: any) => {
        const { active, over } = event;
        if (!over) return;

        const leadId = active.id;
        const newStatus = over.id; // column id

        const lead = pipelineLeads.find(l => l.id === leadId);
        if (lead && lead.status !== newStatus && KANBAN_STAGES.includes(newStatus)) {
            // Optimistic update
            setPipelineLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
            const { error } = await updateLeadStatusAction(leadId, newStatus);
            if (error) toast.error("Failed to update status");
        }
    };


    const totalPages = Math.ceil(totalCount / pageSize);

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)] gap-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Command Dashboard</h1>
                    <p className="text-muted-foreground mt-1">High-density lead management and outbound sequencing.</p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <Tabs value={currentTab} onValueChange={setCurrentTab} className="h-9">
                        <TabsList className="grid w-full grid-cols-2 h-9">
                            <TabsTrigger value="list" className="h-7 text-xs">Leads List</TabsTrigger>
                            <TabsTrigger value="pipeline" className="h-7 text-xs">Pipeline</TabsTrigger>
                        </TabsList>
                    </Tabs>
                    <Button variant="outline"><Plus className="mr-2 h-4 w-4" /> Quick Add</Button>
                </div>
            </div>

            {/* TAB CONTAINER */}
            <div className="flex-1 flex flex-col min-h-0 relative">
                {currentTab === "list" ? (
                    <>
                        {/* 1. The Control Bar (Filters) */}
                        <div className="bg-card border rounded-lg p-3 shrink-0 shadow-sm flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-4 mb-4">
                            <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
                                <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search leads..."
                                    className="pl-8 h-8 text-sm bg-background w-full"
                                    value={search}
                                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                                />
                            </div>

                            <div className="relative w-full sm:w-[150px]">
                                <MapPin className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="City..."
                                    className="pl-8 h-8 text-sm bg-background w-full"
                                    value={city === 'all' ? '' : city}
                                    onChange={e => { setCity(e.target.value || ''); setPage(1); }}
                                />
                            </div>

                            <div className="flex items-center gap-3 bg-muted/30 px-3 py-1.5 rounded-md border w-full sm:min-w-[180px]">
                                <Label className="text-xs font-semibold shrink-0">Min Score: {minScore[0]}</Label>
                                <Slider
                                    min={0} max={20} step={1}
                                    value={minScore}
                                    onValueChange={(v) => { setMinScore(v as number[]); setPage(1); }}
                                    className="w-full flex-1"
                                />
                            </div>

                            <div className="flex items-center space-x-2 w-full sm:w-auto">
                                <Checkbox id="req-email" checked={hasEmail} onCheckedChange={(c) => { setHasEmail(c as boolean); setPage(1); }} />
                                <Label htmlFor="req-email" className="text-xs cursor-pointer font-medium">Has Email</Label>
                            </div>

                            <Select value={ratingRange} onValueChange={v => { setRatingRange(v); setPage(1); }}>
                                <SelectTrigger className="w-full sm:w-[140px] h-8 text-xs bg-background">
                                    <SelectValue placeholder="Rating" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Ratings</SelectItem>
                                    <SelectItem value="high">4.0 & Up</SelectItem>
                                    <SelectItem value="low">Under 4.0</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Bulk Actions Bar */}
                        {selectedIds.size > 0 && (
                            <div className="bg-primary text-primary-foreground py-2 px-4 rounded-md flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md shrink-0 mb-4 animate-in slide-in-from-top-1">
                                <span className="font-semibold text-sm w-full sm:w-auto text-center sm:text-left">{selectedIds.size} Leads Selected</span>
                                <div className="flex items-center gap-2">
                                    <Button variant="secondary" size="sm" onClick={handleExportCSV} className="h-7 text-xs">
                                        <Download className="h-3 w-3 mr-1.5" /> Export CSV
                                    </Button>
                                    <Button variant="default" size="sm" onClick={() => openSendSequenceModal()} className="h-7 text-xs shadow-none border-primary-foreground/20 hover:bg-primary-foreground/10 hover:text-white">
                                        <Send className="h-3 w-3 mr-1.5" /> Assign Sequence
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* 2. The Data Table */}
                        <div className="flex-1 border rounded-md bg-card overflow-hidden flex flex-col min-h-0 relative shadow-sm">
                            <div className="overflow-auto flex-1 relative">
                                <Table className="relative min-w-max w-full">
                                    <TableHeader className="bg-muted/60 sticky top-0 z-10 backdrop-blur-sm">
                                        <TableRow>
                                            <TableHead className="w-[40px] pl-4">
                                                <Checkbox checked={selectedIds.size === leads.length && leads.length > 0} onCheckedChange={handleSelectAll} />
                                            </TableHead>
                                            <TableHead className="w-[200px] whitespace-nowrap">Business Name</TableHead>
                                            <TableHead className="w-[100px] whitespace-nowrap">City</TableHead>
                                            <TableHead className="w-[80px] text-center whitespace-nowrap">Rating</TableHead>
                                            <TableHead className="w-[180px] whitespace-nowrap">Contact</TableHead>
                                            <TableHead className="w-[100px] text-center whitespace-nowrap">Booking Link</TableHead>
                                            <TableHead className="w-[80px] text-center whitespace-nowrap">Score</TableHead>
                                            <TableHead className="w-[80px] pr-4 text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground bg-muted/10">Loading leads...</TableCell>
                                            </TableRow>
                                        ) : leads.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">No leads match the current filters.</TableCell>
                                            </TableRow>
                                        ) : leads.map(lead => {
                                            const scoreObj = lead.scores?.[0] || {};
                                            const auditObj = lead.seo_audits?.[0] || {};
                                            const email = lead.contacts?.[0]?.email;

                                            return (
                                                <TableRow key={lead.id} className="cursor-pointer group hover:bg-muted/30" onClick={() => setActiveLead(lead)}>
                                                    <TableCell className="pl-4" onClick={e => e.stopPropagation()}>
                                                        <Checkbox checked={selectedIds.has(lead.id)} onCheckedChange={c => handleSelectRow(lead.id, c as boolean)} />
                                                    </TableCell>
                                                    <TableCell className="font-medium max-w-[200px]">
                                                        <div className="truncate text-sm" title={lead.name}>{lead.name}</div>
                                                        {lead.website && (
                                                            <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:underline flex items-center mt-0.5" onClick={e => e.stopPropagation()}>
                                                                <Globe className="h-3 w-3 mr-1 inline" /> Visit Site
                                                            </a>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground truncate max-w-[100px]" title={lead.city}>{lead.city}</TableCell>
                                                    <TableCell className="text-center">
                                                        {lead.rating_avg ? (
                                                            <div className="flex flex-col items-center">
                                                                <span className="text-sm font-semibold flex items-center"><Star className="h-3 w-3 fill-yellow-400 text-yellow-400 mr-1" />{lead.rating_avg}</span>
                                                                <span className="text-[10px] text-muted-foreground">({lead.rating_count})</span>
                                                            </div>
                                                        ) : <span className="text-xs text-muted-foreground">-</span>}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col gap-0.5">
                                                            {email ? <span className="text-xs font-medium flex items-center"><Mail className="h-3 w-3 mr-1.5 text-muted-foreground" /> <span className="truncate max-w-[140px]" title={email}>{email}</span></span> : <span className="text-[10px] text-muted-foreground border px-1 rounded bg-muted/50 w-fit">No Email</span>}
                                                            {lead.phone && <span className="text-[10px] text-muted-foreground flex items-center"><Phone className="h-2.5 w-2.5 mr-1" /> {lead.phone}</span>}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {auditObj.has_booking_link ? (
                                                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 uppercase text-[9px] px-1.5">Yes</Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 uppercase text-[9px] px-1.5">Missing</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Badge variant={scoreObj.score_overall >= 15 ? 'default' : (scoreObj.score_overall >= 7 ? 'secondary' : 'outline')} className="px-2 font-bold cursor-help">
                                                                    {scoreObj.score_overall || 0}/20
                                                                </Badge>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="left" className="p-3 shadow-xl">
                                                                <div className="space-y-1.5 text-xs font-medium">
                                                                    <div className="flex justify-between gap-4"><span className="text-muted-foreground">Contactability</span> <span>{scoreObj.score_contactability || 0} pts</span></div>
                                                                    <div className="flex justify-between gap-4"><span className="text-muted-foreground">SEO Gap</span> <span>{scoreObj.score_seo || 0} pts</span></div>
                                                                    <div className="flex justify-between gap-4"><span className="text-muted-foreground">Local Intent</span> <span>{scoreObj.score_local_intent || 0} pts</span></div>
                                                                    <div className="flex justify-between gap-4"><span className="text-muted-foreground">Business Fit</span> <span>{scoreObj.score_fit || 0} pts</span></div>
                                                                    <div className="border-t pt-1 mt-1 flex justify-between font-bold"><span>Total Score</span> <span>{scoreObj.score_overall || 0}/20</span></div>
                                                                </div>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TableCell>
                                                    <TableCell className="pr-4 text-right">
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); openSendSequenceModal(lead); }} title="Assign Outreach Sequence">
                                                            <Send className="h-3.5 w-3.5 text-primary" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination Controls */}
                            <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-t shrink-0">
                                <div className="text-xs text-muted-foreground">
                                    Showing {leads.length > 0 ? (page - 1) * pageSize + 1 : 0} to {Math.min(page * pageSize, totalCount)} of <span className="font-bold">{totalCount}</span> leads
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" className="h-7 text-xs px-2" disabled={page === 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-3 w-3 mr-1" /> Prev</Button>
                                    <span className="text-xs font-medium w-8 text-center">{page} / {totalPages || 1}</span>
                                    <Button variant="outline" size="sm" className="h-7 text-xs px-2" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next <ChevronRight className="h-3 w-3 ml-1" /></Button>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    /* ====== KANBAN TAB ====== */
                    <div className="flex-1 flex gap-4 overflow-x-auto overflow-y-hidden pb-4">
                        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
                            {KANBAN_STAGES.map(stage => {
                                const stageLeads = pipelineLeads.filter(l => l.status === stage || (!l.status && stage === 'New'));
                                return (
                                    <div key={stage} className="bg-muted/40 rounded-lg border w-[300px] min-w-[300px] flex flex-col h-full shrink-0">
                                        <div className="p-3 border-b bg-muted/60 flex justify-between items-center shrink-0">
                                            <h3 className="font-semibold text-sm">{stage}</h3>
                                            <Badge variant="secondary" className="px-1.5 min-w-[20px] justify-center">{stageLeads.length}</Badge>
                                        </div>
                                        <div className="p-3 flex-1 overflow-y-auto">
                                            <SortableContext id={stage} items={stageLeads.map(l => l.id)} strategy={verticalListSortingStrategy}>
                                                {stageLeads.map(lead => (
                                                    <div key={lead.id} onClick={(e) => setActiveLead(lead)}>
                                                        <SortableItem id={lead.id} lead={lead} />
                                                    </div>
                                                ))}
                                            </SortableContext>
                                        </div>
                                    </div>
                                )
                            })}
                        </DndContext>
                    </div>
                )}
            </div>

            {/* SEND SEQUENCE MODAL */}
            <Dialog open={isSendModalOpen} onOpenChange={setIsSendModalOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Assign Outreach Sequence</DialogTitle>
                        <DialogDescription>
                            Preparing to email {targetLeads.length} selected lead{targetLeads.length === 1 ? '' : 's'}. Our backend will automatically inject the `[business_name]`, `[city]`, and `[booking_link]` tokens.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-4">
                        <div className="space-y-1.5">
                            <Label>Hormozi-Style Template</Label>
                            <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                                <SelectTrigger className="bg-background">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.keys(TEMPLATES).map(key => (
                                        <SelectItem key={key} value={key}>{key}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label>Subject Line</Label>
                            <Input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} />
                        </div>

                        <div className="space-y-1.5">
                            <Label>Email Body (Raw Token Template)</Label>
                            <Textarea
                                className="h-[200px] text-sm font-mono"
                                value={emailBody}
                                onChange={e => setEmailBody(e.target.value)}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsSendModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSendSequence}><Send className="mr-2 h-4 w-4" /> Dispatch Flow</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 3. The Right-Side Drawer (Lead Profile) */}
            <Sheet open={!!activeLead} onOpenChange={(o) => { if (!o) setActiveLead(null) }}>
                <SheetContent side="right" className="w-[400px] sm:w-[500px] overflow-y-auto p-0">
                    {activeLead && (
                        <div className="flex flex-col h-full bg-slate-50">
                            <div className="px-6 py-6 bg-white border-b sticky top-0 z-10 shadow-sm">
                                <Badge variant="secondary" className="mb-3">{activeLead.status || 'New'}</Badge>
                                <SheetTitle className="text-2xl font-bold leading-tight">{activeLead.name}</SheetTitle>
                                <SheetDescription className="mt-1 flex items-center text-sm">
                                    <MapPin className="h-3.5 w-3.5 mr-1" /> {activeLead.address}, {activeLead.city}
                                </SheetDescription>

                                <div className="mt-4 flex gap-2">
                                    {activeLead.status !== 'Booked' && activeLead.status !== 'Closed' && (
                                        <Button size="sm" onClick={() => openSendSequenceModal(activeLead)} className="flex-1"><Send className="h-3.5 w-3.5 mr-2" /> Assign Sequence</Button>
                                    )}
                                    {activeLead.website && (
                                        <a href={activeLead.website} target="_blank" rel="noopener noreferrer">
                                            <Button variant="outline" size="sm" className="px-3" type="button">
                                                <Globe className="h-3.5 w-3.5" />
                                            </Button>
                                        </a>
                                    )}
                                </div>
                            </div>

                            <div className="p-6 space-y-6 flex-1">
                                {/* Engagement History */}
                                {activeLead.outreach_messages && activeLead.outreach_messages.length > 0 && (
                                    <div className="bg-blue-50/50 rounded-lg border border-blue-100 shadow-sm overflow-hidden">
                                        <div className="bg-blue-100/50 px-4 py-2 border-b border-blue-100/50 flex items-center gap-2">
                                            <Send className="h-4 w-4 text-blue-600" />
                                            <h3 className="font-semibold text-sm text-blue-900">Engagement History</h3>
                                        </div>
                                        <div className="p-4 space-y-3 print-exact">
                                            {activeLead.outreach_messages.map((msg: any, i: number) => (
                                                <div key={i} className="bg-white p-3 rounded border text-sm shadow-sm space-y-2">
                                                    <div className="flex justify-between items-start">
                                                        <span className="font-bold text-slate-800">{msg.sequence_name} <span className="text-xs text-muted-foreground font-normal ml-1">(Step {msg.step})</span></span>
                                                        <span className="text-[10px] text-muted-foreground">{new Date(msg.sent_at).toLocaleDateString()}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-600 line-clamp-2 italic">"{msg.subject}"</p>

                                                    <div className="flex items-center gap-3 pt-2 border-t mt-2 text-xs">
                                                        <span className={`flex items-center gap-1 ${msg.open_count > 0 ? 'text-green-600 font-medium' : 'text-slate-400'}`}><CheckCircle className="h-3.5 w-3.5" /> Opens: {msg.open_count}</span>
                                                        <span className={`flex items-center gap-1 ${msg.click_count > 0 ? 'text-purple-600 font-medium' : 'text-slate-400'}`}><Globe className="h-3.5 w-3.5" /> Clicks: {msg.click_count}</span>
                                                        <span className={`flex items-center gap-1 ${msg.reply_flag ? 'text-orange-500 font-medium' : 'text-slate-400'}`}><Mail className="h-3.5 w-3.5" /> Replies: {msg.reply_flag ? 'Yes' : 'No'}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Details Card */}
                                <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                                    <div className="bg-muted/50 px-4 py-2 border-b"><h3 className="font-semibold text-sm">Contact Details</h3></div>
                                    <div className="p-4 space-y-4 text-sm">
                                        <div className="flex gap-3">
                                            <Mail className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                                            <div className="flex-1">
                                                {activeLead.contacts?.length > 0 ? (
                                                    <div className="space-y-1">
                                                        {activeLead.contacts.map((c: any, i: number) => (
                                                            <div key={i} className="flex justify-between items-center bg-slate-50 px-2 py-1.5 rounded border">
                                                                <span className="font-medium">{c.email}</span>
                                                                <Badge variant="outline" className="text-[10px] bg-white">{c.type}</Badge>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : <span className="text-muted-foreground italic">No emails found</span>}
                                            </div>
                                        </div>
                                        <div className="flex gap-3 items-center">
                                            <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                                            <span>{activeLead.phone || <span className="text-muted-foreground italic">No phone number</span>}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* SEO Audit Highlights */}
                                <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                                    <div className="bg-muted/50 px-4 py-2 border-b flex justify-between items-center">
                                        <h3 className="font-semibold text-sm">SEO Audit Highlights</h3>
                                        <Badge variant={activeLead.scores?.[0]?.score_overall >= 12 ? 'default' : 'secondary'}>{activeLead.scores?.[0]?.score_overall || 0}/20</Badge>
                                    </div>
                                    <div className="p-4 space-y-3">
                                        {(() => {
                                            const audit = activeLead.seo_audits?.[0] || {};
                                            const issues = [
                                                { label: "Valid Title Tag", ok: audit.has_title && audit.title_len >= 10, msg: audit.has_title ? `Length: ${audit.title_len}` : "Missing" },
                                                { label: "H1 Tag Present", ok: audit.has_h1, msg: audit.has_h1 ? "Found" : "Missing" },
                                                { label: "Booking/Pricing Link", ok: audit.has_booking_link, msg: audit.has_booking_link ? "Found" : "Missing" },
                                                { label: "Schema.org Data", ok: audit.schema_org_types?.length > 0, msg: audit.schema_org_types?.length > 0 ? "Present" : "Missing" }
                                            ];

                                            return issues.map((issue, idx) => (
                                                <div key={idx} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-md border text-sm">
                                                    <span className="font-medium text-slate-800">{issue.label}</span>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-xs text-muted-foreground">{issue.msg}</span>
                                                        {issue.ok ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                                                    </div>
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                </div>

                                {/* Fetch Logs */}
                                <div className="bg-slate-900 text-slate-200 rounded-lg border border-slate-700 shadow-sm overflow-hidden">
                                    <div className="bg-slate-950 px-4 py-2 border-b border-slate-800 flex items-center gap-2">
                                        <FileJson className="h-4 w-4 text-slate-400" />
                                        <h3 className="font-semibold text-sm">Scraper Raw Output</h3>
                                    </div>
                                    <div className="p-4 bg-slate-900 overflow-x-auto">
                                        <pre className="text-[10px] leading-relaxed">
                                            {JSON.stringify({
                                                db_id: activeLead.id,
                                                created_at: activeLead.created_at,
                                                raw_seo_audit: activeLead.seo_audits?.[0] || null,
                                                raw_contacts: activeLead.contacts || [],
                                                raw_scores: activeLead.scores?.[0] || null
                                            }, null, 2)}
                                        </pre>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>

        </div>
    );
}

