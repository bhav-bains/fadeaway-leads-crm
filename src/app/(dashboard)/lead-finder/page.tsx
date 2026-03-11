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
import { Search, MapPin, Building2, Download, Send, AlertCircle, ExternalLink, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useLeadStore, Lead } from "@/store/leadStore";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { insertLead, runLocalSeoAudit } from "@/app/actions/leads";
import { searchGooglePlaces, getCityAutocomplete, getAllSourcedLeads } from "@/app/actions/search";
import { useEffect, Fragment } from "react";

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
            const { data, activeTokens: fetchedTokens } = await getAllSourcedLeads();

            if (data && data.length > 0) {
                setResults(data);
                if (fetchedTokens) setActiveTokens(fetchedTokens);

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
            const queryStr = `${niche} in ${city}`.toLowerCase();
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
        const queryStr = `${targetNiche} in ${targetCity}`.toLowerCase();
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
        setIsAuditing(prev => ({ ...prev, [lead.id]: true }));
        const { data, error } = await runLocalSeoAudit(lead.website, lead.city, lead.niche, lead.ratingCount);
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
            const { data } = await runLocalSeoAudit(lead.website, lead.city, lead.niche, lead.ratingCount);
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
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredResultsCount === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
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
                                                        <TableCell colSpan={4} className="py-3 font-semibold text-sm text-foreground/80 border-b-2">
                                                            <div className="flex items-center select-none">
                                                                {expanded ? <ChevronDown className="h-4 w-4 mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />}
                                                                {groupName} <span className="text-xs font-normal text-muted-foreground ml-2">({groupLeads.length} leads)</span>
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
                                                            <TableRow key={result.id} className={leads.some(l => l.name === result.name) ? "opacity-50" : ""}>
                                                                <TableCell className="w-[50px]">
                                                                    <Checkbox
                                                                        checked={selectedIds.has(result.id)}
                                                                        onCheckedChange={(c) => handleSelectRow(result.id, c as boolean)}
                                                                    />
                                                                </TableCell>
                                                                <TableCell className="font-medium">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="truncate font-semibold text-base max-w-[200px]" title={result.name}>{result.name}</div>
                                                                        {result.website ? (
                                                                            <a href={result.website.startsWith('http') ? result.website : `https://${result.website}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 transition-colors" title="Visit Website">
                                                                                <ExternalLink className="h-3.5 w-3.5" />
                                                                            </a>
                                                                        ) : (
                                                                            <Badge variant="destructive" className="h-[18px] text-[9px] px-1.5 py-0 uppercase tracking-wider font-bold">No Website</Badge>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]" title={auditData?.biggestWeakness}>{auditData?.biggestWeakness || 'Not audited yet'}</div>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <div className="flex items-center gap-1 text-sm font-medium">
                                                                        ⭐ {result.rating} <span className="text-xs text-muted-foreground font-normal">({result.ratingCount})</span>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-right py-2">
                                                                    <div className="flex items-center justify-end gap-2">
                                                                        {!auditData ? (
                                                                            <Button
                                                                                size="sm"
                                                                                variant="secondary"
                                                                                className="h-8 font-medium"
                                                                                onClick={() => handleRunAudit(result)}
                                                                                disabled={isAuditingRow}
                                                                            >
                                                                                {isAuditingRow ? <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <Search className="h-4 w-4 mr-2 text-primary" />}
                                                                                Run Audit
                                                                            </Button>
                                                                        ) : (
                                                                            <Badge variant={auditData.score >= 12 ? 'default' : (auditData.score >= 7 ? 'secondary' : 'outline')} className="px-3 py-1 font-bold text-xs h-8 flex items-center justify-center">
                                                                                Score: {auditData.score}/20
                                                                            </Badge>
                                                                        )}
                                                                        <Button
                                                                            size="sm"
                                                                            variant="default"
                                                                            className="h-8 bg-black text-white hover:bg-black/80 font-medium"
                                                                            onClick={() => {
                                                                                const newSet = new Set([result.id]);
                                                                                setSelectedIds(newSet);
                                                                                setTimeout(() => {
                                                                                    document.getElementById('bulk-assign-btn')?.click();
                                                                                }, 50);
                                                                            }}
                                                                            disabled={leads.some(l => l.name === result.name)}
                                                                        >
                                                                            <Send className="h-4 w-4 mr-2" />
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
                                                        const queryStr = `${targetNiche} in ${targetCity}`.toLowerCase();
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
        </div>
    );
}
