"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, MapPin, Building2, Download, Send, AlertCircle, ExternalLink, ChevronDown, ChevronRight, Mail, Globe, CheckCircle2, XCircle, Eye, Instagram, Activity, Code2, Terminal, Clock, Link as LinkIcon, TrendingUp, Phone, MessageSquare, Users, PenLine, Save, Wand2, Sparkles, Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { useLeadStore, Lead } from "@/store/leadStore";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn, normalizeQueryKey } from "@/lib/utils";
import { insertLead, runLocalSeoAudit, updateLeadManualData, updateLeadStatus } from "@/app/actions/leads";
import { generateOutreachSuggestions } from "@/app/actions/ai";
import { Textarea } from "@/components/ui/textarea";
import { searchGooglePlaces, getCityAutocomplete, getAllSourcedLeads } from "@/app/actions/search";
import { useEffect, Fragment } from "react";
import type { EnrichmentData, ScoreBreakdown } from "@/lib/scraper";

export default function LeadFinder() {
    const [niche, setNiche] = useState("");
    const [city, setCity] = useState("");
    const [citySearchTerm, setCitySearchTerm] = useState("");
    const [citySuggestions, setCitySuggestions] = useState<{ id: string, description: string }[]>([]);
    const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
    const [isSearchingCity, setIsSearchingCity] = useState(false);

    const [isSearching, setIsSearching] = useState(false);
    const [results, setResults] = useState<Record<string, any>[]>([]);

    // Filters
    const [minScore, setMinScore] = useState([0]); // Default to 0 so unaudited leads show up
    const [requireEmail, setRequireEmail] = useState(false);
    const [ratingFilter, setRatingFilter] = useState("all");

    // Selection & Auditing
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [auditedLeads, setAuditedLeads] = useState<Record<string, any>>({});
    const [isAuditing, setIsAuditing] = useState<Record<string, boolean>>({});

    // Pagination State
    const [activeTokens, setActiveTokens] = useState<Record<string, string | null>>({});
    const [isLoadingMore, setIsLoadingMore] = useState<Record<string, boolean>>({});

    // Enrichment Drawer State
    const [drawerLead, setDrawerLead] = useState<Record<string, any> | null>(null);

    // Manual Audit State
    const [manualNotes, setManualNotes] = useState('');
    const [igFollowers, setIgFollowers] = useState('');
    const [igActivity, setIgActivity] = useState('');
    const [manualEmail, setManualEmail] = useState('');
    const [manualPhone, setManualPhone] = useState('');
    const [isSavingManual, setIsSavingManual] = useState(false);

    // Reachout AI State
    const [reachoutLead, setReachoutLead] = useState<Record<string, any> | null>(null);
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState<any>(null);
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [activeReachoutTab, setActiveReachoutTab] = useState('email');

    // Collapsible Groups State
    const [toggledGroups, setToggledGroups] = useState<Record<string, boolean>>({});

    const isGroupExpanded = (groupName: string, index: number) => {
        if (toggledGroups[groupName] !== undefined) return toggledGroups[groupName];
        return index === 0;
    };

    const toggleGroup = (groupName: string, index: number) => {
        setToggledGroups(prev => ({ ...prev, [groupName]: !isGroupExpanded(groupName, index) }));
    };

    // Initial State Hydration
    const [isLoadingInitial, setIsLoadingInitial] = useState(true);

    useEffect(() => {
        const fetchInitialState = async () => {
            setIsLoadingInitial(true);
            const { data, activeTokens: fetchedTokens, auditedLeads: dbAuditedLeads } = await getAllSourcedLeads();

            if (data && data.length > 0) {
                console.log(`[LeadFinder] Restoring ${Object.keys(dbAuditedLeads || {}).length} audited leads from DB...`);
                setResults(data);
                if (fetchedTokens) setActiveTokens(fetchedTokens);
                if (dbAuditedLeads) setAuditedLeads(dbAuditedLeads);

                // Set default display values if available
                if (data[0]?.city) setCity(data[0].city);
                if (data[0]?.niche) setNiche(data[0].niche);
            }
            setIsLoadingInitial(false);
        };
        fetchInitialState();
    }, []);

    // Fetch City Suggestions
    const handleCitySearch = async (term: string) => {
        setCitySearchTerm(term);
        if (term.length < 2) {
            setCitySuggestions([]);
            return;
        }

        setIsSearchingCity(true);
        const { data } = await getCityAutocomplete(term);
        if (data) setCitySuggestions(data);
        setIsSearchingCity(false);
    };

    const { leads, addLead } = useLeadStore();

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!niche || !city) {
            toast.error("Please enter both a niche and a city.");
            return;
        }

        setIsSearching(true);
        toast.info("Scraping in progress... this may take a few seconds.");

        const result = await searchGooglePlaces(niche, city);

        if (result?.error) {
            toast.error(result.error);
        } else if (result?.data) {
            const { data, nextPageToken, auditedLeads: fetchedAuditedLeads } = result;
            const queryStr = normalizeQueryKey(niche, city);
            setActiveTokens(prev => ({ ...prev, [queryStr]: nextPageToken || null }));
            
            if (fetchedAuditedLeads) {
                setAuditedLeads(prev => ({ ...prev, ...fetchedAuditedLeads }));
            }

            // Append new results to master list, removing duplicates
            setResults(prev => {
                const combined = [...data, ...prev];
                const seen = new Set();
                return combined.filter(item => {
                    const isDuplicate = seen.has(item.id);
                    seen.add(item.id);
                    return !isDuplicate;
                });
            });
            setSelectedIds(new Set());
            setMinScore([0]); // Reset score filter to see new results
            toast.success(`Found ${data.length} businesses. Master list updated.`);
        }
        setIsSearching(false);
    };

    const handleLoadMore = async (targetNiche: string, targetCity: string, token: string) => {
        const queryStr = normalizeQueryKey(targetNiche, targetCity);
        setIsLoadingMore(prev => ({ ...prev, [queryStr]: true }));
        toast.info("Fetching next batch of 20 leads...");

        const result = await searchGooglePlaces(targetNiche, targetCity, token);

        if (result?.error) {
            toast.error(result.error);
        } else if (result?.data) {
            const { data, nextPageToken, auditedLeads: fetchedAuditedLeads } = result;
            setActiveTokens(prev => ({ ...prev, [queryStr]: nextPageToken || null }));
            
            if (fetchedAuditedLeads) {
                setAuditedLeads(prev => ({ ...prev, ...fetchedAuditedLeads }));
            }

            setResults(prev => {
                const combined = [...data, ...prev];
                const seen = new Set();
                return combined.filter(item => {
                    const isDuplicate = seen.has(item.id);
                    seen.add(item.id);
                    return !isDuplicate;
                });
            });
            toast.success(`Successfully fetched ${data.length} more leads!`);
        }
        setIsLoadingMore(prev => ({ ...prev, [queryStr]: false }));
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const allIds = groupedResultsArray.flatMap(g => g.groupLeads.map(r => r.id));
            setSelectedIds(new Set(allIds));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSelectRow = (id: string, checked: boolean) => {
        const newSet = new Set(selectedIds);
        if (checked) newSet.add(id);
        else newSet.delete(id);
        setSelectedIds(newSet);
    };

    const handleRunAudit = async (lead: Record<string, any>) => {
        // If already audited, just open the drawer
        const auditData = auditedLeads[lead.id];
        if (auditData) {
            setDrawerLead({ ...lead, auditData });
            return;
        }

        setIsAuditing(prev => ({ ...prev, [lead.id]: true }));
        const { data, error } = await runLocalSeoAudit(
            lead.website, 
            lead.city, 
            lead.niche, 
            lead.ratingCount,
            {
                name: lead.name,
                address: lead.address,
                phone: lead.phone,
                reviewCount: lead.ratingCount,
                googlePlaceId: lead.id
            }
        );
        setIsAuditing(prev => ({ ...prev, [lead.id]: false }));

        if (data) {
            setAuditedLeads(prev => ({ ...prev, [lead.id]: data }));
            toast.success(`Audit complete for ${lead.name}`);
        } else {
            toast.error(`Audit failed: ${error}`);
        }
    };

    const handleBulkAudit = async () => {
        const selectedLeads = results.filter(r => selectedIds.has(r.id) && !auditedLeads[r.id] && !isAuditing[r.id]);
        if (selectedLeads.length === 0) {
            toast.info("No unaudited leads selected.");
            return;
        }

        toast.info(`Auditing ${selectedLeads.length} leads... this will take a moment.`);

        for (const lead of selectedLeads) {
            setIsAuditing(prev => ({ ...prev, [lead.id]: true }));
            const { data } = await runLocalSeoAudit(
                lead.website, 
                lead.city, 
                lead.niche, 
                lead.ratingCount,
                {
                    name: lead.name,
                    address: lead.address,
                    phone: lead.phone,
                    reviewCount: lead.ratingCount,
                    googlePlaceId: lead.id
                }
            );
            setIsAuditing(prev => ({ ...prev, [lead.id]: false }));
            if (data) {
                setAuditedLeads(prev => ({ ...prev, [lead.id]: data }));
            }
        }
        toast.success("Bulk audit complete!");
    };

    const handleBulkPipeline = async () => {
        const selectedLeads = results.filter(r => selectedIds.has(r.id));
        if (selectedLeads.length === 0) return;

        const toastId = toast.loading(`Adding ${selectedLeads.length} leads to pipeline...`);
        let successCount = 0;

        for (const business of selectedLeads) {
            if (leads.some(l => l.name === business.name)) continue;

            const auditData = auditedLeads[business.id];

            const result = await insertLead({
                name: business.name,
                address: business.address,
                city: business.city,
                niche: business.niche,
                phone: business.phone,
                website: business.website,
                reviewCount: business.ratingCount
            }, auditData?.rawScrape);

            if (!result.error && result.data) {
                successCount++;
                const dbCompany = result.data.company;
                const newLead: Lead = {
                    id: dbCompany.id,
                    name: dbCompany.name,
                    address: `${dbCompany.address}, ${dbCompany.city}`,
                    phone: dbCompany.phone,
                    website: dbCompany.website,
                    email: auditData?.email || '',
                    score: auditData?.score || 0,
                    biggestWeakness: auditData?.biggestWeakness || '',
                    status: dbCompany.status as any,
                    createdAt: dbCompany.created_at,
                    workspaceId: dbCompany.workspace_id,
                };
                addLead(newLead);
            }
        }

        toast.success(`Successfully added ${successCount} leads to pipeline!`, { id: toastId });
        setSelectedIds(new Set());
    };

    const handleExportCSV = () => {
        const selectedLeads = results.filter(r => selectedIds.has(r.id));
        if (selectedLeads.length === 0) return;

        const headers = ["Business Name", "City", "Rating", "Email", "SEO Score", "Weakness", "Booking Detected", "Website", "Phone"];
        const rows = selectedLeads.map(l => {
            const auditData = auditedLeads[l.id];
            return [
                `"${l.name}"`,
                `"${l.city}"`,
                l.rating,
                `"${auditData?.email || ''}"`,
                auditData?.score || 0,
                `"${auditData?.biggestWeakness || ''}"`,
                auditData?.bookingDetected ? "Yes" : "No",
                `"${l.website}"`,
                `"${l.phone}"`
            ];
        });

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `fadeaway_leads_${city}_${niche}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        toast.success("CSV Exported successfully.");
    };

    const groupedResultsArray = useMemo(() => {
        const uniqueGroups = Array.from(new Set(results.map(r => `${r.niche || 'Other'} in ${r.city || 'Unknown City'}`)));

        return uniqueGroups.map(groupName => {
            let groupLeads = results.filter(r => `${r.niche || 'Other'} in ${r.city || 'Unknown City'}` === groupName);
            groupLeads = groupLeads.filter(r => {
                const auditData = auditedLeads[r.id];
                if (minScore[0] > 0 && (!auditData || auditData.score < minScore[0])) return false;
                if (requireEmail && (!auditData || !auditData.email || auditData.email.trim() === '')) return false;
                if (ratingFilter === "high" && r.rating < 4.0) return false;
                if (ratingFilter === "low" && r.rating >= 4.0) return false;
                return true;
            });
            groupLeads.sort((a, b) => (b.ratingCount || 0) - (a.ratingCount || 0));
            return { groupName, groupLeads };
        }).filter(g => g.groupLeads.length > 0);
    }, [results, minScore, requireEmail, ratingFilter, auditedLeads]);

    const filteredResultsCount = groupedResultsArray.reduce((sum, g) => sum + g.groupLeads.length, 0);

    return (
        <div className="flex flex-col gap-10 pb-12 w-full min-w-0 bg-zinc-950 text-zinc-100 font-sans p-8 sm:p-12 min-h-screen">
            <div className="flex flex-col gap-2">
                <h1 className="text-4xl sm:text-5xl font-black tracking-tighter uppercase font-heading">
                    Lead Finder<span className="text-brand">.</span>
                </h1>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand/80 flex items-center gap-3">
                    <span className="h-[1px] w-4 bg-brand/50"></span>
                    SOURCED LEADS ENGINE
                </p>
            </div>

            <Card className="rounded-2xl border border-zinc-800/50 bg-zinc-900/40 p-1 shadow-sm backdrop-blur-sm overflow-visible isolate">
                <CardHeader className="pb-4">
                    <CardTitle className="text-sm font-bold uppercase tracking-[0.1em] text-zinc-400">Search Parameters</CardTitle>
                    <CardDescription className="text-zinc-500 text-xs">Enter a Niche and City to scrape Google and instantly add fresh businesses into your Inbox.</CardDescription>
                </CardHeader>
                <CardContent className="overflow-visible">
                    <form onSubmit={handleSearch} className="flex flex-col lg:flex-row gap-4 items-start lg:items-end w-full min-w-0">
                        <div className="grid gap-2 w-full lg:flex-1 min-w-0">
                            <Label htmlFor="niche" className="font-semibold text-foreground/80">Business Niche</Label>
                            <div className="relative w-full">
                                <Building2 className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="niche"
                                    placeholder="e.g. Plumber, Roofing, Dentist"
                                    className="pl-9 bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 w-full autofill:shadow-[0_0_0_30px_#09090b_inset] [selection:color:white] autofill:[-webkit-text-fill-color:white] autofill:text-zinc-100"
                                    value={niche}
                                    onChange={(e) => setNiche(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="grid gap-2 w-full lg:flex-1 min-w-0 relative">
                            <Label htmlFor="city" className="font-bold text-[10px] uppercase tracking-widest text-zinc-500">Target City</Label>
                            <div className="relative w-full">
                                <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500 z-10" />
                                <Input
                                    id="city"
                                    placeholder="e.g. Seattle, Toronto..."
                                    className="pl-9 bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 w-full focus-visible:ring-brand/50 autofill:shadow-[0_0_0_30px_#09090b_inset] [selection:color:white] autofill:[-webkit-text-fill-color:white] autofill:text-zinc-100"
                                    value={citySearchTerm}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        handleCitySearch(val);
                                        if (val.length >= 2) {
                                            setIsCityDropdownOpen(true);
                                        } else {
                                            setIsCityDropdownOpen(false);
                                        }
                                    }}
                                    onFocus={() => {
                                        if (citySearchTerm.length >= 2) {
                                            setIsCityDropdownOpen(true);
                                        }
                                    }}
                                    onBlur={() => {
                                        // Delay closing to allow clicking suggestions
                                        setTimeout(() => setIsCityDropdownOpen(false), 200);
                                    }}
                                    autoComplete="off"
                                />

                                {isCityDropdownOpen && citySearchTerm.length >= 2 && (
                                    <div className="absolute top-[calc(100%+4px)] left-0 w-full z-[100] bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl animate-in fade-in duration-200">
                                        <Command shouldFilter={false} className="bg-zinc-900">
                                            <CommandList>
                                                <CommandEmpty className="text-zinc-500 py-4 text-center text-xs">
                                                    {isSearchingCity ? (
                                                        <div className="flex items-center justify-center gap-2">
                                                            <Loader2 className="h-3 w-3 animate-spin text-brand" />
                                                            <span>Searching Maps...</span>
                                                        </div>
                                                    ) : "No city found."}
                                                </CommandEmpty>
                                                {citySuggestions.length > 0 && (
                                                    <CommandGroup heading="Suggestions" className="text-zinc-500 px-2 pt-2">
                                                        {citySuggestions.map((suggestion) => (
                                                            <CommandItem
                                                                key={suggestion.id}
                                                                value={suggestion.description}
                                                                className="text-zinc-300 aria-selected:bg-brand/10 aria-selected:text-brand cursor-pointer rounded-lg mb-1 transition-colors"
                                                                onSelect={() => {
                                                                    setCity(suggestion.description);
                                                                    setCitySearchTerm(suggestion.description);
                                                                    setIsCityDropdownOpen(false);
                                                                }}
                                                            >
                                                                <div className="flex items-center gap-2 py-1">
                                                                    <MapPin className="h-3 w-3 opacity-50" />
                                                                    <span className="text-sm">{suggestion.description}</span>
                                                                </div>
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                )}
                                            </CommandList>
                                        </Command>
                                    </div>
                                )}
                            </div>
                        </div>
                        <Button 
                            type="submit" 
                            disabled={isSearching || isLoadingInitial} 
                            className="w-full lg:w-auto font-black uppercase tracking-widest text-[10px] px-8 shrink-0 bg-brand hover:bg-brand/90 text-zinc-950 h-10 transition-all active:scale-95 shadow-[0_0_15px_rgba(255,102,0,0.2)]"
                        >
                            {isSearching ? (
                                <Fragment>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Scraping...
                                </Fragment>
                            ) : isLoadingInitial ? (
                                <Fragment>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Loading...
                                </Fragment>
                            ) : (
                                <Fragment>
                                    <Search className="h-4 w-4 mr-2" />
                                    Run Fast Search
                                </Fragment>
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {results.length > 0 && (
                <div className="space-y-4 animate-in fade-in duration-500">
                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-[1px] bg-zinc-800"></div>
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-brand/80">
                            Inbox: <span className="text-white">{filteredResultsCount}</span> Master Leads
                        </h3>
                        <div className="flex-1 h-[1px] bg-zinc-800"></div>
                    </div>

                    {/* Filters Bar */}
                    {/* Filters Bar - Hidden for Phase 1 as per user request */}
                    {/* <Card className="min-w-0 w-full overflow-hidden border-zinc-800 bg-zinc-900/20">
                        <CardContent className="p-4 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-6 border-b border-zinc-800 min-w-0 w-full">
...
                        </CardContent>
                    </Card> */}


                    {/* Dense Data Table */}
                    <div className="space-y-12">
                        {filteredResultsCount === 0 ? (
                            <div className="h-48 flex flex-col items-center justify-center border border-zinc-800 border-dashed rounded-3xl text-zinc-500 gap-2">
                                <AlertCircle className="h-6 w-6 opacity-20" />
                                <p className="text-xs font-bold uppercase tracking-widest opacity-40">No leads match the current filters.</p>
                            </div>
                        ) : (
                            groupedResultsArray.map(({ groupName, groupLeads }, groupIndex) => {
                                const expanded = isGroupExpanded(groupName, groupIndex);

                                return (
                                    <div key={groupName} className="space-y-6">
                                        <div 
                                            className="flex items-center gap-4 cursor-pointer group/header select-none"
                                            onClick={() => toggleGroup(groupName, groupIndex)}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className={cn(
                                                    "p-1 rounded-md bg-zinc-900 border border-zinc-700/50 group-hover/header:border-brand/50 transition-all",
                                                    expanded && "border-brand/30"
                                                )}>
                                                    {expanded ? <ChevronDown className="h-4 w-4 text-brand" /> : <ChevronRight className="h-4 w-4 text-zinc-500" />}
                                                </div>
                                                <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-100 group-hover/header:text-brand transition-colors">
                                                    {groupName}
                                                </h4>
                                                <Badge variant="outline" className="bg-brand/5 border-brand/20 text-brand text-[9px] font-black tracking-widest px-2.5 h-6 rounded-full shadow-[0_0_10px_rgba(255,102,0,0.1)]">
                                                    {groupLeads.length} DEPOSITED
                                                </Badge>
                                            </div>
                                            <div className="flex-1 h-[2px] bg-gradient-to-r from-zinc-800 to-transparent"></div>
                                        </div>

                                        {expanded && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                                                {groupLeads.map((result: any) => {
                                                    const auditData = auditedLeads[result.id];
                                                    const inPipeline = leads.some(l => l.name === result.name);

                                                    return (
                                                        <div 
                                                            key={result.id}
                                                            className={cn(
                                                                "relative group cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]",
                                                                inPipeline && "opacity-[0.6] grayscale-[0.5]"
                                                            )}
                                                            onClick={() => setDrawerLead({ ...result, auditData })}
                                                        >
                                                            <Card className="h-full rounded-2xl border border-zinc-800/80 bg-zinc-950/40 p-5 shadow-2xl backdrop-blur-md group-hover:border-brand/40 group-hover:bg-zinc-900/40 group-hover:shadow-[0_0_30px_rgba(255,102,0,0.03)] transition-all duration-300 isolate">
                                                                <div className="flex flex-col h-full gap-4">
                                                                    <div className="flex justify-between items-start gap-3">
                                                                        <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 group-hover:border-brand/20 transition-colors">
                                                                            <Building2 className="h-4 w-4 text-brand" />
                                                                        </div>
                                                                        <div className="flex items-center gap-2 bg-zinc-950/60 border border-zinc-800/80 px-2.5 py-1.5 rounded-xl group-hover:border-brand/30 transition-all shadow-inner">
                                                                            <div className="flex items-center gap-1">
                                                                                <Star className="h-3 w-3 text-brand fill-brand" />
                                                                                <span className="text-[11px] font-black text-zinc-100">{result.rating || '0.0'}</span>
                                                                            </div>
                                                                            <div className="w-[1px] h-3 bg-zinc-800"></div>
                                                                            <div className="flex flex-col leading-none">
                                                                                <span className="text-[10px] font-black text-brand tracking-tight">
                                                                                    {result.ratingCount || 0}
                                                                                </span>
                                                                                <span className="text-[7px] font-bold text-zinc-500 uppercase tracking-widest">
                                                                                    Reviews
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    <div className="space-y-1.5 flex-1">
                                                                        <h3 className="text-[17px] font-sans font-bold tracking-tight leading-snug uppercase line-clamp-2 text-zinc-100 group-hover:text-white transition-colors">
                                                                            {result.name}
                                                                        </h3>
                                                                        <div className="flex items-center gap-1.5 text-zinc-400 text-[10px] font-bold uppercase tracking-widest">
                                                                            <MapPin className="h-3 w-3 shrink-0 text-zinc-500" />
                                                                            <span className="truncate">{result.city}</span>
                                                                        </div>
                                                                    </div>

                                                                    <div className="mt-auto pt-4 border-t border-zinc-800/50 flex items-center justify-between">
                                                                        <div className="flex -space-x-2">
                                                                            {result.website && (
                                                                                <div className="h-6 w-6 rounded-full bg-zinc-800 border-2 border-zinc-900 flex items-center justify-center" title="Website Available">
                                                                                    <Globe className="h-3 w-3 text-blue-400" />
                                                                                </div>
                                                                            )}
                                                                            {result.phone && (
                                                                                <div className="h-6 w-6 rounded-full bg-zinc-800 border-2 border-zinc-900 flex items-center justify-center" title="Phone Available">
                                                                                    <Phone className="h-3 w-3 text-emerald-400" />
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-brand transition-colors flex items-center gap-1">
                                                                            {inPipeline ? 'In Pipeline' : 'View Intel'}
                                                                            <ChevronRight className="h-3 w-3" />
                                                                        </div>
                                                                    </div>

                                                                </div>
                                                            </Card>
                                                        </div>
                                                    );
                                                })}

                                                {(() => {
                                                    const targetNiche = groupLeads[0]?.niche || niche;
                                                    const targetCity = groupLeads[0]?.city || city;
                                                    const queryStr = normalizeQueryKey(targetNiche, targetCity);
                                                    const hasToken = activeTokens[queryStr];
                                                    const isLoading = isLoadingMore[queryStr];

                                                    if (hasToken) {
                                                        return (
                                                            <div className="md:col-span-2 lg:col-span-3 xl:col-span-4 py-8 flex flex-col items-center justify-center gap-4">
                                                                <Button
                                                                    variant="outline"
                                                                    onClick={() => handleLoadMore(targetNiche, targetCity, hasToken)}
                                                                    disabled={isLoading}
                                                                    className="rounded-xl border-dashed border-2 border-zinc-800 bg-transparent hover:bg-zinc-900 hover:border-brand/40 text-zinc-500 hover:text-white transition-all px-10 h-14"
                                                                >
                                                                    {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <TrendingUp className="h-4 w-4 mr-2" />}
                                                                    <span className="font-black uppercase tracking-widest text-xs">
                                                                        {isLoading ? 'Fetching Leads...' : 'Dig Deeper: Load 20 More Leads'}
                                                                    </span>
                                                                </Button>
                                                                <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-zinc-700">More undiscovered successful businesses found</p>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
            {/* Enrichment Data Drawer */}
            <Sheet open={!!drawerLead} onOpenChange={(o) => { if (!o) setDrawerLead(null); }}>
                <SheetContent side="right" className="!w-[90vw] sm:!w-[50vw] sm:!max-w-[50vw] overflow-y-hidden p-0 max-h-screen">
                    {drawerLead && (() => {
                        const audit = drawerLead.auditData;
                        const enrichment: EnrichmentData | undefined = audit?.rawScrape?.enrichment;

                        return (
                            <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 w-full overflow-hidden focus-visible:outline-none">
                                {/* Header */}
                                <div className="px-6 py-8 border-b border-zinc-900 shrink-0 bg-zinc-950 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-[0.05]">
                                        <Building2 className="h-32 w-32 text-brand rotate-12" />
                                    </div>
                                    <div className="relative z-10 flex flex-col gap-2">
                                        <div className="flex items-center gap-3">
                                            <span className="h-[1px] w-4 bg-brand/50"></span>
                                            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand/80">Business Intelligence</span>
                                        </div>
                                        <SheetTitle className="text-3xl font-heading font-black tracking-tighter text-white uppercase leading-tight">{drawerLead.name}</SheetTitle>
                                        <SheetDescription className="flex flex-wrap items-center text-zinc-500 text-xs font-bold uppercase tracking-widest gap-4 mt-1">
                                            <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-brand" /> {drawerLead.city}</span>
                                            {drawerLead.niche && <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-brand" />{drawerLead.niche}</span>}
                                        </SheetDescription>
                                        <div className="flex items-center gap-2 mt-6">
                                            <div className="flex items-center gap-2 bg-brand/10 border border-brand/20 px-3 py-1.5 rounded-xl">
                                                <Star className="h-4 w-4 text-brand fill-brand" />
                                                <span className="text-sm font-black text-brand italic">{drawerLead.rating}</span>
                                                <span className="text-[10px] text-brand/60 font-bold uppercase tracking-tighter">({drawerLead.ratingCount} reviews)</span>
                                            </div>
                                            {audit?.rawScrape?.scoreBreakdown ? (() => {
                                                const sb: ScoreBreakdown = audit.rawScrape.scoreBreakdown;
                                                return <span className="font-bold text-white flex items-center gap-1.5 text-sm"><Activity className="h-4 w-4 text-emerald-400"/> Score: {sb.total}/100</span>;
                                            })() : audit?.score !== undefined && (
                                                <span className="font-bold text-white flex items-center gap-1.5 text-sm"><Activity className="h-4 w-4 text-emerald-400"/> Score: {audit.score}/100</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto w-full p-6 space-y-8 bg-zinc-950/50">
                                    {!enrichment ? (
                                        <div className="flex flex-col items-center justify-center p-12 rounded-3xl border border-zinc-800 border-dashed bg-zinc-900/20 text-zinc-500 gap-4">
                                            <div className="h-16 w-16 bg-zinc-900 rounded-2xl flex items-center justify-center border border-zinc-800 shadow-xl group">
                                                <Search className="h-8 w-8 text-zinc-700 group-hover:text-brand transition-colors" />
                                            </div>
                                            <div className="text-center space-y-1">
                                                <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">No Deep Intel Available</p>
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Run an AI audit to extract technical gaps and contacts.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Business Hub */}
                                            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 hover:shadow-md transition-shadow relative overflow-hidden group">
                                                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-bl-full -mr-4 -mt-4 transition-transform duration-500 group-hover:scale-110"></div>
                                                <div className="flex items-center gap-2 mb-4 relative z-10">
                                                    <div className="h-8 w-8 rounded-full bg-indigo-50 flex items-center justify-center border border-indigo-100"><Globe className="h-4 w-4 text-indigo-500"/></div>
                                                    <h3 className="font-bold text-slate-800 text-base">Business Intelligence</h3>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3 relative z-10">
                                                    {drawerLead.website ? (
                                                        <a href={drawerLead.website.startsWith('http') ? drawerLead.website : `https://${drawerLead.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border hover:bg-white hover:shadow-sm hover:border-blue-200 transition-all group/link">
                                                            <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-100 group-hover/link:bg-blue-50 transition-colors"><Globe className="h-4 w-4 text-blue-500 group-hover/link:scale-110 transition-transform" /></div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Website</p>
                                                                <p className="text-sm font-semibold text-slate-800 truncate">{drawerLead.website}</p>
                                                            </div>
                                                        </a>
                                                    ) : (
                                                        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border opacity-60"><Globe className="h-4 w-4 text-slate-400" /><span className="text-sm font-medium text-slate-500">No Website</span></div>
                                                    )}
                                                    
                                                    {enrichment.contacts.emails.length > 0 ? (
                                                        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border group/link hover:bg-white hover:shadow-sm hover:border-amber-200 transition-all">
                                                            <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-100 group-hover/link:bg-amber-50 transition-colors"><Mail className="h-4 w-4 text-amber-500 group-hover/link:scale-110 transition-transform" /></div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Email Match</p>
                                                                <p className="text-sm font-semibold text-slate-800 truncate" title={enrichment.contacts.emails[0].email}>{enrichment.contacts.emails[0].email}</p>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border opacity-60"><Mail className="h-4 w-4 text-slate-400" /><span className="text-sm font-medium text-slate-500">No Email</span></div>
                                                    )}

                                                    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border group/link hover:bg-white hover:shadow-sm hover:border-emerald-200 transition-all">
                                                        <div className="bg-white p-2 text-emerald-500 rounded-lg shadow-sm border border-slate-100 group-hover/link:bg-emerald-50 transition-colors flex justify-center items-center"><Phone className="h-4 w-4 group-hover/link:scale-110 transition-transform"/></div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Phone Link</p>
                                                            <p className="text-sm font-semibold text-slate-800 truncate">{enrichment.contacts.hasPhone ? 'Detected via href:tel' : 'Not linked on site'}</p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border">
                                                        <div className="min-w-0">
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1.5 ml-1">Social Footprint</p>
                                                            <div className="flex items-center gap-2">
                                                                {enrichment?.socials?.instagram ? <a href={enrichment.socials.instagram.url} target="_blank" rel="noreferrer" className="bg-white p-1.5 rounded-lg shadow-sm border hover:scale-110 transition-transform hover:border-pink-300 group/soc"><Instagram className="h-4 w-4 text-pink-500 group-hover/soc:fill-pink-50"/></a> : null}
                                                                {enrichment?.socials?.facebook ? <a href={enrichment.socials.facebook.url} target="_blank" rel="noreferrer" className="bg-white px-2 py-1 rounded-lg text-blue-600 font-bold shadow-sm border hover:scale-110 transition-transform hover:border-blue-400 hover:bg-blue-50 text-[12px] leading-none">f</a> : null}
                                                                {enrichment?.socials?.tiktok ? <a href={enrichment.socials.tiktok.url} target="_blank" rel="noreferrer" className="bg-white px-2 py-1 rounded-lg text-slate-900 font-black shadow-sm border hover:scale-110 transition-transform hover:border-slate-800 hover:bg-slate-50 text-[12px] leading-none">d</a> : null}
                                                                {(!enrichment?.socials?.instagram && !enrichment?.socials?.facebook && !enrichment?.socials?.tiktok) && <span className="text-xs font-medium text-slate-400 ml-1">None found</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* AI Score Full Width */}
                                            {audit?.rawScrape?.scoreBreakdown && (() => {
                                                const sb: ScoreBreakdown = audit.rawScrape.scoreBreakdown;
                                                const categories = [
                                                    { label: 'UX Decay & Tech', score: sb.uxDecayTechnical, max: 45, from: 'from-rose-400', to: 'to-rose-500', icon: '🚨', bg: 'bg-rose-50/50', border: 'border-rose-100/50' },
                                                    { label: 'Maturity & Cash', score: sb.cashFlowMaturity, max: 30, from: 'from-blue-400', to: 'to-indigo-500', icon: '💼', bg: 'bg-indigo-50/50', border: 'border-indigo-100/50' },
                                                    { label: 'Contact Access', score: sb.contactability, max: 25, from: 'from-emerald-400', to: 'to-teal-500', icon: '📞', bg: 'bg-emerald-50/50', border: 'border-emerald-100/50' },
                                                ];
                                                return (
                                                    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden relative group">
                                                        <div className="p-5 flex flex-col gap-4 relative z-10">
                                                            <h3 className="font-bold text-slate-800 flex items-center gap-2"><Activity className="h-4 w-4 text-indigo-500" /> AI Score Breakdown <span className="ml-auto bg-slate-100 text-slate-800 text-xs px-2 py-0.5 rounded font-bold border border-slate-200">{sb.total}/100</span></h3>
                                                            
                                                            <div className="grid grid-cols-3 gap-3">
                                                                {categories.map((cat, i) => (
                                                                    <div key={i} className={`flex flex-col gap-2.5 p-3.5 ${cat.bg} rounded-xl border ${cat.border} shadow-[inset_0_1px_2px_rgba(255,255,255,0.5)]`}>
                                                                        <div className="flex justify-between items-center text-sm">
                                                                            <span className="font-semibold text-slate-800 flex items-center gap-1.5 tracking-tight"><span className="text-sm leading-none">{cat.icon}</span> {cat.label}</span>
                                                                            <span className="font-bold text-slate-900 text-xs">{cat.score || 0}<span className="text-slate-400 font-medium">/{cat.max}</span></span>
                                                                        </div>
                                                                        <div className="h-2 bg-slate-200/50 rounded-full w-full overflow-hidden">
                                                                            <div
                                                                                className={`h-full bg-gradient-to-r ${cat.from} ${cat.to} rounded-full transition-all duration-1000`}
                                                                                style={{ width: `${Math.min((cat.score || 0) / cat.max, 1) * 100}%` }}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>

                                                            {sb.rulesTriggered && sb.rulesTriggered.length > 0 && (
                                                                <div className="mt-2 pt-4 border-t border-slate-100">
                                                                    <div className="flex flex-wrap gap-1.5">
                                                                        {sb.rulesTriggered.map((rule: string, i: number) => (
                                                                            <span key={i} className="text-[10px] font-semibold px-2 py-1 bg-rose-50 text-rose-600 rounded-md border border-rose-100/50 flex items-center gap-1">
                                                                                <AlertCircle className="h-3 w-3" /> {rule}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* AI Audit Detailed Results in 2-Column Grid */}
                                            <div className="grid grid-cols-2 gap-4 pb-8">
                                                <div className="bg-white flex flex-col rounded-2xl border border-slate-200/60 shadow-sm p-5 hover:shadow-md transition-all relative overflow-hidden group">
                                                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50/50 rounded-bl-[100px] -mr-4 -mt-4 transition-transform duration-500 group-hover:scale-[1.3]"></div>
                                                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 relative z-10"><Code2 className="h-4 w-4 text-blue-500" /> Technical SEO</h3>
                                                    <div className="space-y-1.5 relative z-10 flex-1">
                                                        {[
                                                            { label: 'Title Tag', ok: !enrichment.seo.titleTag.isEmpty },
                                                            { label: 'H1 Header', ok: enrichment.seo.h1Tags.count > 0 },
                                                            { label: 'Meta Desc', ok: enrichment.seo.metaDescription.exists },
                                                            { label: 'Mobile Viewport', ok: enrichment.seo.hasViewport },
                                                            { label: 'NoIndex (Flaw)', ok: !enrichment.seo.hasNoIndex },
                                                        ].map((item, idx) => (
                                                            <div key={idx} className="flex items-center justify-between bg-slate-50/50 px-3 py-2 rounded-lg text-sm border border-slate-100/50">
                                                                <span className="font-medium text-slate-600 text-[12px]">{item.label}</span>
                                                                {item.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <XCircle className="h-3.5 w-3.5 text-rose-500" />}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="flex flex-col gap-4">
                                                    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 hover:shadow-md transition-all relative overflow-hidden group">
                                                        <div className="absolute top-0 right-0 w-20 h-20 bg-purple-50/50 rounded-bl-[100px] -mr-4 -mt-4 transition-transform duration-500 group-hover:scale-[1.3]"></div>
                                                        <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2 relative z-10"><Terminal className="h-4 w-4 text-purple-500" /> Tracking Pixels</h3>
                                                        <div className="space-y-1.5 relative z-10">
                                                            <div className="flex items-center justify-between bg-slate-50/50 px-3 py-2 rounded-lg text-sm border border-slate-100/50">
                                                                <span className="font-medium text-slate-600 text-[12px] flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> Meta Pixel</span>
                                                                {enrichment?.pixels?.hasMetaPixel ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <XCircle className="h-3.5 w-3.5 text-slate-300" />}
                                                            </div>
                                                            <div className="flex items-center justify-between bg-slate-50/50 px-3 py-2 rounded-lg text-sm border border-slate-100/50">
                                                                <span className="font-medium text-slate-600 text-[12px] flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div> Google Ads</span>
                                                                {enrichment?.pixels?.hasGoogleAds ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <XCircle className="h-3.5 w-3.5 text-slate-300" />}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 hover:shadow-md transition-all relative overflow-hidden group flex-1">
                                                        <div className="absolute top-0 right-0 w-20 h-20 bg-amber-50/50 rounded-bl-[100px] -mr-4 -mt-4 transition-transform duration-500 group-hover:scale-[1.3]"></div>
                                                        <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2 relative z-10"><LinkIcon className="h-4 w-4 text-amber-500" /> Conversion Funnel</h3>
                                                        <div className="space-y-2 relative z-10">
                                                            <div className="flex items-center justify-between bg-slate-50/50 px-3 py-2 rounded-lg text-sm border border-slate-100/50">
                                                                <span className="font-medium text-slate-600 text-[12px]">General CTA Found</span>
                                                                {enrichment?.ctas?.hasGeneralCTA ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <XCircle className="h-3.5 w-3.5 text-rose-500" />}
                                                            </div>
                                                            {enrichment?.ctas?.bookingUrls?.length > 0 && (
                                                                <div className="mt-2 space-y-1">
                                                                    {(enrichment?.ctas?.bookingUrls || []).map((b: any, i: number) => (
                                                                        <a key={i} href={b.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-slate-50/50 p-1.5 rounded-lg border border-slate-100/50 hover:border-blue-200 hover:bg-white transition-colors">
                                                                            <Badge variant="secondary" className="text-[9px] bg-slate-200 text-slate-700 pointer-events-none px-1.5 py-0 h-4 border-none">{b.platform}</Badge>
                                                                            <span className="text-[11px] text-blue-600 truncate max-w-[110px] font-medium">{b.url}</span>
                                                                        </a>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="bg-white flex flex-col rounded-2xl border border-slate-200/60 shadow-sm p-5 hover:shadow-md transition-all relative overflow-hidden group">
                                                    <div className="absolute top-0 left-0 w-24 h-24 bg-rose-50/50 rounded-br-[100px] -ml-4 -mt-4 transition-transform duration-500 group-hover:scale-[1.3]"></div>
                                                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 relative z-10"><Clock className="h-4 w-4 text-rose-500" /> UX Decay Factors</h3>
                                                    <div className="space-y-2 relative z-10 flex-1">
                                                        <div className="flex items-center justify-between bg-slate-50/50 px-3 py-3 rounded-lg text-sm border border-slate-100/50">
                                                            <span className="font-medium text-slate-600 text-[12px]">Copyright ({enrichment?.uxDecay?.copyrightYear || 'N/A'})</span>
                                                            {enrichment?.uxDecay?.isOutdatedCopyright ? <Badge variant="destructive" className="bg-rose-100 text-rose-700 shadow-none border border-rose-200 text-[10px] px-1.5 py-0 h-4 uppercase tracking-wider">Outdated</Badge> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                                                        </div>
                                                        <div className="flex items-center justify-between bg-slate-50/50 px-3 py-3 rounded-lg text-sm border border-slate-100/50">
                                                            <span className="font-medium text-slate-600 text-[12px]">Cheap Web Builder</span>
                                                            {enrichment?.uxDecay?.usesCheapBuilder ? <Badge variant="destructive" className="bg-rose-100 text-rose-700 shadow-none border border-rose-200 text-[10px] px-1.5 py-0 h-4 uppercase tracking-wider">Detected</Badge> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="bg-white flex flex-col rounded-2xl border border-slate-200/60 shadow-sm p-5 hover:shadow-md transition-all relative overflow-hidden group">
                                                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50/50 rounded-bl-[100px] -mr-4 -mt-4 transition-transform duration-500 group-hover:scale-[1.3]"></div>
                                                    <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2 relative z-10"><TrendingUp className="h-4 w-4 text-emerald-500" /> Keywords</h3>
                                                    <div className="flex flex-wrap gap-1.5 relative z-10 content-start flex-1">
                                                        {enrichment?.expansionKeywords?.length > 0 ? (
                                                            (enrichment?.expansionKeywords || []).map((kw: string, i: number) => (
                                                                <span key={i} className="px-2.5 py-1 bg-emerald-50/80 text-emerald-700 text-[10px] font-bold uppercase tracking-wider rounded-md border border-emerald-100/60">{kw}</span>
                                                            ))
                                                        ) : (
                                                            <span className="text-xs text-slate-400 italic">None detected</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Manual Audit Section */}
                                            <div className="bg-white rounded-2xl border-2 border-dashed border-indigo-200 shadow-sm p-5 relative overflow-hidden group hover:border-indigo-300 transition-colors">
                                                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/30 rounded-bl-full -mr-6 -mt-6"></div>
                                                <div className="flex items-center gap-2 mb-5 relative z-10">
                                                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center border border-indigo-200"><PenLine className="h-4 w-4 text-indigo-600"/></div>
                                                    <h3 className="font-bold text-slate-800 text-base">Manual Audit</h3>
                                                    <Badge variant="outline" className="ml-auto text-[10px] uppercase tracking-wider font-bold text-indigo-500 border-indigo-200 bg-indigo-50">Your Notes</Badge>
                                                </div>

                                                <div className="space-y-4 relative z-10">
                                                    {/* Notes */}
                                                    <div>
                                                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><MessageSquare className="h-3 w-3" /> Audit Comments</label>
                                                        <Textarea
                                                            placeholder="Add your manual audit notes here... (pain points, observations, pitch angles)"
                                                            className="min-h-[80px] text-sm bg-slate-50/50 border-slate-200 focus:border-indigo-300 focus:ring-indigo-200 rounded-xl resize-none"
                                                            value={manualNotes}
                                                            onChange={(e) => setManualNotes(e.target.value)}
                                                        />
                                                    </div>

                                                    {/* IG Metrics */}
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><Instagram className="h-3 w-3 text-pink-500" /> IG Followers</label>
                                                            <Input
                                                                type="number"
                                                                placeholder="e.g. 5200"
                                                                className="h-9 text-sm bg-slate-50/50 rounded-lg"
                                                                value={igFollowers}
                                                                onChange={(e) => setIgFollowers(e.target.value)}
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><Users className="h-3 w-3 text-purple-500" /> Activity Level</label>
                                                            <Select value={igActivity} onValueChange={(val) => setIgActivity(val || '')}>
                                                                <SelectTrigger className="h-9 text-sm bg-slate-50/50 rounded-lg">
                                                                    <SelectValue placeholder="Select..." />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="very_active">🟢 Very Active</SelectItem>
                                                                    <SelectItem value="mid_active">🟡 Mid Active</SelectItem>
                                                                    <SelectItem value="low_active">🟠 Low Active</SelectItem>
                                                                    <SelectItem value="not_active">🔴 Not Active</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>

                                                    {/* Manual Contact */}
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><Mail className="h-3 w-3 text-amber-500" /> Add Email</label>
                                                            <Input
                                                                type="email"
                                                                placeholder="name@company.com"
                                                                className="h-9 text-sm bg-slate-50/50 rounded-lg"
                                                                value={manualEmail}
                                                                onChange={(e) => setManualEmail(e.target.value)}
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><Phone className="h-3 w-3 text-emerald-500" /> Add Phone</label>
                                                            <Input
                                                                type="tel"
                                                                placeholder="+1 (555) 000-0000"
                                                                className="h-9 text-sm bg-slate-50/50 rounded-lg"
                                                                value={manualPhone}
                                                                onChange={(e) => setManualPhone(e.target.value)}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Save Button */}
                                                    <Button
                                                        className="w-full h-10 font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 shadow-md rounded-xl border-0 transition-all"
                                                        disabled={isSavingManual}
                                                        onClick={async () => {
                                                            if (!drawerLead?.auditData?.companyId && !drawerLead?.companyId) {
                                                                toast.error('No company ID found. Run an audit first to save this lead.');
                                                                return;
                                                            }
                                                            setIsSavingManual(true);
                                                            try {
                                                                const companyId = drawerLead.auditData?.companyId || drawerLead.companyId;
                                                                const result = await updateLeadManualData(companyId, {
                                                                    manual_notes: manualNotes || undefined,
                                                                    ig_followers: igFollowers ? parseInt(igFollowers) : null,
                                                                    ig_activity: igActivity || null,
                                                                    manual_email: manualEmail || undefined,
                                                                    manual_phone: manualPhone || undefined,
                                                                });
                                                                if (result.error) {
                                                                    toast.error(result.error);
                                                                } else {
                                                                    toast.success('Manual audit data saved!');
                                                                    
                                                                    const updatedEmail = manualEmail || drawerLead.auditData?.email || drawerLead.email;
                                                                    const updatedPhone = manualPhone || drawerLead.phone;
                                                                    
                                                                    // Update Drawer Lead
                                                                    setDrawerLead({
                                                                        ...drawerLead,
                                                                        manual_notes: manualNotes,
                                                                        ig_followers: igFollowers ? parseInt(igFollowers) : null,
                                                                        ig_activity: igActivity,
                                                                        email: updatedEmail,
                                                                        phone: updatedPhone,
                                                                        auditData: {
                                                                            ...(drawerLead?.auditData || {}),
                                                                            email: updatedEmail
                                                                        }
                                                                    });

                                                                    // Update Global Lists
                                                                    setResults(prev => prev.map(r => r.id === drawerLead.id ? {
                                                                        ...r,
                                                                        manual_notes: manualNotes,
                                                                        ig_followers: igFollowers ? parseInt(igFollowers) : null,
                                                                        ig_activity: igActivity,
                                                                        email: updatedEmail,
                                                                        phone: updatedPhone,
                                                                    } : r));

                                                                    if (drawerLead.auditData || auditedLeads[drawerLead.id]) {
                                                                        setAuditedLeads(prev => ({
                                                                            ...prev,
                                                                            [drawerLead.id]: {
                                                                                ...(prev[drawerLead.id] || drawerLead.auditData || {}),
                                                                                email: updatedEmail
                                                                            }
                                                                        }));
                                                                    }
                                                                }
                                                            } catch (err) {
                                                                toast.error('Failed to save manual data');
                                                            } finally {
                                                                setIsSavingManual(false);
                                                            }
                                                        }}
                                                    >
                                                        {isSavingManual ? (
                                                            <><div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" /> Saving...</>
                                                        ) : (
                                                            <><Save className="h-4 w-4 mr-2" /> Save Manual Audit Data</>
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })()}
                </SheetContent>
            </Sheet>

            {/* AI Reachout Modal */}
            <Dialog open={!!reachoutLead} onOpenChange={(o) => { if (!o) setReachoutLead(null); }}>
                <DialogContent className="sm:max-w-[700px] bg-slate-50 border-slate-200 shadow-2xl p-0 overflow-hidden rounded-2xl">
                    <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 p-6 text-white relative">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-bl-full -mr-4 -mt-4"></div>
                        <DialogTitle className="text-2xl font-black flex items-center gap-2 relative z-10">
                            <Sparkles className="h-6 w-6 text-yellow-300" /> AI Outreach Pitch
                        </DialogTitle>
                        <DialogDescription className="text-white/80 mt-1 relative z-10 text-sm font-medium">
                            Tailored email sequence for {reachoutLead?.name} based on audit data.
                        </DialogDescription>
                    </div>

                    <div className="p-6 overflow-y-auto max-h-[70vh]">
                        {isGeneratingAI ? (
                            <div className="py-20 flex flex-col items-center justify-center text-center">
                                <Loader2 className="h-10 w-10 text-indigo-500 animate-spin mb-4" />
                                <h3 className="text-lg font-bold text-slate-800">Generating hyper-personalized pitch...</h3>
                                <p className="text-sm text-slate-500">Analyzing audit data, manual notes, and finding pain points.</p>
                            </div>
                        ) : aiSuggestions ? (
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                        <h4 className="font-bold text-indigo-700 text-sm mb-2 flex items-center gap-1.5"><Search className="h-4 w-4"/> Key Findings</h4>
                                        <ul className="text-xs text-slate-600 space-y-2 list-disc pl-4">
                                            {aiSuggestions.keyFindings?.map((f: string, i: number) => <li key={i}>{f}</li>)}
                                        </ul>
                                    </div>
                                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                        <h4 className="font-bold text-rose-600 text-sm mb-2 flex items-center gap-1.5"><AlertCircle className="h-4 w-4"/> Pain Points</h4>
                                        <ul className="text-xs text-slate-600 space-y-2 list-disc pl-4">
                                            {aiSuggestions.painPoints?.map((p: string, i: number) => <li key={i}>{p}</li>)}
                                        </ul>
                                    </div>
                                </div>

                                <Tabs defaultValue="email" className="w-full" onValueChange={setActiveReachoutTab}>
                                    <TabsList className="grid grid-cols-2 mb-6 bg-slate-200/50 p-1 rounded-xl">
                                        <TabsTrigger value="email" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-indigo-600 shadow-none">
                                            <Mail className="h-4 w-4 mr-2" /> Email Pitch
                                        </TabsTrigger>
                                        <TabsTrigger value="dm" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-pink-600 shadow-none">
                                            <Instagram className="h-4 w-4 mr-2" /> Instagram DM
                                        </TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="email" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <div>
                                            <label className="text-xs font-bold text-slate-700 mb-1.5 block">Subject Line</label>
                                            <Input 
                                                value={aiSuggestions.subjectLine} 
                                                onChange={(e) => setAiSuggestions({...aiSuggestions, subjectLine: e.target.value})}
                                                className="font-medium bg-white border-slate-300"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-700 mb-1.5 block flex justify-between">
                                                Email Body
                                                <span className="text-indigo-500 text-[10px] font-normal uppercase tracking-wider">Supports Markdown</span>
                                            </label>
                                            <Textarea 
                                                value={aiSuggestions.emailBody} 
                                                onChange={(e) => setAiSuggestions({...aiSuggestions, emailBody: e.target.value})}
                                                className="min-h-[200px] text-sm leading-relaxed bg-white border-slate-300 resize-y"
                                            />
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="dm" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <div>
                                            <label className="text-xs font-bold text-slate-700 mb-1.5 block flex justify-between">
                                                Instagram Direct Message
                                                <span className="text-pink-500 text-[10px] font-normal uppercase tracking-wider">Punchy & Short</span>
                                            </label>
                                            <Textarea 
                                                value={aiSuggestions.dmBody} 
                                                onChange={(e) => setAiSuggestions({...aiSuggestions, dmBody: e.target.value})}
                                                className="min-h-[150px] text-sm leading-relaxed bg-white border-slate-300 resize-y"
                                            />
                                        </div>
                                        <div className="p-3 bg-amber-50 rounded-lg border border-amber-100 flex items-start gap-2">
                                            <Activity className="h-4 w-4 text-amber-500 mt-0.5" />
                                            <p className="text-[11px] text-amber-700 leading-normal">
                                                <strong>Tip:</strong> DMs work best when sent directly from your mobile app. Copy this suggestion and paste it into Instagram!
                                            </p>
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </div>
                        ) : null}
                    </div>

                    <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-between items-center">
                        <span className="text-xs text-slate-500 font-medium px-2">
                            To: <span className="font-bold text-slate-800">{reachoutLead?.auditData?.email || reachoutLead?.email || 'No email found'}</span>
                        </span>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setReachoutLead(null)} className="h-10 px-5">Cancel</Button>
                            {activeReachoutTab === 'email' ? (
                                <Button 
                                    className="h-10 px-6 font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md border-0"
                                    disabled={isGeneratingAI || !aiSuggestions || isSendingEmail || (!reachoutLead?.auditData?.email && !reachoutLead?.email)}
                                    onClick={async () => {
                                        const emailToSend = reachoutLead?.auditData?.email || reachoutLead?.email;
                                        const companyId = reachoutLead?.auditData?.companyId || reachoutLead?.companyId;

                                        if (!emailToSend || !companyId) {
                                            toast.error("Missing email or company ID");
                                            return;
                                        }

                                        setIsSendingEmail(true);
                                        try {
                                            const res = await fetch('/api/automations/resend', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    companyId: companyId,
                                                    contactEmail: emailToSend,
                                                    sequenceName: "AI Manual Pitch",
                                                    subject: aiSuggestions.subjectLine,
                                                    rawBodyTemplate: aiSuggestions.emailBody
                                                })
                                            });

                                            const data = await res.json();
                                            if (data.error) throw new Error(data.error);

                                            toast.success("Email dispatched via Resend!");
                                            setReachoutLead(null);
                                            
                                            // Persist status to DB
                                            await updateLeadStatus(companyId, 'Contacted');

                                            // Update local status so UI reflects 'Contacted'
                                            const newResults = results.map(r => r.id === (reachoutLead?.id || '') ? { ...r, status: 'Contacted' } : r);
                                            setResults(newResults);
                                        } catch (e: any) {
                                            toast.error(e.message || "Failed to send email");
                                        } finally {
                                            setIsSendingEmail(false);
                                        }
                                    }}
                                >
                                    {isSendingEmail ? (
                                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Dispatching...</>
                                    ) : (
                                        <><Send className="h-4 w-4 mr-2" /> Send Dispatch</>
                                    )}
                                </Button>
                            ) : (
                                <Button 
                                    className="h-10 px-6 font-bold text-white bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 shadow-md border-0"
                                    disabled={isGeneratingAI || !aiSuggestions}
                                    onClick={async () => {
                                        navigator.clipboard.writeText(aiSuggestions.dmBody);
                                        toast.success("DM copied to clipboard!");
                                        setReachoutLead(null);
                                    }}
                                >
                                    <Download className="h-4 w-4 mr-2" /> Copy DM
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
