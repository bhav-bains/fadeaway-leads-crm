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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Search, MapPin, Building2, Download, Send, AlertCircle, ExternalLink, ChevronDown, ChevronRight, Mail, Globe, CheckCircle2, XCircle, Eye, Instagram, Facebook, Activity, Code2, Terminal, Clock, Link as LinkIcon, TrendingUp, Phone, MessageSquare, Users, PenLine, Save, Wand2, Sparkles, Loader2, Star, Smartphone, Monitor } from "lucide-react";
import { toast } from "sonner";
import { useLeadStore, Lead } from "@/store/leadStore";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn, normalizeQueryKey } from "@/lib/utils";
import { insertLead, runLocalSeoAudit, updateLeadManualData, updateLeadStatus, fetchAndSavePageSpeed } from "@/app/actions/leads";
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
    const [manualIg, setManualIg] = useState('');
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
        if (drawerLead) {
            setManualNotes(drawerLead.manual_notes || '');
            setIgFollowers(drawerLead.ig_followers ? String(drawerLead.ig_followers) : '');
            setIgActivity(drawerLead.ig_activity || '');
            setManualEmail(drawerLead.manual_email || '');
            setManualPhone(drawerLead.phone || '');
            setManualIg(drawerLead.instagram_url || '');
        } else {
            setManualNotes('');
            setIgFollowers('');
            setIgActivity('');
            setManualEmail('');
            setManualPhone('');
            setManualIg('');
        }
    }, [drawerLead]);

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
                if (data[0]?.city) {
                    setCity(data[0].city);
                    setCitySearchTerm(data[0].city);
                }
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
        if (!niche) {
            toast.error("Please enter a business niche.");
            return;
        }
        if (!city) {
            toast.error("Please select a valid city from the suggestions.");
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

            if (data.companyId && lead.website) {
                fetchAndSavePageSpeed(data.companyId, lead.website).then(res => {
                    setAuditedLeads(prev => {
                        const current = prev[lead.id];
                        if (!current) return prev;
                        const newAudit = {
                            ...current,
                            rawScrape: {
                                ...current.rawScrape,
                                seoAudit: {
                                    ...current.rawScrape?.seoAudit,
                                    pagespeed_mobile: res?.success ? res.pagespeed_mobile : null,
                                    pagespeed_desktop: res?.success ? res.pagespeed_desktop : null
                                }
                            }
                        };
                        return { ...prev, [lead.id]: newAudit };
                    });
                }).catch(() => {
                    setAuditedLeads(prev => {
                        const current = prev[lead.id];
                        if (!current) return prev;
                        const newAudit = {
                            ...current,
                            rawScrape: {
                                ...current.rawScrape,
                                seoAudit: {
                                    ...current.rawScrape?.seoAudit,
                                    pagespeed_mobile: null,
                                    pagespeed_desktop: null
                                }
                            }
                        };
                        return { ...prev, [lead.id]: newAudit };
                    });
                });
            }
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

                if (data.companyId && lead.website) {
                    fetchAndSavePageSpeed(data.companyId, lead.website).then(res => {
                        setAuditedLeads(prev => {
                            const current = prev[lead.id];
                            if (!current) return prev;
                            const newAudit = {
                                ...current,
                                rawScrape: {
                                    ...current.rawScrape,
                                    seoAudit: {
                                        ...current.rawScrape?.seoAudit,
                                        pagespeed_mobile: res?.success ? res.pagespeed_mobile : null,
                                        pagespeed_desktop: res?.success ? res.pagespeed_desktop : null
                                    }
                                }
                            };
                            return { ...prev, [lead.id]: newAudit };
                        });
                    }).catch(() => {
                        setAuditedLeads(prev => {
                            const current = prev[lead.id];
                            if (!current) return prev;
                            const newAudit = {
                                ...current,
                                rawScrape: {
                                    ...current.rawScrape,
                                    seoAudit: {
                                        ...current.rawScrape?.seoAudit,
                                        pagespeed_mobile: null,
                                        pagespeed_desktop: null
                                    }
                                }
                            };
                            return { ...prev, [lead.id]: newAudit };
                        });
                    });
                }
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

            <Card className="rounded-3xl border border-zinc-800/80 bg-zinc-900/50 p-6 sm:p-8 shadow-2xl backdrop-blur-xl overflow-visible isolate relative group/search">
                <CardHeader className="p-0 pb-6 sm:pb-10">
                    <CardTitle className="text-[11px] font-black uppercase tracking-[0.25em] text-zinc-400 group-hover/search:text-brand transition-colors">Search Parameters</CardTitle>
                    <CardDescription className="text-zinc-500 text-[13px] mt-1.5 leading-relaxed max-w-2xl">Enter a Niche and City to scrape Google and instantly add fresh businesses into your Inbox.</CardDescription>
                </CardHeader>
                <CardContent className="p-0 overflow-visible">
                    <form onSubmit={handleSearch} className="flex flex-col lg:flex-row gap-5 sm:gap-8 items-start lg:items-end w-full min-w-0 overflow-visible">
                        <div className="grid gap-2 w-full lg:flex-1 min-w-0">
                            <Label htmlFor="niche" className="font-bold text-[10px] uppercase tracking-widest text-zinc-500">Business Niche</Label>
                            <div className="relative w-full">
                                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
                                <Input
                                    id="niche"
                                    name="niche"
                                    placeholder="e.g. Plumber, Roofing, Dentist"
                                    className="pl-10 h-12 bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 w-full focus-visible:ring-brand/40 selection:bg-brand/30 selection:text-white autofill:shadow-[0_0_0_30px_#09090b_inset] autofill:[-webkit-text-fill-color:white] transition-all"
                                    value={niche}
                                    onChange={(e) => setNiche(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="grid gap-2 w-full lg:flex-1 min-w-0 relative">
                            <Label htmlFor="city" className="font-bold text-[10px] uppercase tracking-widest text-zinc-500">Target City</Label>
                            <div className="relative w-full">
                                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 z-10 pointer-events-none" />
                                <Input
                                    id="city"
                                    name="city"
                                    placeholder="e.g. Seattle, Toronto..."
                                    className="pl-10 h-12 bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 w-full focus-visible:ring-brand/40 selection:bg-brand/30 selection:text-white autofill:shadow-[0_0_0_30px_#09090b_inset] autofill:[-webkit-text-fill-color:white] transition-all"
                                    value={citySearchTerm}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setCitySearchTerm(val);
                                        setCity(""); // Reset valid city selection on manual type
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
                            className="w-full lg:w-auto font-black uppercase tracking-[0.15em] text-[11px] px-10 shrink-0 bg-brand hover:bg-brand/90 text-zinc-950 h-12 transition-all active:scale-[0.98] shadow-[0_0_20px_rgba(255,102,0,0.15)] hover:shadow-[0_0_30px_rgba(255,102,0,0.25)]"
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
                                                            <Card className={cn(
                                                                "h-full rounded-[2rem] border bg-zinc-900/60 p-7 shadow-2xl shadow-black/50 backdrop-blur-md transition-all duration-300 isolate relative overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-zinc-700/30 before:to-transparent",
                                                                auditData
                                                                    ? "border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.05)] bg-zinc-900/80"
                                                                    : "border-zinc-800 group-hover:border-brand/40 group-hover:bg-zinc-900/80 group-hover:shadow-[0_0_60px_rgba(255,102,0,0.08)]"
                                                            )}>
                                                                <div className="flex flex-col h-full gap-6">
                                                                    <div className="flex justify-between items-start">
                                                                        <div className="flex items-center gap-4">
                                                                            <div className="bg-zinc-950 p-3 rounded-2xl border border-zinc-800 group-hover:border-brand/20 transition-colors shadow-inner">
                                                                                <Building2 className="h-5 w-5 text-brand" />
                                                                            </div>
                                                                            <div className="flex items-center gap-2 bg-zinc-950/60 border border-zinc-800/80 px-3 py-2 rounded-xl group-hover:border-brand/30 transition-all shadow-inner">
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <Star className="h-3.5 w-3.5 text-brand fill-brand" />
                                                                                    <span className="text-xs font-black text-zinc-100">{result.rating || '0.0'}</span>
                                                                                </div>
                                                                                <div className="w-[1px] h-3.5 bg-zinc-800"></div>
                                                                                <div className="flex flex-col leading-none">
                                                                                    <span className="text-[11px] font-black text-brand tracking-tight">
                                                                                        {result.ratingCount || 0}
                                                                                    </span>
                                                                                    <span className="text-[7px] font-bold text-zinc-500 uppercase tracking-widest">
                                                                                        Reviews
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    <div className="space-y-2 flex-1">
                                                                        <h3 className="text-[19px] font-sans font-bold tracking-tight leading-[1.2] uppercase line-clamp-2 text-zinc-100 group-hover:text-white transition-colors">
                                                                            {result.name}
                                                                        </h3>
                                                                        <div className="flex items-center gap-2 text-zinc-400 text-[11px] font-bold uppercase tracking-[0.15em]">
                                                                            <div className="bg-zinc-800/50 p-1 rounded-md">
                                                                                <MapPin className="h-3 w-3 shrink-0 text-brand/70" />
                                                                            </div>
                                                                            <span className="truncate">{result.city}</span>
                                                                        </div>
                                                                    </div>

                                                                    <div className="mt-auto pt-6 border-t border-zinc-800/50 flex flex-col gap-4">
                                                                        <div className="flex items-center justify-between">
                                                                            <div className="flex items-center gap-3">
                                                                                {auditData ? (
                                                                                    <div className="flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/20 px-3 py-1.5 rounded-full shadow-inner">
                                                                                        <Sparkles className="h-3 w-3 text-emerald-400" />
                                                                                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest leading-none">
                                                                                            {auditData.score !== undefined ? `SCORE ${auditData.score}` : 'AUDITED'}
                                                                                        </span>
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="flex items-center gap-1.5 opacity-40">
                                                                                        <AlertCircle className="h-3 w-3 text-zinc-500" />
                                                                                        <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Unaudited</span>
                                                                                    </div>
                                                                                )}

                                                                                <div className="flex items-center gap-2 px-2 border-l border-zinc-800">
                                                                                    {result.website && (
                                                                                        <Globe className={cn("h-3.5 w-3.5 transition-colors", auditData ? "text-emerald-400/60" : "text-zinc-600")} />
                                                                                    )}
                                                                                    {result.phone && (
                                                                                        <Phone className={cn("h-3.5 w-3.5 transition-colors", auditData ? "text-emerald-400/60" : "text-zinc-600")} />
                                                                                    )}
                                                                                </div>
                                                                            </div>

                                                                            <div className="flex items-center gap-1.5 text-zinc-500 text-[8px] font-black uppercase tracking-[0.3em] group-hover:text-brand/60 transition-all duration-300">
                                                                                <span>Click</span>
                                                                                <ChevronRight className="h-2.5 w-2.5" />
                                                                            </div>
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
            {/* Enrichment Data Popup */}
            <Dialog open={!!drawerLead} onOpenChange={(o) => { if (!o) setDrawerLead(null); }}>
                <DialogContent className="w-full max-w-[95vw] md:max-w-[90vw] lg:max-w-5xl h-[90vh] p-0 overflow-hidden border border-zinc-500 sm:border-zinc-800 bg-zinc-900/95 shadow-[0_0_80px_rgba(0,0,0,1)] ring-1 ring-white/10 sm:ring-white/5 rounded-2xl sm:rounded-lg">
                    <DialogHeader className="sr-only">
                        <DialogTitle>{drawerLead?.name}</DialogTitle>
                        <DialogDescription>Lead enrichment and audit data</DialogDescription>
                    </DialogHeader>
                    {drawerLead && (() => {
                        const audit = auditedLeads[drawerLead.id] || drawerLead.auditData;
                        const enrichment: EnrichmentData | undefined = audit?.rawScrape?.enrichment;

                        return (
                            <div className="flex flex-col h-full bg-zinc-900 text-zinc-100 w-full overflow-hidden focus-visible:outline-none relative">
                                <Tabs defaultValue="intel" className="flex flex-col h-full">
                                    {/* Header */}
                                    <div className="px-4 sm:px-6 pt-6 pb-4 border-b border-zinc-800/80 shrink-0 bg-zinc-950 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-4 opacity-[0.05]">
                                            <Building2 className="h-32 w-32 text-brand rotate-12" />
                                        </div>
                                        {/* Always-visible Close Button */}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="absolute top-4 right-4 z-50 h-10 w-10 sm:h-8 sm:w-8 rounded-full bg-zinc-900 border border-zinc-700 shadow-xl text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all flex items-center justify-center cursor-pointer pointer-events-auto"
                                            onClick={() => setDrawerLead(null)}
                                        >
                                            <X className="h-5 w-5 sm:h-4 sm:w-4" />
                                        </Button>
                                        <div className="relative z-10 flex flex-col gap-2">
                                            <div className="flex items-center gap-2 sm:gap-3">
                                                <span className="h-[1px] w-4 bg-brand/50"></span>
                                                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.3em] text-brand/80">Business Intelligence</span>
                                            </div>
                                            <h2 className="text-2xl sm:text-3xl font-heading uppercase leading-tight pr-10">{drawerLead.name}</h2>
                                            <div className="flex flex-wrap items-center text-zinc-500 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest gap-x-4 sm:gap-x-6 gap-y-2 sm:gap-y-3 mt-2 sm:mt-4">
                                                <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-brand" /> {drawerLead.city}</span>
                                                {drawerLead.niche && <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-brand" />{drawerLead.niche}</span>}
                                                {drawerLead.website && (
                                                    <a href={drawerLead.website.startsWith('http') ? drawerLead.website : `https://${drawerLead.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-zinc-400 hover:text-brand transition-colors cursor-pointer group">
                                                        <Globe className="h-3.5 w-3.5 text-brand group-hover:scale-110 transition-transform" />
                                                        <span className="border-b border-transparent group-hover:border-brand/50 lowercase tracking-normal">{drawerLead.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</span>
                                                    </a>
                                                )}
                                                <div className="flex items-center justify-between sm:justify-start w-full sm:w-auto mt-2 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-t-0 sm:border-l border-zinc-800 sm:pl-8 sm:ml-2">
                                                    <div className="flex items-baseline gap-2 py-1 group/rating">
                                                        <Star className="h-4 w-4 text-brand fill-brand shrink-0" />
                                                        <span className="text-xl sm:text-xl font-black text-brand italic tracking-tighter leading-none">{drawerLead.rating}</span>
                                                        <span className="text-[9px] sm:text-[10px] text-zinc-500 font-bold uppercase tracking-[0.1em] leading-none">({drawerLead.ratingCount} reviews)</span>
                                                    </div>

                                                    <div className="flex items-center gap-2 sm:gap-3 py-1 sm:ml-2 border-l border-zinc-800/50 pl-4 sm:pl-8 group/score">
                                                        <Activity className="h-4 w-4 text-emerald-400 shrink-0" />
                                                        <div className="flex items-baseline gap-1 sm:gap-1.5">
                                                            <span className="text-[8px] sm:text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] leading-none">SCORE:</span>
                                                            <span className="text-lg sm:text-xl font-black text-white italic tracking-tighter leading-none">
                                                                {audit?.rawScrape?.scoreBreakdown ? audit.rawScrape.scoreBreakdown.total : audit?.score}/100
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Tabs Navigation */}
                                    <div className="px-4 sm:px-6 py-3 border-b border-zinc-800/60 bg-zinc-950/40 flex items-center shrink-0 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                                        <TabsList className="bg-zinc-900 border border-zinc-800 h-10 p-1 shrink-0 flex-nowrap min-w-max">
                                            <TabsTrigger value="intel" className="px-6 py-1.5 text-zinc-500 hover:text-zinc-300 data-active:bg-zinc-100 data-active:text-zinc-950 transition-all">
                                                <div className="flex items-center gap-2">
                                                    <Globe className="h-3.5 w-3.5" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Business Intel</span>
                                                </div>
                                            </TabsTrigger>
                                            <TabsTrigger value="audit" className="px-6 py-1.5 text-zinc-500 hover:text-zinc-300 data-active:bg-zinc-100 data-active:text-zinc-950 transition-all">
                                                <div className="flex items-center gap-2">
                                                    <Activity className="h-3.5 w-3.5" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Audit Breakdown</span>
                                                </div>
                                            </TabsTrigger>
                                            <TabsTrigger value="outreach" className="px-6 py-1.5 text-zinc-500 hover:text-zinc-300 data-active:bg-zinc-100 data-active:text-zinc-950 transition-all">
                                                <div className="flex items-center gap-2">
                                                    <Send className="h-3.5 w-3.5" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">AI Outreach</span>
                                                </div>
                                            </TabsTrigger>
                                        </TabsList>
                                    </div>

                                    <TabsContent value="intel" className="flex-1 flex flex-col overflow-hidden">
                                        <div className="flex-1 overflow-y-auto w-full p-6 space-y-8 bg-zinc-900/20 shadow-inner [scrollbar-gutter:stable]">
                                            {!enrichment ? (
                                                <div className="flex flex-col items-center justify-center p-12 rounded-3xl border border-zinc-800 border-dashed bg-zinc-900/20 text-zinc-500 gap-6 transition-all duration-300">
                                                    <div className="h-16 w-16 bg-zinc-900 rounded-2xl flex items-center justify-center border border-zinc-800 shadow-xl group/icon">
                                                        {isAuditing[drawerLead.id] ? (
                                                            <Loader2 className="h-8 w-8 text-brand animate-spin" />
                                                        ) : (
                                                            <Sparkles className="h-8 w-8 text-zinc-700 group-hover/icon:text-brand transition-colors" />
                                                        )}
                                                    </div>
                                                    <div className="text-center space-y-2">
                                                        <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Deep Intel Required</p>
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 max-w-[240px] leading-relaxed mx-auto">
                                                            Run a 1-click SEO AI Audit to uncover technical gaps, hidden contacts, and pixel data.
                                                        </p>
                                                    </div>
                                                    <Button
                                                        onClick={() => handleRunAudit(drawerLead)}
                                                        disabled={isAuditing[drawerLead.id]}
                                                        className="bg-brand/10 hover:bg-brand/20 text-brand border border-brand/20 hover:border-brand/40 font-black uppercase tracking-widest text-[10px] h-11 px-8 rounded-xl shadow-sm active:scale-95 transition-all"
                                                    >
                                                        {isAuditing[drawerLead.id] ? (
                                                            <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> Deep Auditing...</>
                                                        ) : (
                                                            <><Terminal className="h-3.5 w-3.5 mr-2" /> Run AI Site Audit</>
                                                        )}
                                                    </Button>
                                                </div>
                                            ) : (
                                                <>
                                                    {/* Business Hub */}
                                                    <div className="bg-zinc-900/60 backdrop-blur-md rounded-2xl border border-zinc-800 shadow-xl p-5 hover:shadow-brand/5 transition-all relative overflow-hidden group">
                                                        <div className="absolute top-0 right-0 w-32 h-32 bg-brand/5 rounded-bl-full -mr-4 -mt-4 transition-transform duration-500 group-hover:scale-110"></div>
                                                        <div className="flex items-center gap-2 mb-4 relative z-10">
                                                            <div className="h-8 w-8 rounded-full bg-zinc-950 flex items-center justify-center border border-zinc-800"><Globe className="h-4 w-4 text-brand" /></div>
                                                            <h3 className="font-bold text-zinc-100 text-base uppercase tracking-tighter">Business Intelligence</h3>
                                                            <div className="ml-auto flex items-center gap-2">
                                                                {enrichment?.socials?.facebook && (
                                                                    <a href={enrichment.socials.facebook.url} target="_blank" rel="noreferrer" className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-brand hover:border-brand/40 transition-all">
                                                                        <Facebook className="h-3.5 w-3.5" />
                                                                    </a>
                                                                )}
                                                                {enrichment?.socials?.tiktok && (
                                                                    <a href={enrichment.socials.tiktok.url} target="_blank" rel="noreferrer" className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-brand hover:border-brand/40 transition-all">
                                                                        <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24"><path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.06-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.03 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" /></svg>
                                                                    </a>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 relative z-10">
                                                            {drawerLead.website ? (
                                                                <a href={drawerLead.website.startsWith('http') ? drawerLead.website : `https://${drawerLead.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-2.5 sm:p-3 rounded-xl bg-zinc-950/50 border border-zinc-800/50 hover:bg-zinc-900 hover:shadow-xl hover:border-brand/30 transition-all group/link">
                                                                    <div className="bg-zinc-900 p-2 rounded-lg shadow-sm border border-zinc-800 group-hover/link:bg-zinc-800 transition-colors"><Globe className="h-4 w-4 text-brand group-hover/link:scale-110 transition-transform" /></div>
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none mb-1">Website</p>
                                                                        <p className="text-[13px] sm:text-sm font-semibold text-zinc-100 truncate">{drawerLead.website}</p>
                                                                    </div>
                                                                </a>
                                                            ) : (
                                                                <div className="flex items-center gap-3 p-2.5 sm:p-3 rounded-xl bg-zinc-950/50 border border-zinc-800/20 opacity-60"><Globe className="h-4 w-4 text-zinc-600" /><span className="text-[13px] sm:text-sm font-medium text-zinc-500">No Website</span></div>
                                                            )}

                                                            {enrichment.contacts.emails.length > 0 ? (
                                                                <div className="flex items-center gap-3 p-2.5 sm:p-3 rounded-xl bg-zinc-950/50 border border-zinc-800/50 group/link hover:bg-zinc-900 hover:shadow-xl hover:border-brand/30 transition-all">
                                                                    <div className="bg-zinc-900 p-2 rounded-lg shadow-sm border border-zinc-800 group-hover/link:bg-zinc-800 transition-colors"><Mail className="h-4 w-4 text-brand group-hover/link:scale-110 transition-transform" /></div>
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none mb-1">Email Match</p>
                                                                        <p className="text-[13px] sm:text-sm font-semibold text-zinc-100 truncate" title={enrichment.contacts.emails[0].email}>{enrichment.contacts.emails[0].email}</p>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-3 p-2.5 sm:p-3 rounded-xl bg-zinc-950/50 border border-zinc-800/20 opacity-60"><Mail className="h-4 w-4 text-zinc-600" /><span className="text-[13px] sm:text-sm font-medium text-zinc-500">No Email</span></div>
                                                            )}

                                                            <div className="flex items-center gap-3 p-2.5 sm:p-3 rounded-xl bg-zinc-950/50 border border-zinc-800/50 group/link hover:bg-zinc-900 hover:shadow-xl hover:border-brand/30 transition-all">
                                                                <div className="bg-zinc-900 p-2 text-brand rounded-lg shadow-sm border border-zinc-800 group-hover/link:bg-zinc-800 transition-colors flex justify-center items-center"><Phone className="h-4 w-4 group-hover/link:scale-110 transition-transform" /></div>
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none mb-1">Phone Match</p>
                                                                    <p className="text-[13px] sm:text-sm font-semibold text-zinc-100 truncate">{drawerLead.phone || (enrichment.contacts.hasPhone ? 'Linked on site' : 'Not found')}</p>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-2.5 p-2.5 sm:p-3 rounded-xl bg-zinc-950/50 border border-zinc-800/50">
                                                                <div className="min-w-0 w-full">
                                                                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none mb-1.5 ml-1">Instagram Find</p>
                                                                    <div className="flex items-center gap-2">
                                                                        {drawerLead?.instagram_url || enrichment?.socials?.instagram ? (() => {
                                                                            const rawUrl = drawerLead.instagram_url || enrichment?.socials?.instagram?.url;
                                                                            if (!rawUrl) return null;
                                                                            let handle = 'Connect';
                                                                            try {
                                                                                const urlObj = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
                                                                                const pathParts = urlObj.pathname.split('/').filter(Boolean);
                                                                                if (pathParts.length > 0) handle = `@${pathParts[0]}`;
                                                                            } catch (e) {
                                                                                // If not a valid URL, it might be just a handle
                                                                                if (rawUrl && !rawUrl.includes('/')) handle = `@${rawUrl.replace('@', '')}`;
                                                                            }

                                                                            const finalUrl = rawUrl.startsWith('http') ? rawUrl : (rawUrl.includes('/') ? `https://${rawUrl}` : `https://instagram.com/${rawUrl.replace('@', '')}`);

                                                                            return (
                                                                                <a href={finalUrl} target="_blank" rel="noreferrer" className="bg-zinc-900 p-1.5 rounded-lg shadow-sm border border-zinc-800 hover:scale-105 transition-all hover:border-brand/40 group/soc flex items-center gap-2 px-3 flex-1 min-w-0">
                                                                                    <Instagram className="h-4 w-4 text-brand/80 group-hover/soc:text-brand shrink-0" />
                                                                                    <span className="text-[10px] font-black text-zinc-100 uppercase tracking-widest truncate">{handle}</span>
                                                                                </a>
                                                                            );
                                                                        })() : (
                                                                            <span className="text-xs font-medium text-zinc-600 ml-1 italic">Not found</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Manual Audit Section (Relocated) */}
                                                    <div className="bg-zinc-900/60 backdrop-blur-md rounded-2xl border-2 border-dashed border-brand/40 shadow-xl p-5 relative overflow-hidden group hover:border-brand/60 transition-all">
                                                        <div className="absolute top-0 right-0 w-32 h-32 bg-brand/5 rounded-bl-full -mr-6 -mt-6"></div>
                                                        <div className="flex items-center gap-2 mb-5 relative z-10">
                                                            <div className="h-8 w-8 rounded-full bg-zinc-950 flex items-center justify-center border border-zinc-800"><PenLine className="h-4 w-4 text-brand" /></div>
                                                            <h3 className="font-bold text-zinc-100 text-base uppercase tracking-tighter">Manual Intelligence</h3>
                                                            <Badge variant="outline" className="ml-auto text-[9px] uppercase tracking-widest font-black text-brand border-brand/20 bg-brand/5">Audit Notes</Badge>
                                                        </div>

                                                        <div className="space-y-4 relative z-10">
                                                            {/* Notes */}
                                                            <div>
                                                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><MessageSquare className="h-3 w-3 text-brand" /> Audit Comments</label>
                                                                <Textarea
                                                                    placeholder="Add your manual audit notes here..."
                                                                    className="min-h-[100px] text-sm bg-zinc-950 border-zinc-800 text-zinc-100 focus:border-brand/50 focus:ring-brand/20 rounded-xl resize-none shadow-inner"
                                                                    value={manualNotes}
                                                                    onChange={(e) => setManualNotes(e.target.value)}
                                                                />
                                                            </div>

                                                            {/* IG Metrics */}
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div className="space-y-1.5">
                                                                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5"><Instagram className="h-3 w-3 text-brand" /> IG Followers</label>
                                                                    <Input
                                                                        type="number"
                                                                        placeholder="e.g. 5200"
                                                                        className="h-11 text-sm bg-zinc-950 border-zinc-800 text-zinc-100 rounded-xl focus:border-brand/50 focus:ring-brand/20"
                                                                        value={igFollowers}
                                                                        onChange={(e) => setIgFollowers(e.target.value)}
                                                                    />
                                                                </div>
                                                                <div className="space-y-1.5">
                                                                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5"><Users className="h-3 w-3 text-brand" /> Activity</label>
                                                                    <Select value={igActivity} onValueChange={(val) => setIgActivity(val || '')}>
                                                                        <SelectTrigger className="h-11 text-sm bg-zinc-950 border-zinc-800 text-zinc-100 rounded-xl focus:border-brand/50 focus:ring-brand/20">
                                                                            <SelectValue placeholder="Select..." />
                                                                        </SelectTrigger>
                                                                        <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
                                                                            <SelectItem value="very_active">🟢 Very Active</SelectItem>
                                                                            <SelectItem value="mid_active">🟡 Mid Active</SelectItem>
                                                                            <SelectItem value="low_active">🟠 Low Active</SelectItem>
                                                                            <SelectItem value="not_active">🔴 Not Active</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                            </div>

                                                            {/* Manual Instagram Handle */}
                                                            <div>
                                                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><Instagram className="h-3 w-3 text-brand" /> Instagram Handle/URL</label>
                                                                <Input
                                                                    placeholder="e.g. @fadeaway_performance or full URL"
                                                                    className="h-11 text-sm bg-zinc-950 border-zinc-800 text-zinc-100 rounded-xl focus:border-brand/50 focus:ring-brand/20 shadow-inner"
                                                                    value={manualIg}
                                                                    onChange={(e) => setManualIg(e.target.value)}
                                                                />
                                                            </div>

                                                            {/* Manual Contact */}
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div className="space-y-1.5">
                                                                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5"><Mail className="h-3 w-3 text-brand" /> Add Email</label>
                                                                    <Input
                                                                        type="email"
                                                                        placeholder="name@company.com"
                                                                        className="h-11 text-sm bg-zinc-950 border-zinc-800 text-zinc-100 rounded-xl focus:border-brand/50 focus:ring-brand/20"
                                                                        value={manualEmail}
                                                                        onChange={(e) => setManualEmail(e.target.value)}
                                                                    />
                                                                </div>
                                                                <div className="space-y-1.5">
                                                                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5"><Phone className="h-3 w-3 text-brand" /> Add Phone</label>
                                                                    <Input
                                                                        type="tel"
                                                                        placeholder="+1 (555) 000-0000"
                                                                        className="h-11 text-sm bg-zinc-950 border-zinc-800 text-zinc-100 rounded-xl focus:border-brand/50 focus:ring-brand/20"
                                                                        value={manualPhone}
                                                                        onChange={(e) => setManualPhone(e.target.value)}
                                                                    />
                                                                </div>
                                                            </div>

                                                            {/* Save Button */}
                                                            <Button
                                                                className="w-full h-12 font-black text-brand bg-brand/5 hover:bg-brand/10 border border-brand/20 hover:border-brand/40 transition-all uppercase tracking-widest text-[11px] rounded-xl shadow-sm"
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
                                                                            instagram_url: manualIg || undefined,
                                                                        });
                                                                        if (result.error) {
                                                                            toast.error(result.error);
                                                                        } else {
                                                                            toast.success('Manual audit data saved!');

                                                                            const updatedEmail = manualEmail || drawerLead.auditData?.email || drawerLead.email;
                                                                            const updatedPhone = manualPhone || drawerLead.phone;
                                                                            const updatedIg = manualIg || drawerLead.instagram_url;

                                                                            // Update Drawer Lead
                                                                            setDrawerLead({
                                                                                ...drawerLead,
                                                                                manual_notes: manualNotes,
                                                                                ig_followers: igFollowers ? parseInt(igFollowers) : null,
                                                                                ig_activity: igActivity,
                                                                                email: updatedEmail,
                                                                                phone: updatedPhone,
                                                                                instagram_url: updatedIg,
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
                                                                                instagram_url: updatedIg,
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
                                    </TabsContent>

                                    <TabsContent value="audit" className="flex-1 flex flex-col overflow-hidden">
                                        <div className="flex-1 overflow-y-auto w-full p-6 space-y-8 bg-zinc-900/20 shadow-inner [scrollbar-gutter:stable]">
                                            {!enrichment ? (
                                                <div className="flex flex-col items-center justify-center p-12 rounded-3xl border border-zinc-800 border-dashed bg-zinc-900/20 text-zinc-500 gap-6 transition-all duration-300">
                                                    <div className="h-16 w-16 bg-zinc-900 rounded-2xl flex items-center justify-center border border-zinc-800 shadow-xl group/icon">
                                                        {isAuditing[drawerLead.id] ? (
                                                            <Loader2 className="h-8 w-8 text-brand animate-spin" />
                                                        ) : (
                                                            <Sparkles className="h-8 w-8 text-zinc-700 group-hover/icon:text-brand transition-colors" />
                                                        )}
                                                    </div>
                                                    <div className="text-center space-y-2">
                                                        <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Deep Intel Required</p>
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 max-w-[240px] leading-relaxed mx-auto">
                                                            Run a 1-click SEO AI Audit to uncover technical gaps, hidden contacts, and pixel data.
                                                        </p>
                                                    </div>
                                                    <Button
                                                        onClick={() => handleRunAudit(drawerLead)}
                                                        disabled={isAuditing[drawerLead.id]}
                                                        className="bg-brand/10 hover:bg-brand/20 text-brand border border-brand/20 hover:border-brand/40 font-black uppercase tracking-widest text-[10px] h-11 px-8 rounded-xl shadow-sm active:scale-95 transition-all"
                                                    >
                                                        {isAuditing[drawerLead.id] ? (
                                                            <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> Deep Auditing...</>
                                                        ) : (
                                                            <><Terminal className="h-3.5 w-3.5 mr-2" /> Run AI Site Audit</>
                                                        )}
                                                    </Button>
                                                </div>
                                            ) : (
                                                <>
                                                    {/* AI Score Full Width */}
                                                    {audit?.rawScrape?.scoreBreakdown && (() => {
                                                        const sb: ScoreBreakdown = audit.rawScrape.scoreBreakdown;
                                                        const categories = [
                                                            { label: 'UX Decay & Tech', score: sb.uxDecayTechnical, max: 45, from: 'from-rose-400', to: 'to-rose-500', icon: '🚨', bg: 'bg-rose-50/50', border: 'border-rose-100/50' },
                                                            { label: 'Maturity & Cash', score: sb.cashFlowMaturity, max: 30, from: 'from-blue-400', to: 'to-indigo-500', icon: '💼', bg: 'bg-indigo-50/50', border: 'border-indigo-100/50' },
                                                            { label: 'Contact Access', score: sb.contactability, max: 25, from: 'from-emerald-400', to: 'to-teal-500', icon: '📞', bg: 'bg-emerald-50/50', border: 'border-emerald-100/50' },
                                                        ];
                                                        return (
                                                            <div className="bg-zinc-900/60 backdrop-blur-md rounded-2xl border border-zinc-800 shadow-xl overflow-hidden relative group">
                                                                <div className="p-5 flex flex-col gap-4 relative z-10">
                                                                    <h3 className="font-bold text-zinc-100 flex items-center gap-2 uppercase tracking-tighter"><Activity className="h-4 w-4 text-brand" /> AI Score Breakdown <span className="ml-auto bg-zinc-950 text-brand text-[10px] px-2.5 py-1 rounded-md font-black border border-zinc-800/80">{sb.total}/100</span></h3>
                                                                    <div className="grid grid-cols-3 gap-3">
                                                                        {categories.map((cat, i) => (
                                                                            <div key={i} className={`flex flex-col gap-2.5 p-3.5 bg-zinc-950/50 rounded-xl border border-zinc-800/50 shadow-inner group/cat hover:border-zinc-700/50 transition-all`}>
                                                                                <div className="flex flex-col gap-0.5">
                                                                                    <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest truncate">{cat.label}</span>
                                                                                    <span className="font-black text-zinc-200 text-sm">{cat.score || 0}<span className="text-zinc-600 text-[10px] font-bold">/{cat.max}</span></span>
                                                                                </div>
                                                                                <div className="h-1.5 bg-zinc-900 rounded-full w-full overflow-hidden">
                                                                                    <div
                                                                                        className={`h-full bg-gradient-to-r ${cat.from} ${cat.to} rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(0,0,0,0.5)]`}
                                                                                        style={{ width: `${Math.min((cat.score || 0) / cat.max, 1) * 100}%` }}
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>

                                                                    {sb.rulesTriggered && sb.rulesTriggered.length > 0 && (
                                                                        <div className="mt-2 pt-4 border-t border-zinc-800/80">
                                                                            <div className="flex flex-wrap gap-1.5">
                                                                                {sb.rulesTriggered.map((rule: string, i: number) => (
                                                                                    <span key={i} className="text-[9px] font-black uppercase tracking-wider px-2 py-1 bg-rose-500/10 text-rose-400 rounded-md border border-rose-500/20 flex items-center gap-1.5 shadow-sm">
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
                                                        <div className="bg-zinc-900/60 backdrop-blur-md flex flex-col rounded-2xl border border-zinc-800 shadow-xl p-5 hover:border-brand/30 transition-all relative overflow-hidden group">
                                                            <div className="absolute top-0 right-0 w-24 h-24 bg-brand/5 rounded-bl-[100px] -mr-4 -mt-4 transition-transform duration-500 group-hover:scale-[1.3]"></div>
                                                            <h3 className="font-bold text-zinc-100 mb-4 flex items-center gap-2 relative z-10 uppercase tracking-tighter text-sm"><Code2 className="h-4 w-4 text-brand" /> Technical SEO</h3>
                                                            <div className="space-y-1.5 relative z-10 flex-1">
                                                                {enrichment && [
                                                                    { label: 'Title Tag', ok: !enrichment.seo.titleTag.isEmpty },
                                                                    { label: 'H1 Header', ok: enrichment.seo.h1Tags.count > 0 },
                                                                    { label: 'Meta Desc', ok: enrichment.seo.metaDescription.exists },
                                                                    { label: 'Mobile Viewport', ok: enrichment.seo.hasViewport },
                                                                    { label: 'NoIndex (Flaw)', ok: !enrichment.seo.hasNoIndex },
                                                                ].map((item, idx) => (
                                                                    <div key={idx} className="flex items-center justify-between bg-zinc-950/40 px-3 py-2 rounded-lg text-[10px] border border-zinc-800/50 shadow-inner">
                                                                        <span className="font-bold text-zinc-400 uppercase tracking-widest">{item.label}</span>
                                                                        {item.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.2)]" /> : <XCircle className="h-3.5 w-3.5 text-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.2)]" />}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-col gap-4">
                                                            <div className="bg-zinc-900/60 backdrop-blur-md rounded-2xl border border-zinc-800 shadow-xl p-5 hover:border-brand/30 transition-all relative overflow-hidden group">
                                                                <div className="absolute top-0 right-0 w-20 h-20 bg-brand/5 rounded-bl-[100px] -mr-4 -mt-4 transition-transform duration-500 group-hover:scale-[1.3]"></div>
                                                                <h3 className="font-bold text-zinc-100 mb-3 flex items-center gap-2 relative z-10 uppercase tracking-tighter text-sm"><Terminal className="h-4 w-4 text-brand" /> Tracking Pixels</h3>
                                                                <div className="space-y-1.5 relative z-10">
                                                                    <div className="flex items-center justify-between bg-zinc-950/40 px-3 py-2 rounded-lg text-[10px] border border-zinc-800/50 shadow-inner">
                                                                        <span className="font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5"><div className="w-1 h-1 rounded-full bg-blue-500"></div> Meta Pixel</span>
                                                                        {enrichment?.pixels?.hasMetaPixel ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <XCircle className="h-3.5 w-3.5 text-zinc-700" />}
                                                                    </div>
                                                                    <div className="flex items-center justify-between bg-zinc-950/40 px-3 py-2 rounded-lg text-[10px] border border-zinc-800/50 shadow-inner">
                                                                        <span className="font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5"><div className="w-1 h-1 rounded-full bg-amber-500"></div> Google Ads</span>
                                                                        {enrichment?.pixels?.hasGoogleAds ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <XCircle className="h-3.5 w-3.5 text-zinc-700" />}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="bg-zinc-900/60 backdrop-blur-md rounded-2xl border border-zinc-800 shadow-xl p-4 hover:border-brand/30 transition-all relative overflow-hidden group flex-1">
                                                                <div className="absolute top-0 right-0 w-20 h-20 bg-brand/5 rounded-bl-[100px] -mr-4 -mt-4 transition-transform duration-500 group-hover:scale-[1.3]"></div>
                                                                <h3 className="font-bold text-zinc-100 mb-3 flex items-center gap-2 relative z-10 uppercase tracking-tighter text-sm"><LinkIcon className="h-4 w-4 text-brand" /> Conversion Funnel</h3>
                                                                <div className="space-y-2 relative z-10">
                                                                    <div className="flex items-center justify-between bg-zinc-950/40 px-3 py-2 rounded-lg text-[10px] border border-zinc-800/50 shadow-inner">
                                                                        <span className="font-bold text-zinc-400 uppercase tracking-widest">General CTA Found</span>
                                                                        {enrichment?.ctas?.hasGeneralCTA ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <XCircle className="h-3.5 w-3.5 text-rose-500" />}
                                                                    </div>
                                                                    {enrichment?.ctas?.bookingUrls && enrichment.ctas.bookingUrls.length > 0 && (
                                                                        <div className="mt-2 space-y-1">
                                                                            {enrichment.ctas.bookingUrls.map((b: any, i: number) => (
                                                                                <a key={i} href={b.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-zinc-950/40 p-1.5 rounded-lg border border-zinc-800/50 hover:border-brand/30 hover:bg-zinc-900 transition-colors">
                                                                                    <Badge variant="secondary" className="text-[9px] bg-zinc-800 text-zinc-300 pointer-events-none px-1.5 py-0 h-4 border-none uppercase font-black">{b.platform}</Badge>
                                                                                    <span className="text-[10px] text-zinc-400 truncate max-w-[110px] font-bold">{b.url}</span>
                                                                                </a>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="bg-zinc-900/60 backdrop-blur-md flex flex-col rounded-2xl border border-zinc-800 shadow-xl p-5 hover:border-brand/30 transition-all relative overflow-hidden group">
                                                            <div className="absolute top-0 left-0 w-24 h-24 bg-brand/5 rounded-br-[100px] -ml-4 -mt-4 transition-transform duration-500 group-hover:scale-[1.3]"></div>
                                                            <h3 className="font-bold text-zinc-100 mb-4 flex items-center gap-2 relative z-10 uppercase tracking-tighter text-sm"><Clock className="h-4 w-4 text-brand" /> UX Decay Factors</h3>
                                                            <div className="space-y-2 relative z-10 flex-1">
                                                                <div className="flex items-center justify-between bg-zinc-950/40 px-3 py-3 rounded-lg text-[10px] border border-zinc-800/50 shadow-inner">
                                                                    <span className="font-bold text-zinc-400 uppercase tracking-widest">Copyright ({enrichment?.uxDecay?.copyrightYear || 'N/A'})</span>
                                                                    {enrichment?.uxDecay?.isOutdatedCopyright ? <Badge variant="destructive" className="bg-rose-500/10 text-rose-400 shadow-none border border-rose-500/20 text-[9px] px-1.5 py-0 h-4 uppercase tracking-widest font-black">Outdated</Badge> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                                                                </div>
                                                                <div className="flex items-center justify-between bg-zinc-950/40 px-3 py-3 rounded-lg text-[10px] border border-zinc-800/50 shadow-inner">
                                                                    <span className="font-bold text-zinc-400 uppercase tracking-widest">Cheap Web Builder</span>
                                                                    {enrichment?.uxDecay?.usesCheapBuilder ? <Badge variant="destructive" className="bg-rose-500/10 text-rose-400 shadow-none border border-rose-500/20 text-[9px] px-1.5 py-0 h-4 uppercase tracking-widest font-black">Detected</Badge> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="bg-zinc-900/60 backdrop-blur-md flex flex-col rounded-2xl border border-zinc-800 shadow-xl p-5 hover:border-brand/30 transition-all relative overflow-hidden group">
                                                            <div className="absolute top-0 right-0 w-24 h-24 bg-brand/5 rounded-bl-[100px] -mr-4 -mt-4 transition-transform duration-500 group-hover:scale-[1.3]"></div>
                                                            <h3 className="font-bold text-zinc-100 mb-3 flex items-center gap-2 relative z-10 uppercase tracking-tighter text-sm"><TrendingUp className="h-4 w-4 text-brand" /> Keywords</h3>
                                                            <div className="flex flex-wrap gap-1.5 relative z-10 content-start flex-1">
                                                                {enrichment?.expansionKeywords && enrichment.expansionKeywords.length > 0 ? (
                                                                    enrichment.expansionKeywords.map((kw: string, i: number) => (
                                                                        <span key={i} className="px-2.5 py-1 bg-brand/10 text-brand text-[9px] font-black uppercase tracking-widest rounded-md border border-brand/20 shadow-sm">{kw}</span>
                                                                    ))
                                                                ) : (
                                                                    <span className="text-xs text-zinc-600 italic">None detected</span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* PageSpeed Performance */}
                                                        <div className="col-span-1 md:col-span-2 bg-zinc-900/60 backdrop-blur-md flex flex-col rounded-2xl border border-zinc-800 shadow-xl p-5 hover:border-brand/30 transition-all relative overflow-hidden group mt-2">
                                                            <div className="absolute top-0 right-0 w-24 h-24 bg-brand/5 rounded-bl-[100px] -mr-4 -mt-4 transition-transform duration-500 group-hover:scale-[1.3]"></div>
                                                            <div className="flex items-center justify-between mb-4 relative z-10 w-full">
                                                                <h3 className="font-bold text-zinc-100 flex items-center gap-2 uppercase tracking-tighter text-sm"><Activity className="h-4 w-4 text-brand" /> Core Web Vitals (PageSpeed)</h3>
                                                                {audit?.rawScrape?.seoAudit?.pagespeed_mobile === undefined && (
                                                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-950 border border-zinc-800/80 shadow-inner">
                                                                        <Loader2 className="h-3 w-3 text-brand animate-spin" />
                                                                        <span className="text-[9px] uppercase tracking-widest font-black text-zinc-500">Fetching</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10 w-full">
                                                                {/* Mobile */}
                                                                <div className="flex items-center justify-between bg-zinc-950/40 px-4 py-3 rounded-xl border border-zinc-800/50 shadow-inner hover:border-brand/30 transition-colors">
                                                                    <span className="font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2"><Smartphone className="h-4 w-4 text-brand" /> Mobile Score</span>
                                                                    <div className="flex items-center gap-2">
                                                                        {audit?.rawScrape?.seoAudit?.pagespeed_mobile !== undefined ? (
                                                                            audit.rawScrape.seoAudit.pagespeed_mobile !== null ? (
                                                                                <span className={cn("text-xl font-black italic", audit.rawScrape.seoAudit.pagespeed_mobile >= 90 ? "text-emerald-500" : audit.rawScrape.seoAudit.pagespeed_mobile >= 50 ? "text-amber-500" : "text-rose-500")}>
                                                                                    {audit.rawScrape.seoAudit.pagespeed_mobile}
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-xs text-zinc-600 font-bold uppercase">N/A</span>
                                                                            )
                                                                        ) : (
                                                                            <div className="h-5 w-8 bg-zinc-800 animate-pulse rounded"></div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                {/* Desktop */}
                                                                <div className="flex items-center justify-between bg-zinc-950/40 px-4 py-3 rounded-xl border border-zinc-800/50 shadow-inner hover:border-brand/30 transition-colors">
                                                                    <span className="font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2"><Monitor className="h-4 w-4 text-brand" /> Desktop Score</span>
                                                                    <div className="flex items-center gap-2">
                                                                        {audit?.rawScrape?.seoAudit?.pagespeed_desktop !== undefined ? (
                                                                            audit.rawScrape.seoAudit.pagespeed_desktop !== null ? (
                                                                                <span className={cn("text-xl font-black italic", audit.rawScrape.seoAudit.pagespeed_desktop >= 90 ? "text-emerald-500" : audit.rawScrape.seoAudit.pagespeed_desktop >= 50 ? "text-amber-500" : "text-rose-500")}>
                                                                                    {audit.rawScrape.seoAudit.pagespeed_desktop}
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-xs text-zinc-600 font-bold uppercase">N/A</span>
                                                                            )
                                                                        ) : (
                                                                            <div className="h-5 w-8 bg-zinc-800 animate-pulse rounded"></div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                </>
                                            )}
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="outreach" className="flex-1 flex flex-col overflow-hidden bg-zinc-900/20">
                                        <div className="flex-1 overflow-y-auto w-full p-6 space-y-8 shadow-inner [scrollbar-gutter:stable] min-h-[300px]">
                                            {!audit ? (
                                                <div className="flex flex-col items-center justify-center p-12 rounded-3xl border border-zinc-800 border-dashed bg-zinc-900/20 text-zinc-500 gap-6 transition-all duration-300">
                                                    <div className="h-16 w-16 bg-zinc-900 rounded-2xl flex items-center justify-center border border-zinc-800 shadow-xl group/icon">
                                                        <Activity className="h-8 w-8 text-zinc-700 group-hover/icon:text-brand transition-colors" />
                                                    </div>
                                                    <div className="text-center space-y-2">
                                                        <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Deep Intel Required</p>
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 max-w-[240px] leading-relaxed mx-auto">
                                                            Run an SEO AI Audit in the Business Intel tab before generating outreach.
                                                        </p>
                                                    </div>
                                                </div>
                                            ) : isGeneratingAI ? (
                                                <div className="py-20 flex flex-col items-center justify-center text-center">
                                                    <Loader2 className="h-10 w-10 text-brand animate-spin mb-4" />
                                                    <h3 className="text-lg text-zinc-100 uppercase font-black">Generating hyper-personalized pitch...</h3>
                                                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-2">Analyzing audit data, manual notes, and finding pain points.</p>
                                                </div>
                                            ) : aiSuggestions ? (
                                                <div className="space-y-6 max-w-3xl mx-auto w-full pb-10">
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                        <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-800 shadow-inner">
                                                            <h4 className="font-black text-brand text-[10px] mb-3 flex items-center gap-1.5 uppercase tracking-widest"><Search className="h-4 w-4" /> Key Findings</h4>
                                                            <ul className="text-[11px] text-zinc-400 space-y-2 list-disc pl-4 font-medium">
                                                                {aiSuggestions.keyFindings?.map((f: string, i: number) => <li key={i}>{f}</li>)}
                                                            </ul>
                                                        </div>
                                                        <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-800 shadow-inner">
                                                            <h4 className="font-black text-rose-500 text-[10px] mb-3 flex items-center gap-1.5 uppercase tracking-widest"><AlertCircle className="h-4 w-4" /> Pain Points</h4>
                                                            <ul className="text-[11px] text-zinc-400 space-y-2 list-disc pl-4 font-medium">
                                                                {aiSuggestions.painPoints?.map((p: string, i: number) => <li key={i}>{p}</li>)}
                                                            </ul>
                                                        </div>
                                                    </div>

                                                    <Tabs defaultValue="email" className="w-full" onValueChange={setActiveReachoutTab}>
                                                        <TabsList className="grid grid-cols-2 mb-6 bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
                                                            <TabsTrigger value="email" className="rounded-lg text-zinc-500 hover:text-zinc-300 font-black text-[11px] uppercase tracking-widest data-[state=active]:bg-zinc-800 data-[state=active]:text-brand shadow-none transition-all">
                                                                <Mail className="h-4 w-4 mr-2" /> Email Pitch
                                                            </TabsTrigger>
                                                            <TabsTrigger value="dm" className="rounded-lg text-zinc-500 hover:text-zinc-300 font-black text-[11px] uppercase tracking-widest data-[state=active]:bg-zinc-800 data-[state=active]:text-brand shadow-none transition-all">
                                                                <Instagram className="h-4 w-4 mr-2" /> Instagram DM
                                                            </TabsTrigger>
                                                        </TabsList>

                                                        <TabsContent value="email" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                                            <div className="space-y-1.5">
                                                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5 block">Subject Line</label>
                                                                <Input
                                                                    value={aiSuggestions.subjectLine}
                                                                    onChange={(e) => setAiSuggestions({ ...aiSuggestions, subjectLine: e.target.value })}
                                                                    className="font-bold bg-zinc-950 border-zinc-800 text-zinc-100 rounded-xl focus:border-brand/50 focus:ring-brand/20 h-11"
                                                                />
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5 block flex justify-between items-center">
                                                                    Email Body
                                                                    <span className="text-brand text-[9px] font-black tracking-widest">Supports Markdown</span>
                                                                </label>
                                                                <Textarea
                                                                    value={aiSuggestions.emailBody}
                                                                    onChange={(e) => setAiSuggestions({ ...aiSuggestions, emailBody: e.target.value })}
                                                                    className="min-h-[220px] text-sm leading-relaxed bg-zinc-950 border-zinc-800 text-zinc-200 rounded-xl focus:border-brand/50 focus:ring-brand/20 resize-y shadow-inner p-4"
                                                                />
                                                            </div>
                                                        </TabsContent>

                                                        <TabsContent value="dm" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                                            <div className="space-y-1.5">
                                                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5 block flex justify-between items-center">
                                                                    Instagram Direct Message
                                                                    <span className="text-brand text-[9px] font-black tracking-widest">Punchy & Short</span>
                                                                </label>
                                                                <Textarea
                                                                    value={aiSuggestions.dmBody}
                                                                    onChange={(e) => setAiSuggestions({ ...aiSuggestions, dmBody: e.target.value })}
                                                                    className="min-h-[160px] text-sm leading-relaxed bg-zinc-950 border-zinc-800 text-zinc-200 rounded-xl focus:border-brand/50 focus:ring-brand/20 resize-y shadow-inner p-4"
                                                                />
                                                            </div>
                                                            <div className="p-4 bg-brand/5 rounded-xl border border-brand/20 flex items-start gap-3 shadow-inner">
                                                                <div className="bg-brand/10 p-1.5 rounded-lg border border-brand/20"><Activity className="h-4 w-4 text-brand" /></div>
                                                                <p className="text-[11px] text-zinc-400 leading-relaxed font-medium">
                                                                    <strong className="text-brand uppercase tracking-widest font-black mr-1">Pro Tip:</strong> DMs work best when sent directly from your mobile app. Copy this suggestion and paste it into Instagram!
                                                                </p>
                                                            </div>
                                                        </TabsContent>
                                                    </Tabs>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center p-12 rounded-3xl border border-zinc-800 border-dashed bg-zinc-900/20 text-zinc-500 gap-6 transition-all duration-300">
                                                    <div className="h-20 w-20 bg-zinc-900 rounded-3xl flex items-center justify-center border border-zinc-800 shadow-2xl relative group/icon">
                                                        <div className="absolute inset-0 bg-brand/5 rounded-3xl blur-xl group-hover/icon:bg-brand/10 transition-colors"></div>
                                                        <Wand2 className="h-8 w-8 text-zinc-700 group-hover/icon:text-brand transition-colors relative z-10" />
                                                    </div>
                                                    <div className="text-center space-y-2">
                                                        <h3 className="text-sm font-black text-zinc-300 uppercase tracking-[0.3em]">AI Outreach Pitch</h3>
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 max-w-[280px] leading-relaxed mx-auto">
                                                            Generate a tailored email sequence for {drawerLead.name} based on audit data.
                                                        </p>
                                                    </div>
                                                    <Button
                                                        onClick={async () => {
                                                            setIsGeneratingAI(true);
                                                            try {
                                                                const res = await generateOutreachSuggestions({
                                                                    name: drawerLead.name,
                                                                    niche: drawerLead.niche,
                                                                    website: drawerLead.website,
                                                                    score: audit?.score,
                                                                    seoScore: audit?.rawScrape?.scoreBreakdown?.uxDecayTechnical,
                                                                    localIntentScore: audit?.rawScrape?.scoreBreakdown?.cashFlowMaturity,
                                                                    contactabilityScore: audit?.rawScrape?.scoreBreakdown?.contactability,
                                                                    biggestWeakness: audit?.biggestWeakness,
                                                                    manualNotes: manualNotes || drawerLead.manual_notes,
                                                                    rawAudit: audit?.rawScrape
                                                                });
                                                                if (res.error) throw new Error(res.error);
                                                                setAiSuggestions(res.data);
                                                            } catch (e: any) {
                                                                toast.error(e.message || "Failed to generate pitch");
                                                            } finally {
                                                                setIsGeneratingAI(false);
                                                            }
                                                        }}
                                                        className="bg-brand/10 hover:bg-brand/20 text-brand border border-brand/20 hover:border-brand/40 font-black uppercase tracking-widest text-[10px] h-11 px-8 rounded-xl shadow-sm active:scale-95 transition-all mt-4"
                                                    >
                                                        <Sparkles className="h-3.5 w-3.5 mr-2" /> Generate AI Pitch
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                        {aiSuggestions && (
                                            <div className="p-4 sm:p-5 bg-zinc-950 border-t border-zinc-800/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0 shadow-[0_-20px_40px_rgba(0,0,0,0.5)]">
                                                <div className="flex flex-col px-2 w-full sm:w-auto min-w-0">
                                                    <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-0.5">To:</span>
                                                    <span className="text-[11px] text-zinc-200 font-black uppercase tracking-widest truncate">{audit?.email || drawerLead?.email || 'No email found'}</span>
                                                </div>
                                                <div className="flex gap-3 mt-2 sm:mt-0 w-full sm:w-auto">
                                                    <Button variant="outline" onClick={() => setAiSuggestions(null)} className="flex-1 sm:flex-none h-11 px-4 sm:px-6 rounded-xl border-zinc-800 text-zinc-400 hover:bg-zinc-800 font-bold uppercase tracking-widest text-[10px]">Discard</Button>
                                                    {activeReachoutTab === 'email' ? (
                                                        <Button
                                                            className="flex-1 sm:flex-none h-11 px-4 sm:px-7 font-black text-brand bg-brand/10 hover:bg-brand/20 border border-brand/20 hover:border-brand/40 shadow-sm rounded-xl transition-all uppercase tracking-widest text-[11px]"
                                                            disabled={isSendingEmail || (!audit?.email && !drawerLead?.email)}
                                                            onClick={async () => {
                                                                const emailToSend = audit?.email || drawerLead?.email;
                                                                const companyId = drawerLead.companyId || audit?.companyId;

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
                                                                    setAiSuggestions(null);

                                                                    // Persist status to DB
                                                                    await updateLeadStatus(companyId, 'Contacted');

                                                                    // Update local status so UI reflects 'Contacted'
                                                                    const newResults = results.map(r => r.id === (drawerLead?.id || '') ? { ...r, status: 'Contacted' } : r);
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
                                                            className="flex-1 sm:flex-none h-11 px-4 sm:px-7 font-black text-zinc-950 bg-brand hover:bg-brand/90 shadow-[0_0_20px_rgba(255,107,0,0.15)] rounded-xl border-0 transition-all uppercase tracking-widest text-[11px]"
                                                            onClick={async () => {
                                                                navigator.clipboard.writeText(aiSuggestions.dmBody);
                                                                toast.success("DM copied to clipboard!");
                                                                setAiSuggestions(null);
                                                            }}
                                                        >
                                                            <Download className="h-4 w-4 mr-2" /> Copy DM
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </TabsContent>
                                </Tabs>
                            </div>
                        );
                    })()}
                </DialogContent>
            </Dialog>
        </div>
    );
}
