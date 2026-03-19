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
import { Search, MapPin, Building2, Download, Send, AlertCircle, ExternalLink, ChevronDown, ChevronRight, Mail, Globe, CheckCircle2, XCircle, Eye, Instagram, Activity, Code2, Terminal, Clock, Link as LinkIcon, TrendingUp, Phone, MessageSquare, Users, PenLine, Save, Wand2, Sparkles, Loader2 } from "lucide-react";
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
        <div className="flex flex-col gap-6 pb-12 w-full min-w-0">
            <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Lead Finder (SEO Auditor)</h1>
                <p className="text-sm md:text-base text-muted-foreground mt-2">
                    Hunt down highly successful local businesses that have massive digital and SEO gaps.
                </p>
            </div>

            <Card className="border-primary/10 bg-primary/5">
                <CardHeader className="pb-4">
                    <CardTitle>Sourced Leads Engine</CardTitle>
                    <CardDescription>Enter a Niche and City to scrape Google and instantly add fresh businesses into your Inbox.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSearch} className="flex flex-col lg:flex-row gap-4 items-start lg:items-end w-full min-w-0">
                        <div className="grid gap-2 w-full lg:flex-1 min-w-0">
                            <Label htmlFor="niche" className="font-semibold text-foreground/80">Business Niche</Label>
                            <div className="relative w-full">
                                <Building2 className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="niche"
                                    placeholder="e.g. Plumber, Roofing, Dentist"
                                    className="pl-9 bg-background w-full"
                                    value={niche}
                                    onChange={(e) => setNiche(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="grid gap-2 w-full lg:flex-1 min-w-0">
                            <Label htmlFor="city" className="font-semibold text-foreground/80">Target City</Label>
                            <Popover open={isCityDropdownOpen} onOpenChange={setIsCityDropdownOpen}>
                                <PopoverTrigger render={
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={isCityDropdownOpen}
                                        className={cn(
                                            "w-full justify-between pl-3 font-normal bg-background",
                                            !city && "text-muted-foreground"
                                        )}
                                    >
                                        <div className="flex items-center truncate">
                                            <MapPin className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
                                            <span className="truncate">{city || "e.g. Seattle, Toronto..."}</span>
                                        </div>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                } />
                                <PopoverContent className="w-[300px] p-0" align="start">
                                    <Command shouldFilter={false}>
                                        <CommandInput
                                            placeholder="Search a city..."
                                            value={citySearchTerm}
                                            onValueChange={handleCitySearch}
                                        />
                                        <CommandList>
                                            <CommandEmpty>
                                                {isSearchingCity ? "Searching Maps..." : "No city found."}
                                            </CommandEmpty>
                                            <CommandGroup>
                                                {citySuggestions.map((suggestion) => (
                                                    <CommandItem
                                                        key={suggestion.id}
                                                        value={suggestion.description}
                                                        onSelect={(currentValue) => {
                                                            setCity(suggestion.description);
                                                            setCitySearchTerm(suggestion.description);
                                                            setIsCityDropdownOpen(false);
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4 shrink-0",
                                                                city === suggestion.description ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        {suggestion.description}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                        <Button type="submit" disabled={isSearching || isLoadingInitial} className="w-full lg:w-auto font-medium px-8 shrink-0">
                            {isSearching ? (
                                <>
                                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                    Scraping...
                                </>
                            ) : isLoadingInitial ? (
                                <>
                                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                    Loading...
                                </>
                            ) : (
                                <>
                                    <Search className="h-4 w-4 mr-2" />
                                    Run Fast Search
                                </>
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {results.length > 0 && (
                <div className="space-y-4 animate-in fade-in duration-500">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="text-lg font-medium text-foreground/80">
                            Inbox contains <span className="font-bold text-foreground">{filteredResultsCount}</span> Master Leads
                        </h3>
                    </div>

                    {/* Filters Bar */}
                    <Card className="min-w-0 w-full overflow-hidden">
                        <CardContent className="p-4 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-6 bg-slate-50 border-b min-w-0 w-full">
                            <div className="flex flex-col gap-2 w-full sm:flex-1 min-w-[200px]">
                                <div className="flex justify-between w-full">
                                    <Label className="text-xs font-semibold text-muted-foreground">Min SEO Score</Label>
                                    <span className="text-xs font-bold">{minScore[0]}/20</span>
                                </div>
                                <Slider
                                    min={0} max={20} step={1}
                                    value={minScore}
                                    onValueChange={(v) => setMinScore(v as number[])}
                                    className="w-full"
                                />
                            </div>

                            <div className="flex items-center space-x-2 w-full sm:w-auto">
                                <Checkbox id="has-email" checked={requireEmail} onCheckedChange={(c) => setRequireEmail(c as boolean)} />
                                <Label htmlFor="has-email" className="text-sm cursor-pointer">Has Scraped Email</Label>
                            </div>

                            <div className="flex flex-col gap-1 w-full sm:w-auto sm:ml-auto">
                                <Select value={ratingFilter} onValueChange={(v) => setRatingFilter(v as string)}>
                                    <SelectTrigger className="w-full sm:w-[180px] h-8 text-xs">
                                        <SelectValue placeholder="Rating Filter" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Google Ratings</SelectItem>
                                        <SelectItem value="high">4.0 Stars and Up</SelectItem>
                                        <SelectItem value="low">Under 4.0 Stars</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Bulk Actions Bar */}
                    {selectedIds.size > 0 && (
                        <div className="bg-primary text-primary-foreground py-3 px-4 rounded-md flex flex-col sm:flex-row items-center justify-between gap-3 sticky top-4 z-10 shadow-lg animate-in slide-in-from-bottom-2">
                            <span className="font-semibold text-sm text-center sm:text-left w-full sm:w-auto">{selectedIds.size} Leads Selected</span>
                            <div className="flex items-center gap-3 w-full sm:w-auto justify-center sm:justify-start">
                                <Button variant="secondary" size="sm" onClick={handleExportCSV} className="h-8">
                                    <Download className="h-4 w-4 mr-2" /> Export CSV
                                </Button>
                                <Button variant="secondary" size="sm" onClick={handleBulkAudit} className="h-8">
                                    <Search className="h-4 w-4 mr-2" /> Run Audit
                                </Button>
                                <Button id="bulk-assign-btn" variant="default" size="sm" onClick={handleBulkPipeline} className="h-8 bg-black text-white hover:bg-black/80">
                                    <Send className="h-4 w-4 mr-2" /> Save to Pipeline
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Dense Data Table */}
                    <div className="rounded-md border bg-card w-full min-w-0 overflow-hidden">
                        <div className="overflow-x-auto w-full max-w-full">
                            <Table className="min-w-[800px] w-full">
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead className="w-[50px]">
                                            <Checkbox
                                                checked={selectedIds.size === filteredResultsCount && filteredResultsCount > 0}
                                                onCheckedChange={handleSelectAll}
                                            />
                                        </TableHead>
                                        <TableHead className="w-[280px]">Business & City</TableHead>
                                        <TableHead>Rating</TableHead>
                                        <TableHead>Audit Intel</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredResultsCount === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                                No leads match the current filters.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        groupedResultsArray.map(({ groupName, groupLeads }, index) => {
                                            const expanded = isGroupExpanded(groupName, index);

                                            return (
                                                <Fragment key={groupName}>
                                                    <TableRow
                                                        className="bg-slate-100/50 hover:bg-slate-200/50 cursor-pointer"
                                                        onClick={() => toggleGroup(groupName, index)}
                                                    >
                                                        <TableCell colSpan={5} className="py-3 font-semibold text-sm text-foreground/80 border-b-2">
                                                            <div className="flex items-center select-none">
                                                                {expanded ? <ChevronDown className="h-4 w-4 mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />}
                                                                {groupName}
                                                                <span className="text-xs font-normal text-muted-foreground ml-2">({groupLeads.length} leads)</span>
                                                                {(() => {
                                                                    const auditedCount = groupLeads.filter((l: any) => auditedLeads[l.id]).length;
                                                                    return auditedCount > 0 ? (
                                                                        <span className="text-xs font-medium text-green-600 ml-1.5">· {auditedCount} audited</span>
                                                                    ) : null;
                                                                })()}
                                                                {!expanded && (
                                                                    <Badge variant="outline" className="ml-auto text-[10px] uppercase font-bold text-muted-foreground mr-4">Click to View</Badge>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>

                                                    {expanded && groupLeads.map((result: any) => {
                                                        const auditData = auditedLeads[result.id];
                                                        const isAuditingRow = isAuditing[result.id];

                                                        return (
                                                            <TableRow key={result.id} className={`${leads.some(l => l.name === result.name) ? "opacity-40" : "hover:bg-slate-50/80"} transition-colors border-l-[3px] ${auditData ? 'border-l-emerald-400' : 'border-l-transparent'}`}>
                                                                <TableCell className="w-[50px] pl-4">
                                                                    <Checkbox
                                                                        checked={selectedIds.has(result.id)}
                                                                        onCheckedChange={(c) => handleSelectRow(result.id, c as boolean)}
                                                                        className="data-[state=checked]:bg-primary"
                                                                    />
                                                                </TableCell>
                                                                <TableCell className="font-medium py-3">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className={`h-2 w-2 rounded-full shrink-0 ${auditData ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                                                                        <div className="truncate font-semibold text-[14px] max-w-[220px]" title={result.name}>{result.name}</div>
                                                                        {result.website ? (
                                                                            <a href={result.website.startsWith('http') ? result.website : `https://${result.website}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 transition-colors hover:scale-110" title="Visit Website">
                                                                                <ExternalLink className="h-3.5 w-3.5" />
                                                                            </a>
                                                                        ) : (
                                                                            <Badge variant="destructive" className="h-[18px] text-[9px] px-1.5 py-0 uppercase tracking-wider font-bold">No Site</Badge>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[220px] pl-4" title={auditData?.biggestWeakness}>
                                                                        {auditData?.biggestWeakness || (
                                                                            <span className="italic text-slate-400">Awaiting audit</span>
                                                                        )}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="py-3">
                                                                    <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200/60 rounded-full px-2.5 py-1 text-sm font-medium">
                                                                        <span className="text-amber-500">★</span> {result.rating}
                                                                        <span className="text-[11px] text-amber-500/70 font-normal">({result.ratingCount})</span>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="py-3">
                                                                    {auditData ? (
                                                                        <div className="flex items-center gap-2.5">
                                                                            {(() => {
                                                                                const score = auditData.rawScrape?.scoreBreakdown?.total ?? auditData.score ?? 0;
                                                                                const bg = score >= 60 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : score >= 30 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-600 border-red-200';
                                                                                return <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full border ${bg}`}>{score}/100</span>;
                                                                            })()}
                                                                            {auditData.email && (
                                                                                <a href={`mailto:${auditData.email}`} className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200/50 rounded-full px-2 py-0.5 truncate max-w-[180px] transition-colors" title={auditData.email}>
                                                                                    <Mail className="h-3 w-3 flex-shrink-0" />{auditData.email}
                                                                                </a>
                                                                            )}
                                                                            {auditData.rawScrape?.enrichment?.socials?.instagram && (
                                                                                <a href={auditData.rawScrape.enrichment.socials.instagram.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-pink-600 hover:text-pink-800 bg-pink-50 hover:bg-pink-100 border border-pink-200/50 rounded-full px-2 py-0.5 transition-colors shrink-0">
                                                                                    <Instagram className="h-3 w-3 flex-shrink-0" />
                                                                                    {auditData.rawScrape.enrichment.socials.instagram.handle || 'IG'}
                                                                                </a>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-xs text-slate-300 italic">—</span>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="text-right py-3 pr-4">
                                                                    <div className="flex items-center justify-end gap-2">
                                                                        {!auditData ? (
                                                                            <Button
                                                                                size="sm"
                                                                                className="h-10 px-6 font-bold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.03] rounded-xl border-0"
                                                                                onClick={() => handleRunAudit(result)}
                                                                                disabled={isAuditingRow}
                                                                            >
                                                                                {isAuditingRow ? (
                                                                                    <><div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" /> Auditing...</>
                                                                                ) : (
                                                                                    <><Search className="h-4 w-4 mr-2" /> Run Audit</>
                                                                                )}
                                                                            </Button>
                                                                        ) : (
                                                                            <>
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="outline"
                                                                                    className="h-9 px-4 font-medium border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-lg"
                                                                                    onClick={() => setDrawerLead({ ...result, auditData })}
                                                                                >
                                                                                    <Eye className="h-4 w-4 mr-1.5" /> View Data
                                                                                </Button>
                                                                                <Button
                                                                                     size="sm"
                                                                                     className={cn(
                                                                                        "h-9 px-4 font-bold text-white transition-all rounded-lg border-0",
                                                                                        result.status === 'Contacted' 
                                                                                            ? "bg-slate-200 text-slate-500 cursor-not-allowed shadow-none" 
                                                                                            : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-sm hover:shadow-md"
                                                                                     )}
                                                                                     onClick={async () => {
                                                                                         if (result.status === 'Contacted') return;
                                                                                         setReachoutLead({ ...result, auditData });
                                                                                         setAiSuggestions(null);
                                                                                         setIsGeneratingAI(true);
                                                                                        
                                                                                        try {
                                                                                            const res = await generateOutreachSuggestions({
                                                                                                name: result.name,
                                                                                                niche: result.niche || niche,
                                                                                                city: result.city || city,
                                                                                                website: result.website,
                                                                                                manualNotes: result.manual_notes,
                                                                                                igFollowers: result.ig_followers,
                                                                                                igActivity: result.ig_activity,
                                                                                                score: auditData?.score,
                                                                                                seoScore: auditData?.rawScrape?.scoreBreakdown?.uxDecayTechnical,
                                                                                                contactabilityScore: auditData?.rawScrape?.scoreBreakdown?.contactability,
                                                                                                localIntentScore: auditData?.rawScrape?.scoreBreakdown?.cashFlowMaturity,
                                                                                                biggestWeakness: auditData?.biggestWeakness,
                                                                                                keywords: auditData?.rawScrape?.enrichment?.expansionKeywords, rawAudit: auditData?.rawScrape
                                                                                            });
                                                                                       if (res.data) setAiSuggestions(res.data);
                                                                                         else toast.error(res.error || "AI generation failed");
                                                                                         } catch (e) {
                                                                                             toast.error("Failed to generate AI pitch");
                                                                                         } finally {
                                                                                             setIsGeneratingAI(false);
                                                                                         }
                                                                                     }}
                                                                                 >
                                                                                     {result.status === 'Contacted' ? (
                                                                                        <><Check className="h-4 w-4 mr-1.5" /> Contacted</>
                                                                                     ) : (
                                                                                        <><Wand2 className="h-3.5 w-3.5 mr-1.5" /> Reachout AI</>
                                                                                     )}
                                                                                 </Button>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        )
                                                    })}

                                                    {expanded && (() => {
                                                        const targetNiche = groupLeads[0]?.niche || niche;
                                                        const targetCity = groupLeads[0]?.city || city;
                                                        const queryStr = normalizeQueryKey(targetNiche, targetCity);
                                                        const hasToken = activeTokens[queryStr];
                                                        const isLoading = isLoadingMore[queryStr];

                                                        if (hasToken) {
                                                            return (
                                                                <TableRow>
                                                                    <TableCell colSpan={4} className="text-center py-6 bg-slate-50/50 border-b-2">
                                                                        <Button
                                                                            variant="outline"
                                                                            onClick={() => handleLoadMore(targetNiche, targetCity, hasToken)}
                                                                            disabled={isLoading}
                                                                            className="bg-white"
                                                                        >
                                                                            {isLoading ? <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <Search className="h-4 w-4 mr-2" />}
                                                                            {isLoading ? 'Fetching Leads...' : 'Load 20 More Leads'}
                                                                        </Button>
                                                                        <p className="text-xs text-muted-foreground mt-2">There are more undiscovered businesses available for this search.</p>
                                                                    </TableCell>
                                                                </TableRow>
                                                            );
                                                        }
                                                        return null;
                                                    })()}
                                                </Fragment>
                                            )
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
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
                            <div className="flex flex-col h-full bg-slate-50 w-full overflow-hidden focus-visible:outline-none">
                                {/* Header */}
                                <div className="px-6 py-5 border-b shrink-0 bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md relative overflow-hidden">
                                    <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
                                    <div className="relative z-10 flex flex-col">
                                        <SheetTitle className="text-2xl font-black tracking-tight text-white mb-1.5 leading-tight">{drawerLead.name}</SheetTitle>
                                        <SheetDescription className="flex flex-wrap items-center text-blue-100 text-sm font-medium mt-0.5">
                                            <span className="flex items-center"><MapPin className="h-3.5 w-3.5 mr-1" /> {drawerLead.city}</span>
                                            {drawerLead.niche && <span className="ml-3 flex items-center opacity-90"><Building2 className="h-3.5 w-3.5 mr-1" />{drawerLead.niche}</span>}
                                        </SheetDescription>
                                        <div className="flex items-center gap-2 mt-4 text-sm bg-black/20 w-fit px-3 py-1.5 rounded-full backdrop-blur-sm shadow-inner border border-white/10">
                                            <span className="flex items-center font-bold text-yellow-400">★ {drawerLead.rating}</span>
                                            <span className="text-blue-100 text-xs font-semibold">({drawerLead.ratingCount} reviews)</span>
                                            <div className="w-px h-3.5 bg-white/20 mx-1.5"></div>
                                            {audit?.rawScrape?.scoreBreakdown ? (() => {
                                                const sb: ScoreBreakdown = audit.rawScrape.scoreBreakdown;
                                                return <span className="font-bold text-white flex items-center gap-1.5"><Activity className="h-3.5 w-3.5 text-emerald-400"/> Score: {sb.total}/100</span>;
                                            })() : audit?.score !== undefined && (
                                                <span className="font-bold text-white flex items-center gap-1.5"><Activity className="h-3.5 w-3.5 text-emerald-400"/> Score: {audit.score}/100</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto w-full p-6 space-y-5">
                                    {!enrichment ? (
                                        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border shadow-sm border-dashed">
                                            <div className="h-12 w-12 bg-blue-50 rounded-full flex items-center justify-center mb-4"><Search className="h-6 w-6 text-blue-500" /></div>
                                            <span className="text-slate-500 font-medium text-center">No enrichment data accessible.<br/>Run an AI audit first.</span>
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
