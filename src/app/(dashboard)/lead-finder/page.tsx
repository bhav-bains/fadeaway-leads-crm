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
import { Search, MapPin, Building2, Download, Send, AlertCircle, ExternalLink, ChevronDown, ChevronRight, Mail, Globe, CheckCircle2, XCircle, Eye, Instagram } from "lucide-react";
import { toast } from "sonner";
import { useLeadStore, Lead } from "@/store/leadStore";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn, normalizeQueryKey } from "@/lib/utils";
import { insertLead, runLocalSeoAudit } from "@/app/actions/leads";
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
            const { data, nextPageToken } = result;
            const queryStr = normalizeQueryKey(niche, city);
            setActiveTokens(prev => ({ ...prev, [queryStr]: nextPageToken || null }));

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
            const { data, nextPageToken } = result;
            setActiveTokens(prev => ({ ...prev, [queryStr]: nextPageToken || null }));

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
                                                                                variant="secondary"
                                                                                className="h-9 px-5 font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                                                                                onClick={() => handleRunAudit(result)}
                                                                                disabled={isAuditingRow}
                                                                            >
                                                                                {isAuditingRow ? <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <Search className="h-4 w-4 mr-2 text-slate-500" />}
                                                                                Run Audit
                                                                            </Button>
                                                                        ) : (
                                                                            <Button
                                                                                size="sm"
                                                                                variant="outline"
                                                                                className="h-9 px-5 font-medium border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                                                                onClick={() => setDrawerLead({ ...result, auditData })}
                                                                            >
                                                                                <Eye className="h-4 w-4 mr-1.5" /> View Data
                                                                            </Button>
                                                                        )}
                                                                        <Button
                                                                            size="sm"
                                                                            variant="default"
                                                                            className="h-9 px-5 bg-gradient-to-r from-slate-800 to-slate-900 text-white hover:from-slate-700 hover:to-slate-800 font-medium shadow-sm"
                                                                            onClick={() => {
                                                                                const newSet = new Set([result.id]);
                                                                                setSelectedIds(newSet);
                                                                                setTimeout(() => {
                                                                                    document.getElementById('bulk-assign-btn')?.click();
                                                                                }, 50);
                                                                            }}
                                                                            disabled={leads.some(l => l.name === result.name)}
                                                                        >
                                                                            <Send className="h-3.5 w-3.5 mr-1.5" />
                                                                            Pipeline
                                                                        </Button>
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
                <SheetContent side="right" className="w-[420px] sm:w-[520px] overflow-y-auto p-0 max-h-screen">
                    {drawerLead && (() => {
                        const audit = drawerLead.auditData;
                        const enrichment: EnrichmentData | undefined = audit?.rawScrape?.enrichment;

                        return (
                            <div className="flex flex-col h-full bg-slate-50">
                                {/* Header */}
                                <div className="px-6 py-6 bg-white border-b sticky top-0 z-10 shadow-sm">
                                    <SheetTitle className="text-xl font-bold leading-tight">{drawerLead.name}</SheetTitle>
                                    <SheetDescription className="mt-1 flex items-center text-sm">
                                        <MapPin className="h-3.5 w-3.5 mr-1" /> {drawerLead.city}
                                        {drawerLead.website && (
                                            <a href={drawerLead.website.startsWith('http') ? drawerLead.website : `https://${drawerLead.website}`} target="_blank" rel="noopener noreferrer" className="ml-3 text-blue-500 hover:text-blue-700 flex items-center">
                                                <Globe className="h-3.5 w-3.5 mr-1" /> Visit Site
                                            </a>
                                        )}
                                    </SheetDescription>
                                    <div className="flex items-center gap-2 mt-3 text-sm">
                                        <span className="flex items-center gap-1">⭐ {drawerLead.rating}</span>
                                        <span className="text-muted-foreground">({drawerLead.ratingCount} reviews)</span>
                                        {audit?.rawScrape?.scoreBreakdown ? (() => {
                                            const sb: ScoreBreakdown = audit.rawScrape.scoreBreakdown;
                                            const variant = sb.total >= 60 ? 'default' : sb.total >= 30 ? 'secondary' : 'outline';
                                            return <Badge variant={variant} className="ml-auto text-sm px-3 py-1">{sb.total}/100</Badge>;
                                        })() : audit?.score !== undefined && (
                                            <Badge variant={audit.score >= 60 ? 'default' : 'secondary'} className="ml-auto">
                                                Score: {audit.score}/100
                                            </Badge>
                                        )}
                                    </div>
                                </div>

                                {/* Enrichment Cards */}
                                <div className="p-6 space-y-4 flex-1">
                                    {!enrichment ? (
                                        <div className="text-sm text-muted-foreground text-center p-8 border rounded-lg bg-white">
                                            No enrichment data available. Run an audit first.
                                        </div>
                                    ) : (
                                        <>
                                            {/* Score Breakdown */}
                                            {audit?.rawScrape?.scoreBreakdown && (() => {
                                                const sb: ScoreBreakdown = audit.rawScrape.scoreBreakdown;
                                                const categories = [
                                                    { label: 'UX Decay & Technical', score: sb.uxDecayTechnical, max: 45, color: 'bg-red-500' },
                                                    { label: 'Cash Flow & Maturity', score: sb.cashFlowMaturity, max: 30, color: 'bg-blue-500' },
                                                    { label: 'Contactability', score: sb.contactability, max: 25, color: 'bg-green-500' },
                                                ];
                                                return (
                                                    <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                                                        <div className="bg-muted/50 px-4 py-2 border-b">
                                                            <h3 className="font-semibold text-sm">Score Breakdown ({sb.total}/100)</h3>
                                                        </div>
                                                        <div className="p-4 space-y-3">
                                                            {categories.map((cat, i) => (
                                                                <div key={i} className="space-y-1">
                                                                    <div className="flex justify-between text-xs">
                                                                        <span className="font-medium">{cat.label}</span>
                                                                        <span className="text-muted-foreground">{cat.score}/{cat.max}</span>
                                                                    </div>
                                                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                                        <div
                                                                            className={`h-full ${cat.color} rounded-full transition-all`}
                                                                            style={{ width: `${(cat.score / cat.max) * 100}%` }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            {sb.rulesTriggered && sb.rulesTriggered.length > 0 && (
                                                                <div className="pt-2 border-t mt-3">
                                                                    <span className="text-xs font-semibold text-muted-foreground uppercase">Rules Triggered</span>
                                                                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                                        {sb.rulesTriggered.map((rule: string, i: number) => (
                                                                            <Badge key={i} variant="outline" className="text-[10px]">{rule}</Badge>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                            {/* 1. Contacts */}
                                            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                                                <div className="bg-muted/50 px-4 py-2 border-b flex items-center gap-2">
                                                    <Mail className="h-4 w-4 text-muted-foreground" />
                                                    <h3 className="font-semibold text-sm">Contact Information</h3>
                                                </div>
                                                <div className="p-4 space-y-3 text-sm">
                                                    {enrichment.contacts.emails.length > 0 ? (
                                                        <div className="space-y-1.5">
                                                            {enrichment.contacts.emails.map((e, i) => (
                                                                <div key={i} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded border">
                                                                    <span className="font-medium">{e.email}</span>
                                                                    <div className="flex gap-1.5">
                                                                        <Badge variant="outline" className="text-[10px] bg-white">{e.type}</Badge>
                                                                        <Badge variant="outline" className="text-[10px] bg-white">{e.source}</Badge>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground italic">No emails found</span>
                                                    )}
                                                    <div className="flex items-center gap-2 pt-1">
                                                        {enrichment.contacts.hasContactForm ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-400" />}
                                                        <span>Contact Form</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {enrichment.contacts.hasPhone ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-400" />}
                                                        <span>Phone Number (tel: link)</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 2. Technical SEO */}
                                            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                                                <div className="bg-muted/50 px-4 py-2 border-b">
                                                    <h3 className="font-semibold text-sm">Technical SEO</h3>
                                                </div>
                                                <div className="p-4 space-y-2 text-sm">
                                                    {[
                                                        { label: 'Title Tag', ok: !enrichment.seo.titleTag.isEmpty, detail: enrichment.seo.titleTag.text || '(empty)' },
                                                        { label: `H1 Tags (${enrichment.seo.h1Tags.count})`, ok: enrichment.seo.h1Tags.count > 0, detail: enrichment.seo.h1Tags.texts[0] || '(none)' },
                                                        { label: 'Meta Description', ok: enrichment.seo.metaDescription.exists, detail: enrichment.seo.metaDescription.content || '(missing)' },
                                                        { label: 'Mobile Viewport', ok: enrichment.seo.hasViewport, detail: enrichment.seo.hasViewport ? 'Present' : 'Missing' },
                                                        { label: 'Schema Markup', ok: enrichment.seo.hasSchemaMarkup, detail: enrichment.seo.hasSchemaMarkup ? 'Present' : 'Missing' },
                                                        { label: 'NoIndex (Fatal Flaw)', ok: !enrichment.seo.hasNoIndex, detail: enrichment.seo.hasNoIndex ? '⚠️ BLOCKED' : 'Not blocked' },
                                                    ].map((item, idx) => (
                                                        <div key={idx} className="flex items-start justify-between bg-slate-50 px-3 py-2 rounded border">
                                                            <div className="flex-1 min-w-0">
                                                                <span className="font-medium">{item.label}</span>
                                                                <p className="text-xs text-muted-foreground truncate mt-0.5" title={item.detail}>{item.detail}</p>
                                                            </div>
                                                            {item.ok ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" /> : <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* 3. Tracking Pixels */}
                                            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                                                <div className="bg-muted/50 px-4 py-2 border-b">
                                                    <h3 className="font-semibold text-sm">Tracking Pixels</h3>
                                                </div>
                                                <div className="p-4 space-y-2 text-sm">
                                                    <div className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded border">
                                                        <span className="font-medium">Meta Pixel (Facebook)</span>
                                                        {enrichment?.pixels?.hasMetaPixel ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-400" />}
                                                    </div>
                                                    <div className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded border">
                                                        <span className="font-medium">Google Ads / Analytics</span>
                                                        {enrichment?.pixels?.hasGoogleAds ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-400" />}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 4. Business Expansion */}
                                            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                                                <div className="bg-muted/50 px-4 py-2 border-b">
                                                    <h3 className="font-semibold text-sm">Business Expansion Keywords</h3>
                                                </div>
                                                <div className="p-4 text-sm">
                                                    {enrichment?.expansionKeywords?.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {(enrichment?.expansionKeywords || []).map((kw: string, i: number) => (
                                                                <Badge key={i} variant="secondary" className="text-xs">{kw}</Badge>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground italic">No expansion keywords detected</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* 5. CTAs & Booking */}
                                            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                                                <div className="bg-muted/50 px-4 py-2 border-b">
                                                    <h3 className="font-semibold text-sm">CTAs & Booking Links</h3>
                                                </div>
                                                <div className="p-4 space-y-3 text-sm">
                                                    <div className="flex items-center gap-2">
                                                        {enrichment?.ctas?.hasGeneralCTA ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-400" />}
                                                        <span>General CTA Detected</span>
                                                    </div>
                                                    {enrichment?.ctas?.bookingUrls?.length > 0 ? (
                                                        <div className="space-y-1.5">
                                                            <span className="text-xs font-semibold text-muted-foreground uppercase">Booking Software</span>
                                                            {(enrichment?.ctas?.bookingUrls || []).map((b: any, i: number) => (
                                                                <div key={i} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded border">
                                                                    <Badge variant="default" className="text-xs">{b.platform}</Badge>
                                                                    <a href={b.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline truncate ml-2 max-w-[200px]">{b.url}</a>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground italic">No external booking software detected</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* 6. Social Media */}
                                            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                                                <div className="bg-muted/50 px-4 py-2 border-b">
                                                    <h3 className="font-semibold text-sm">Social Media</h3>
                                                </div>
                                                <div className="p-4 space-y-2 text-sm">
                                                    {enrichment?.socials?.instagram ? (
                                                        <a href={enrichment.socials.instagram.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded border hover:bg-slate-100 transition-colors">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <Badge variant="outline" className="text-xs shrink-0">Instagram</Badge>
                                                                <span className="font-medium text-blue-600 truncate">@{enrichment.socials.instagram.handle}</span>
                                                            </div>
                                                            <ExternalLink className="h-3.5 w-3.5 text-blue-500 shrink-0 ml-2" />
                                                        </a>
                                                    ) : (
                                                        <div className="flex items-center gap-2 text-muted-foreground"><XCircle className="h-4 w-4 text-red-400" /> No Instagram found</div>
                                                    )}
                                                    {enrichment?.socials?.facebook ? (
                                                        <a href={enrichment.socials.facebook.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded border hover:bg-slate-100 transition-colors">
                                                            <Badge variant="outline" className="text-xs">Facebook</Badge>
                                                            <ExternalLink className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                                        </a>
                                                    ) : (
                                                        <div className="flex items-center gap-2 text-muted-foreground"><XCircle className="h-4 w-4 text-red-400" /> No Facebook found</div>
                                                    )}
                                                    {enrichment?.socials?.tiktok ? (
                                                        <a href={enrichment.socials.tiktok.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded border hover:bg-slate-100 transition-colors">
                                                            <Badge variant="outline" className="text-xs">TikTok</Badge>
                                                            <ExternalLink className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                                        </a>
                                                    ) : (
                                                        <div className="flex items-center gap-2 text-muted-foreground"><XCircle className="h-4 w-4 text-red-400" /> No TikTok found</div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* 7. UX Decay Signals */}
                                            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                                                <div className="bg-muted/50 px-4 py-2 border-b">
                                                    <h3 className="font-semibold text-sm">UX Decay Signals</h3>
                                                </div>
                                                <div className="p-4 space-y-2 text-sm">
                                                    <div className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded border">
                                                        <div>
                                                            <span className="font-medium">Copyright Year</span>
                                                            <p className="text-xs text-muted-foreground">
                                                                {enrichment?.uxDecay?.copyrightYear ? `© ${enrichment.uxDecay.copyrightYear}` : 'Not found'}
                                                            </p>
                                                        </div>
                                                        {enrichment?.uxDecay?.isOutdatedCopyright ? <XCircle className="h-4 w-4 text-red-500" /> : <CheckCircle2 className="h-4 w-4 text-green-500" />}
                                                    </div>
                                                    <div className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded border">
                                                        <span className="font-medium">Cheap Web Builder</span>
                                                        {enrichment?.uxDecay?.usesCheapBuilder ? <XCircle className="h-4 w-4 text-red-500" /> : <CheckCircle2 className="h-4 w-4 text-green-500" />}
                                                    </div>
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
        </div>
    );
}
