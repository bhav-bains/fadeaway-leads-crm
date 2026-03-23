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
import { Search, MapPin, Download, Send, Plus, ChevronLeft, ChevronRight, Mail, Phone, Globe, Star, CheckCircle2, XCircle, FileJson, Eye, Building2, Smartphone, Monitor, Activity, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

import { DndContext, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay, useDroppable } from '@dnd-kit/core';
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

const KANBAN_STAGES = ['Audited', 'Contacted', 'Engaged', 'Booked', 'Closed'];

function KanbanCard({ lead, onOpen }: { lead: Record<string, any>, onOpen: () => void }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id });
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={cn(
            "bg-zinc-950 p-4 rounded-xl border border-zinc-800/80 mb-3 cursor-grab active:cursor-grabbing text-sm group hover:border-brand/40 hover:bg-zinc-900 transition-all isolate relative overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-zinc-700/30 before:to-transparent shadow-md",
            isDragging && "opacity-60 shadow-2xl scale-105 border-brand/50 ring-1 ring-brand/20 z-50 bg-zinc-900"
        )}>
            <div className="flex justify-between items-start mb-2">
                <span className="font-bold text-[13px] text-zinc-100 uppercase tracking-tight truncate pr-2 group-hover:text-white transition-colors">{lead.name}</span>
                <Badge variant="outline" className={cn(
                    "text-[9px] px-1.5 h-5 shrink-0 font-black tracking-widest uppercase",
                    lead.scores?.[0]?.score_overall >= 60 ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" : "border-zinc-700 text-zinc-400 bg-zinc-800"
                )}>
                    {lead.scores?.[0]?.score_overall || 0}/100
                </Badge>
            </div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3 text-brand/70" />{lead.city}</div>
                {lead.niche && <div className="flex items-center gap-1.5 text-zinc-400"><Building2 className="h-3 w-3 text-brand/70" />{lead.niche}</div>}
            </div>
            <div className="flex flex-col gap-1.5 flex-1 mt-2">
                {lead.contacts?.[0]?.email && <div className="text-[10px] flex items-center gap-1.5 text-zinc-400 font-medium"><Mail className="h-3 w-3 text-zinc-600" />{lead.contacts[0].email}</div>}
                {lead.phone && <div className="text-[10px] flex items-center gap-1.5 text-zinc-400 font-medium"><Phone className="h-3 w-3 text-zinc-600" />{lead.phone}</div>}
            </div>
            {lead.seo_audits?.[0] && !lead.seo_audits[0].has_booking_link && (
                <div className="mt-3 text-[9px] font-black uppercase tracking-widest text-red-400 bg-red-950/40 border border-red-900/50 p-1.5 rounded-md flex items-center justify-center gap-1.5">
                    <XCircle className="h-3 w-3" /> Missing Booking
                </div>
            )}
            <div className="mt-4 pt-3 border-t border-zinc-800/80" onPointerDown={e => e.stopPropagation()}>
                <Button 
                    variant="outline" 
                    className="w-full h-8 text-[10px] font-black uppercase tracking-widest bg-zinc-900 hover:bg-brand/10 text-zinc-400 hover:text-brand border-zinc-800 hover:border-brand/30 transition-all rounded-lg"
                    onClick={(e) => { e.stopPropagation(); onOpen(); }}
                >
                    <Eye className="h-3.5 w-3.5 mr-1.5" /> View Data
                </Button>
            </div>
        </div>
    );
}

function KanbanColumn({ stage, leads, onOpenLead }: { stage: string, leads: any[], onOpenLead: (l: any) => void }) {
    const { setNodeRef } = useDroppable({ id: stage });
    return (
        <div ref={setNodeRef} className="bg-zinc-900/40 rounded-2xl border border-zinc-800/80 w-[300px] min-w-[300px] flex flex-col h-full shrink-0 shadow-xl backdrop-blur-sm">
            <div className="p-4 border-b border-zinc-800 bg-zinc-900/60 flex justify-between items-center shrink-0 rounded-t-2xl">
                <h3 className="font-black text-[11px] uppercase tracking-[0.2em] text-zinc-300">{stage}</h3>
                <Badge variant="outline" className="px-1.5 min-w-[24px] justify-center bg-zinc-950 border-zinc-800 text-brand text-[9px] font-bold">{leads.length}</Badge>
            </div>
            <div className="p-3 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <SortableContext id={stage} items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
                    {leads.map(lead => (
                        <div key={lead.id}>
                            <KanbanCard lead={lead} onOpen={() => onOpenLead(lead)} />
                        </div>
                    ))}
                </SortableContext>
            </div>
        </div>
    );
}

export default function CommandDashboard() {
    // Top-Level State
    const [currentTab, setCurrentTab] = useState("pipeline");

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
    const [leads, setLeads] = useState<Record<string, any>[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [pipelineLeads, setPipelineLeads] = useState<Record<string, any>[]>([]);

    // Interaction State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [activeLead, setActiveLead] = useState<Record<string, any> | null>(null);

    // Send Sequence Modal State
    const [isSendModalOpen, setIsSendModalOpen] = useState(false);
    const [targetLeads, setTargetLeads] = useState<Record<string, any>[]>([]);
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
    }, [loadData, search, city, currentTab, page, pageSize, minScore, hasEmail, ratingRange]);

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

    const openSendSequenceModal = (singleTarget?: Record<string, any>) => {
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
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), 
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = async (event: { active: any, over: any }) => {
        const { active, over } = event;
        if (!over) return;

        const leadId = active.id;
        let newStatus = over.id; // column id or over item id

        // If dropped onto a lead instead of directly on a column droppable
        if (!KANBAN_STAGES.includes(newStatus)) {
            const overLead = pipelineLeads.find(l => l.id === over.id);
            if (overLead) {
                newStatus = overLead.status || 'New';
            }
        }

        const lead = pipelineLeads.find(l => l.id === leadId);
        if (lead && lead.status !== newStatus && KANBAN_STAGES.includes(newStatus)) {
            // Optimistic update
            setPipelineLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
            const { error } = await updateLeadStatusAction(leadId, newStatus);
            if (error) toast.error("Failed to update status");
        }
    };

    const handleMigrate = async () => {
        const supabase = createClient();
        setIsLoading(true);
        const { data: newLeads } = await supabase.from('companies').select('id, seo_audits(id)').eq('status', 'New');
        const leadsToMigrate = newLeads?.filter(l => l.seo_audits && l.seo_audits.length > 0) || [];
        
        if (leadsToMigrate.length === 0) {
            toast.info("No leads to migrate");
            setIsLoading(false);
            return;
        }
        
        const toastId = toast.loading(`Migrating ${leadsToMigrate.length} audited leads to 'Audited' column...`);
        for (const lead of leadsToMigrate) {
            await supabase.from('companies').update({ status: 'Audited' }).eq('id', lead.id);
        }
        toast.success(`Migration complete! Moved ${leadsToMigrate.length} leads.`, { id: toastId });
        loadData();
    };


    const totalPages = Math.ceil(totalCount / pageSize);

    return (
        <div className="flex flex-col gap-10 pb-12 w-full min-w-0 bg-zinc-950 text-zinc-100 font-sans p-8 sm:p-12 min-h-screen">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
                <div className="flex flex-col gap-2">
                    <h1 className="text-4xl sm:text-5xl font-black tracking-tighter uppercase font-heading">
                        Pipeline<span className="text-brand">.</span>
                    </h1>
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand/80 flex items-center gap-3">
                        <span className="h-[1px] w-4 bg-brand/50"></span>
                        COMMAND DASHBOARD
                    </p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <Button className="w-full lg:w-auto font-black uppercase tracking-[0.15em] text-[11px] px-8 shrink-0 bg-brand hover:bg-brand/90 text-zinc-950 h-12 transition-all active:scale-[0.98] shadow-[0_0_20px_rgba(255,102,0,0.15)] hover:shadow-[0_0_30px_rgba(255,102,0,0.25)]">
                        <Plus className="mr-2 h-4 w-4" /> Quick Add
                    </Button>
                </div>
            </div>

            {/* TAB CONTAINER */}
            <div className="flex-1 flex flex-col min-h-[600px] relative">
                {currentTab === "list" ? (
                    <>
                        {/* 1. The Control Bar (Filters) */}
                        <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-4 shrink-0 shadow-lg backdrop-blur-md flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-4 mb-6">
                            <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                                <Input
                                    placeholder="Search leads..."
                                    className="pl-9 h-10 text-sm bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 w-full focus-visible:ring-brand/40"
                                    value={search}
                                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                                />
                            </div>

                            <div className="relative w-full sm:w-[150px]">
                                <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                                <Input
                                    placeholder="City..."
                                    className="pl-9 h-10 text-sm bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 w-full focus-visible:ring-brand/40"
                                    value={city === 'all' ? '' : city}
                                    onChange={e => { setCity(e.target.value || ''); setPage(1); }}
                                />
                            </div>

                            <div className="flex items-center gap-4 bg-zinc-950/60 px-4 py-2 rounded-xl border border-zinc-800 w-full sm:min-w-[220px]">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 shrink-0">Min Score: <span className="text-brand">{minScore[0]}</span></Label>
                                <Slider
                                    min={0} max={20} step={1}
                                    value={minScore}
                                    onValueChange={(v) => { setMinScore(v as number[]); setPage(1); }}
                                    className="w-full flex-1"
                                />
                            </div>

                            <div className="flex items-center space-x-2 w-full sm:w-auto bg-zinc-950/60 px-4 py-2.5 rounded-xl border border-zinc-800">
                                <Checkbox id="req-email" checked={hasEmail} onCheckedChange={(c) => { setHasEmail(c as boolean); setPage(1); }} className="border-zinc-700 data-[state=checked]:bg-brand data-[state=checked]:border-brand" />
                                <Label htmlFor="req-email" className="text-[10px] uppercase font-bold tracking-widest cursor-pointer text-zinc-400">Has Email</Label>
                            </div>

                            <Select value={ratingRange} onValueChange={v => { setRatingRange(v || 'all'); setPage(1); }}>
                                <SelectTrigger className="w-full sm:w-[140px] h-10 text-xs bg-zinc-950 border-zinc-800 text-zinc-300">
                                    <SelectValue placeholder="Rating" />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-300">
                                    <SelectItem value="all">All Ratings</SelectItem>
                                    <SelectItem value="high">4.0 & Up</SelectItem>
                                    <SelectItem value="low">Under 4.0</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Bulk Actions Bar */}
                        {selectedIds.size > 0 && (
                            <div className="bg-brand text-zinc-950 py-3 px-6 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_0_20px_rgba(255,102,0,0.15)] shrink-0 mb-6 animate-in slide-in-from-top-2">
                                <span className="font-black uppercase tracking-[0.1em] text-sm w-full sm:w-auto text-center sm:text-left">{selectedIds.size} Leads Selected</span>
                                <div className="flex items-center gap-3">
                                    <Button variant="outline" size="sm" onClick={handleExportCSV} className="h-9 text-xs font-bold uppercase tracking-widest bg-zinc-950 border-zinc-800 hover:bg-zinc-900 text-zinc-100 hover:text-white transition-all">
                                        <Download className="h-3.5 w-3.5 mr-2" /> Export CSV
                                    </Button>
                                    <Button variant="default" size="sm" onClick={() => openSendSequenceModal()} className="h-9 text-xs bg-zinc-950 hover:bg-zinc-900 text-brand font-black uppercase tracking-widest shadow-none border border-zinc-800 transition-all">
                                        <Send className="h-3.5 w-3.5 mr-2" /> Assign Sequence
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* 2. The Data Table */}
                        <div className="flex-1 border border-zinc-800/80 rounded-2xl bg-zinc-900/40 overflow-hidden flex flex-col min-h-0 relative shadow-xl backdrop-blur-sm">
                            <div className="overflow-auto flex-1 relative [scrollbar-gutter:stable]">
                                <Table className="relative min-w-max w-full">
                                    <TableHeader className="bg-zinc-950/80 sticky top-0 z-10 backdrop-blur-md border-b border-zinc-800">
                                        <TableRow className="border-zinc-800 hover:bg-transparent">
                                            <TableHead className="w-[40px] pl-6 py-4">
                                                <Checkbox checked={selectedIds.size === leads.length && leads.length > 0} onCheckedChange={handleSelectAll} className="border-zinc-700 data-[state=checked]:bg-brand data-[state=checked]:border-brand" />
                                            </TableHead>
                                            <TableHead className="w-[200px] whitespace-nowrap text-[10px] font-black uppercase tracking-widest text-zinc-500 py-4">Business Name</TableHead>
                                            <TableHead className="w-[100px] whitespace-nowrap text-[10px] font-black uppercase tracking-widest text-zinc-500 py-4">City</TableHead>
                                            <TableHead className="w-[80px] text-center whitespace-nowrap text-[10px] font-black uppercase tracking-widest text-zinc-500 py-4">Rating</TableHead>
                                            <TableHead className="w-[180px] whitespace-nowrap text-[10px] font-black uppercase tracking-widest text-zinc-500 py-4">Contact</TableHead>
                                            <TableHead className="w-[100px] text-center whitespace-nowrap text-[10px] font-black uppercase tracking-widest text-zinc-500 py-4">Booking Link</TableHead>
                                            <TableHead className="w-[80px] text-center whitespace-nowrap text-[10px] font-black uppercase tracking-widest text-zinc-500 py-4">Score</TableHead>
                                            <TableHead className="w-[80px] pr-6 text-right text-[10px] font-black uppercase tracking-widest text-zinc-500 py-4">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoading ? (
                                            <TableRow className="border-zinc-800">
                                                <TableCell colSpan={8} className="h-32 text-center text-zinc-500">Loading leads...</TableCell>
                                            </TableRow>
                                        ) : leads.length === 0 ? (
                                            <TableRow className="border-zinc-800">
                                                <TableCell colSpan={8} className="h-32 text-center text-zinc-500">No leads match the current filters.</TableCell>
                                            </TableRow>
                                        ) : leads.map(lead => {
                                            const scoreObj = lead.scores?.[0] || {};
                                            const auditObj = lead.seo_audits?.[0] || {};
                                            const email = lead.contacts?.[0]?.email;

                                            return (
                                                <TableRow key={lead.id} className="cursor-pointer group hover:bg-zinc-800/50 border-zinc-800/50 transition-colors" onClick={() => setActiveLead(lead)}>
                                                    <TableCell className="pl-6" onClick={e => e.stopPropagation()}>
                                                        <Checkbox checked={selectedIds.has(lead.id)} onCheckedChange={c => handleSelectRow(lead.id, c as boolean)} className="border-zinc-700 data-[state=checked]:bg-brand data-[state=checked]:border-brand" />
                                                    </TableCell>
                                                    <TableCell className="font-bold max-w-[200px] text-zinc-200">
                                                        <div className="truncate text-sm uppercase tracking-tight" title={lead.name}>{lead.name}</div>
                                                        {lead.website && (
                                                            <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-[10px] text-brand/80 hover:text-brand flex items-center mt-1 uppercase tracking-widest" onClick={e => e.stopPropagation()}>
                                                                <Globe className="h-3 w-3 mr-1.5 inline" /> Visit Site
                                                            </a>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-xs text-zinc-400 font-medium uppercase tracking-wider truncate max-w-[100px]" title={lead.city}>{lead.city}</TableCell>
                                                    <TableCell className="text-center">
                                                        {lead.rating_avg ? (
                                                            <div className="flex flex-col items-center">
                                                                <span className="text-sm font-black flex items-center text-zinc-200"><Star className="h-3.5 w-3.5 fill-brand text-brand mr-1.5" />{lead.rating_avg}</span>
                                                                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">({lead.rating_count})</span>
                                                            </div>
                                                        ) : <span className="text-xs text-zinc-600">-</span>}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col gap-1.5">
                                                            {email ? <span className="text-[11px] font-medium flex items-center text-zinc-300"><Mail className="h-3.5 w-3.5 mr-2 text-zinc-500" /> <span className="truncate max-w-[140px]" title={email}>{email}</span></span> : <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 border border-zinc-800 px-1.5 py-0.5 rounded bg-zinc-950 w-fit">No Email</span>}
                                                            {lead.phone && <span className="text-[10px] text-zinc-500 font-medium flex items-center"><Phone className="h-3 w-3 mr-2" /> {lead.phone}</span>}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {auditObj.has_booking_link ? (
                                                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 uppercase font-black tracking-widest text-[9px] px-2 py-0.5">Yes</Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30 uppercase font-black tracking-widest text-[9px] px-2 py-0.5">Missing</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Tooltip>
                                                            <TooltipTrigger>
                                                                <div className="cursor-help inline-block">
                                                                    <Badge variant="outline" className={cn("px-2.5 py-1 font-black uppercase tracking-widest text-[10px]", scoreObj.score_overall >= 60 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-zinc-800 text-zinc-300 border-zinc-700")}>
                                                                        {scoreObj.score_overall || 0}/100
                                                                    </Badge>
                                                                </div>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="left" className="p-4 shadow-xl bg-zinc-900 border-zinc-800 rounded-xl">
                                                                <div className="space-y-2 text-xs font-medium">
                                                                    <div className="flex justify-between gap-6"><span className="text-zinc-500 uppercase tracking-widest text-[9px] font-black">Contactability</span> <span className="text-brand font-bold">{scoreObj.score_contactability || 0} pts</span></div>
                                                                    <div className="flex justify-between gap-6"><span className="text-zinc-500 uppercase tracking-widest text-[9px] font-black">SEO Gap</span> <span className="text-brand font-bold">{scoreObj.score_seo || 0} pts</span></div>
                                                                    <div className="flex justify-between gap-6"><span className="text-zinc-500 uppercase tracking-widest text-[9px] font-black">Local Intent</span> <span className="text-brand font-bold">{scoreObj.score_local_intent || 0} pts</span></div>
                                                                    <div className="flex justify-between gap-6"><span className="text-zinc-500 uppercase tracking-widest text-[9px] font-black">Business Fit</span> <span className="text-brand font-bold">{scoreObj.score_fit || 0} pts</span></div>
                                                                    <div className="border-t border-zinc-800 pt-2 mt-2 flex justify-between font-black"><span className="text-zinc-300 uppercase tracking-widest text-[10px]">Total Score</span> <span className="text-emerald-400">{scoreObj.score_overall || 0}/100</span></div>
                                                                </div>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TableCell>
                                                    <TableCell className="pr-6 text-right">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-brand/10 hover:text-brand text-zinc-400 rounded-lg" onClick={(e) => { e.stopPropagation(); openSendSequenceModal(lead); }} title="Assign Outreach Sequence">
                                                            <Send className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination Controls */}
                            <div className="flex items-center justify-between px-6 py-4 bg-zinc-950/80 border-t border-zinc-800 shrink-0 backdrop-blur-md">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                                    Showing {leads.length > 0 ? (page - 1) * pageSize + 1 : 0} to {Math.min(page * pageSize, totalCount)} of <span className="text-brand font-black">{totalCount}</span> leads
                                </div>
                                <div className="flex items-center gap-3">
                                    <Button variant="outline" size="sm" className="h-8 text-[10px] font-black uppercase tracking-widest px-3 bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all" disabled={page === 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-3.5 w-3.5 mr-1" /> Prev</Button>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300 w-12 text-center">{page} / {totalPages || 1}</span>
                                    <Button variant="outline" size="sm" className="h-8 text-[10px] font-black uppercase tracking-widest px-3 bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next <ChevronRight className="h-3.5 w-3.5 ml-1" /></Button>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    /* ====== KANBAN TAB ====== */
                    <div className="flex-1 flex gap-6 overflow-x-auto overflow-y-hidden pb-6 [scrollbar-width:thin] scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
                            {KANBAN_STAGES.map(stage => {
                                const stageLeads = pipelineLeads
                                    .filter(l => l.status === stage || (!l.status && stage === 'New'))
                                    .sort((a, b) => {
                                        const scoreA = a.scores?.[0]?.score_overall ?? 0;
                                        const scoreB = b.scores?.[0]?.score_overall ?? 0;
                                        return scoreB - scoreA; // Highest score (best lead) at the top
                                    });
                                return <KanbanColumn key={stage} stage={stage} leads={stageLeads} onOpenLead={setActiveLead} />
                            })}
                        </DndContext>
                    </div>
                )}
            </div>

            {/* SEND SEQUENCE MODAL */}
            <Dialog open={isSendModalOpen} onOpenChange={setIsSendModalOpen}>
                <DialogContent className="sm:max-w-[600px] bg-zinc-950 border-zinc-800 text-zinc-100 rounded-2xl shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                            <Send className="h-5 w-5 text-brand" /> Assign Sequence
                        </DialogTitle>
                        <DialogDescription className="text-zinc-500 text-sm mt-2">
                            Preparing to email <strong className="text-brand font-black">{targetLeads.length}</strong> selected lead{targetLeads.length === 1 ? '' : 's'}. Our backend will automatically inject the `[business_name]`, `[city]`, and `[booking_link]` tokens.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-6 space-y-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Hormozi-Style Template</Label>
                            <Select value={selectedTemplate as string} onValueChange={(v) => handleTemplateChange(v || '')}>
                                <SelectTrigger className="bg-zinc-900 border-zinc-700 h-12 text-zinc-100 font-medium">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                                    {Object.keys(TEMPLATES).map(key => (
                                        <SelectItem key={key} value={key} className="focus:bg-zinc-800 focus:text-brand">{key}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Subject Line</Label>
                            <Input 
                                value={emailSubject} 
                                onChange={e => setEmailSubject(e.target.value)} 
                                className="bg-zinc-900 border-zinc-700 h-10 text-zinc-100 focus-visible:ring-brand/40"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Email Body (Raw Token Template)</Label>
                            <Textarea
                                className="h-[240px] text-sm font-mono bg-zinc-950 border-zinc-800 text-zinc-300 focus-visible:ring-brand/40 resize-none p-4"
                                value={emailBody}
                                onChange={e => setEmailBody(e.target.value)}
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-3 sm:gap-0">
                        <Button variant="outline" onClick={() => setIsSendModalOpen(false)} className="bg-transparent border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 font-bold uppercase tracking-widest text-[10px]">Cancel</Button>
                        <Button onClick={handleSendSequence} className="bg-brand hover:bg-brand/90 text-zinc-950 font-black uppercase tracking-widest text-[10px] shadow-[0_0_15px_rgba(255,102,0,0.2)]">
                            <Send className="mr-2 h-3.5 w-3.5" /> Dispatch Flow
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 3. The Right-Side Drawer (Lead Profile) */}
            <Sheet open={!!activeLead} onOpenChange={(o) => { if (!o) setActiveLead(null) }}>
                <SheetContent side="right" className="!w-[90vw] sm:!w-[50vw] sm:!max-w-[50vw] overflow-y-auto p-0 bg-zinc-950 border-l border-zinc-800">
                    {activeLead && (
                        <div className="flex flex-col h-full bg-zinc-900 relative">
                            <div className="absolute top-0 right-0 p-8 opacity-5 overflow-hidden pointer-events-none">
                                <Building2 className="h-48 w-48 text-brand rotate-12" />
                            </div>
                            
                            <div className="px-8 py-8 bg-zinc-950 border-b border-zinc-800 sticky top-0 z-10 shadow-lg shrink-0">
                                <Badge variant="outline" className="mb-4 bg-zinc-900 border-zinc-700 text-zinc-300 font-black uppercase tracking-widest text-[9px] px-2 py-0.5">{activeLead.status || 'New'}</Badge>
                                <SheetTitle className="text-3xl font-black uppercase tracking-tighter leading-tight text-white p-0">{activeLead.name}</SheetTitle>
                                <SheetDescription className="mt-3 flex flex-col sm:flex-row sm:items-center text-xs font-medium uppercase tracking-widest text-zinc-500 gap-3 sm:gap-5">
                                    <span className="flex items-center"><MapPin className="h-4 w-4 mr-2 text-brand/70" /> {activeLead.address}, {activeLead.city}</span>
                                    {activeLead.niche && <span className="flex items-center text-zinc-400"><Building2 className="h-4 w-4 mr-2 text-brand/70" /> {activeLead.niche}</span>}
                                    {activeLead.website && (
                                        <a href={activeLead.website.startsWith('http') ? activeLead.website : `https://${activeLead.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-zinc-400 hover:text-brand transition-colors cursor-pointer group">
                                            <Globe className="h-4 w-4 text-brand group-hover:scale-110 transition-transform" />
                                            <span className="border-b border-transparent group-hover:border-brand/50 lowercase tracking-normal">{activeLead.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</span>
                                        </a>
                                    )}
                                </SheetDescription>

                                <div className="mt-6 flex gap-3">
                                    {activeLead.status !== 'Booked' && activeLead.status !== 'Closed' && (
                                        <Button size="sm" onClick={() => openSendSequenceModal(activeLead)} className="flex-1 bg-brand hover:bg-brand/90 text-zinc-950 font-black uppercase tracking-widest text-[10px] h-10 shadow-[0_0_20px_rgba(255,102,0,0.15)]"><Send className="h-4 w-4 mr-2" /> Assign Sequence</Button>
                                    )}
                                    {activeLead.website && (
                                        <a href={activeLead.website} target="_blank" rel="noopener noreferrer">
                                            <Button variant="outline" size="sm" className="px-4 h-10 bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all" type="button">
                                                <Globe className="h-4 w-4" />
                                            </Button>
                                        </a>
                                    )}
                                </div>
                            </div>

                            <div className="p-8 space-y-8 flex-1 overflow-y-auto">
                                {/* Engagement History */}
                                {activeLead.outreach_messages && activeLead.outreach_messages.length > 0 && (
                                    <div className="bg-blue-950/20 rounded-2xl border border-blue-900/30 shadow-md overflow-hidden backdrop-blur-sm">
                                        <div className="bg-blue-950/40 px-5 py-3 border-b border-blue-900/30 flex items-center gap-3">
                                            <Send className="h-4 w-4 text-brand" />
                                            <h3 className="font-black text-[11px] uppercase tracking-widest text-blue-200">Engagement History</h3>
                                        </div>
                                        <div className="p-5 space-y-4 print-exact">
                                            {activeLead.outreach_messages.map((msg: Record<string, any>, i: number) => (
                                                <div key={i} className="bg-zinc-950/60 p-4 rounded-xl border border-zinc-800 text-sm shadow-sm space-y-3">
                                                    <div className="flex justify-between items-start">
                                                        <span className="font-bold text-zinc-200 uppercase tracking-tight">{msg.sequence_name} <span className="text-[10px] text-zinc-500 font-bold ml-2">(Step {msg.step})</span></span>
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{new Date(msg.sent_at).toLocaleDateString()}</span>
                                                    </div>
                                                    <p className="text-xs text-zinc-400 line-clamp-2 italic border-l-2 border-zinc-800 pl-3 py-1">&quot;{msg.subject}&quot;</p>

                                                    <div className="flex items-center gap-5 pt-3 border-t border-zinc-800/60 mt-2 text-[10px] font-black uppercase tracking-widest">
                                                        <span className={`flex items-center gap-2 ${msg.open_count > 0 ? 'text-emerald-400' : 'text-zinc-600'}`}><CheckCircle2 className="h-3.5 w-3.5" /> Opens: {msg.open_count}</span>
                                                        <span className={`flex items-center gap-2 ${msg.click_count > 0 ? 'text-blue-400' : 'text-zinc-600'}`}><Globe className="h-3.5 w-3.5" /> Clicks: {msg.click_count}</span>
                                                        <span className={`flex items-center gap-2 ${msg.reply_flag ? 'text-brand' : 'text-zinc-600'}`}><Mail className="h-3.5 w-3.5" /> Replies: {msg.reply_flag ? 'Yes' : 'No'}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Details Card */}
                                <div className="bg-zinc-950/40 rounded-2xl border border-zinc-800 shadow-xl overflow-hidden backdrop-blur-sm">
                                    <div className="bg-zinc-900/60 px-5 py-3 border-b border-zinc-800">
                                        <h3 className="font-black text-[11px] uppercase tracking-[0.2em] text-zinc-300">Contact Details</h3>
                                    </div>
                                    <div className="p-5 space-y-5 text-sm">
                                        <div className="flex gap-4">
                                            <Mail className="h-4 w-4 text-zinc-500 shrink-0 mt-0.5" />
                                            <div className="flex-1">
                                                {activeLead.contacts?.length > 0 ? (
                                                    <div className="space-y-2">
                                                        {activeLead.contacts.map((c: Record<string, any>, i: number) => (
                                                            <div key={i} className="flex justify-between items-center bg-zinc-900 px-3 py-2 rounded-lg border border-zinc-800">
                                                                <span className="font-medium text-zinc-200">{c.email}</span>
                                                                <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest bg-zinc-950 border-zinc-700 text-zinc-400">{c.type}</Badge>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : <span className="text-zinc-500 italic text-[11px] font-bold uppercase tracking-widest">No emails found</span>}
                                            </div>
                                        </div>
                                        <div className="flex gap-4 items-center">
                                            <Phone className="h-4 w-4 text-zinc-500 shrink-0" />
                                            <span className="text-zinc-200 font-medium">{activeLead.phone || <span className="text-zinc-500 italic text-[11px] font-bold uppercase tracking-widest">No phone number</span>}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* SEO Audit Highlights */}
                                <div className="bg-zinc-950/40 rounded-2xl border border-zinc-800 shadow-xl overflow-hidden backdrop-blur-sm">
                                    <div className="bg-zinc-900/60 px-5 py-3 border-b border-zinc-800 flex justify-between items-center">
                                        <h3 className="font-black text-[11px] uppercase tracking-[0.2em] text-zinc-300">SEO Audit Highlights</h3>
                                        <Badge variant="outline" className={cn("text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5", activeLead.scores?.[0]?.score_overall >= 60 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-zinc-800 border-zinc-700 text-zinc-400")}>
                                            {activeLead.scores?.[0]?.score_overall || 0}/100
                                        </Badge>
                                    </div>
                                    <div className="p-5 space-y-3">
                                        {(() => {
                                            const audit = activeLead.seo_audits?.[0] || {};
                                            const issues = [
                                                { label: "Valid Title Tag", ok: audit.has_title && audit.title_len >= 10, msg: audit.has_title ? `Length: ${audit.title_len}` : "Missing" },
                                                { label: "H1 Tag Present", ok: audit.has_h1, msg: audit.has_h1 ? "Found" : "Missing" },
                                                { label: "Booking/Pricing Link", ok: audit.has_booking_link, msg: audit.has_booking_link ? "Found" : "Missing" },
                                                { label: "Schema.org Data", ok: audit.schema_org_types?.length > 0, msg: audit.schema_org_types?.length > 0 ? "Present" : "Missing" }
                                            ];

                                            return issues.map((issue, idx) => (
                                                <div key={idx} className="flex items-center justify-between bg-zinc-900 px-4 py-3 rounded-xl border border-zinc-800 text-sm">
                                                    <span className="font-bold uppercase tracking-tight text-[11px] text-zinc-300">{issue.label}</span>
                                                    <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest">
                                                        <span className="text-zinc-500">{issue.msg}</span>
                                                        {issue.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-red-400" />}
                                                    </div>
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                </div>

                                {/* PageSpeed Insights */}
                                <div className="bg-zinc-950/40 rounded-2xl border border-zinc-800 shadow-xl overflow-hidden backdrop-blur-sm">
                                    <div className="bg-zinc-900/60 px-5 py-3 border-b border-zinc-800 flex justify-between items-center">
                                        <h3 className="font-black text-[11px] uppercase tracking-[0.2em] text-zinc-300">Core Web Vitals</h3>
                                        {activeLead.seo_audits?.[0]?.pagespeed_mobile === undefined && (
                                            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-zinc-950 border border-zinc-800/80 shadow-inner">
                                                <Loader2 className="h-3 w-3 text-brand animate-spin" />
                                                <span className="text-[9px] uppercase tracking-widest font-black text-zinc-500">Fetching</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {/* Mobile */}
                                        <div className="flex items-center justify-between bg-zinc-900 px-4 py-3 rounded-xl border border-zinc-800 text-sm hover:border-brand/30 transition-colors">
                                            <span className="font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2 text-[11px]"><Smartphone className="h-4 w-4 text-brand" /> Mobile Score</span>
                                            <div className="flex items-center gap-2">
                                                {activeLead.seo_audits?.[0]?.pagespeed_mobile !== undefined ? (
                                                    activeLead.seo_audits[0].pagespeed_mobile !== null ? (
                                                        <span className={cn("text-lg font-black italic", activeLead.seo_audits[0].pagespeed_mobile >= 90 ? "text-emerald-500" : activeLead.seo_audits[0].pagespeed_mobile >= 50 ? "text-amber-500" : "text-rose-500")}>
                                                            {activeLead.seo_audits[0].pagespeed_mobile}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">N/A</span>
                                                    )
                                                ) : (
                                                    <div className="h-5 w-8 bg-zinc-800 animate-pulse rounded"></div>
                                                )}
                                            </div>
                                        </div>
                                        {/* Desktop */}
                                        <div className="flex items-center justify-between bg-zinc-900 px-4 py-3 rounded-xl border border-zinc-800 text-sm hover:border-brand/30 transition-colors">
                                            <span className="font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2 text-[11px]"><Monitor className="h-4 w-4 text-brand" /> Desktop Score</span>
                                            <div className="flex items-center gap-2">
                                                {activeLead.seo_audits?.[0]?.pagespeed_desktop !== undefined ? (
                                                    activeLead.seo_audits[0].pagespeed_desktop !== null ? (
                                                        <span className={cn("text-lg font-black italic", activeLead.seo_audits[0].pagespeed_desktop >= 90 ? "text-emerald-500" : activeLead.seo_audits[0].pagespeed_desktop >= 50 ? "text-amber-500" : "text-rose-500")}>
                                                            {activeLead.seo_audits[0].pagespeed_desktop}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">N/A</span>
                                                    )
                                                ) : (
                                                    <div className="h-5 w-8 bg-zinc-800 animate-pulse rounded"></div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Fetch Logs */}
                                <div className="bg-zinc-950 text-zinc-300 rounded-2xl border border-zinc-800 shadow-xl overflow-hidden">
                                    <div className="bg-zinc-900/80 px-5 py-3 border-b border-zinc-800 flex items-center gap-3">
                                        <FileJson className="h-4 w-4 text-brand" />
                                        <h3 className="font-black text-[11px] uppercase tracking-widest text-zinc-400">Scraper Raw Output</h3>
                                    </div>
                                    <div className="p-5 bg-zinc-950 overflow-x-auto [scrollbar-width:thin] scrollbar-thumb-zinc-800">
                                        <pre className="text-[10px] leading-relaxed font-mono text-zinc-500">
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
