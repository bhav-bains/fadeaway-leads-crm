"use client";

import React, { useState, useMemo } from "react";
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
import { X, Search, MapPin, Building2, Download, Send, AlertCircle, ExternalLink, ChevronDown, ChevronRight, Mail, Globe, CheckCircle2, XCircle, Eye, Instagram, Facebook, Activity, Code2, Terminal, Clock, Link as LinkIcon, TrendingUp, Phone, MessageSquare, Users, PenLine, Save, Wand2, Sparkles, Loader2, Star, Smartphone, Monitor, RefreshCw, Briefcase, CheckSquare } from "lucide-react";
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
import type { EnrichmentData, ScoreBreakdown, ScoringRule } from "@/lib/scraper";

export default function LeadFinder() {
    const [niche, setNiche] = useState("");
    const [city, setCity] = useState("");
    const [citySearchTerm, setCitySearchTerm] = useState("");
    const [citySuggestions, setCitySuggestions] = useState<{ id: string, description: string }[]>([]);
    const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
    const [isSearchingCity, setIsSearchingCity] = useState(false);
    const [inboxSearch, setInboxSearch] = useState("");

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
    const [winProbability, setWinProbability] = useState('');
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
            setManualPhone(drawerLead.manual_phone || '');
            setManualIg(drawerLead.instagram_url || '');
            setWinProbability(drawerLead.win_probability || '');
        } else {
            setManualNotes('');
            setIgFollowers('');
            setIgActivity('');
            setManualEmail('');
            setManualPhone('');
            setManualIg('');
            setWinProbability('');
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

    const handleRunAudit = async (lead: Record<string, any>, force: boolean = false) => {
        // If already audited, just open the drawer unless we are forcing a re-audit
        const auditData = auditedLeads[lead.id];
        if (auditData && !force) {
            setDrawerLead({ ...lead, auditData });
            return;
        }

        setIsAuditing(prev => ({ ...prev, [lead.id]: true }));
        const { data, error } = await runLocalSeoAudit(
            lead.website,
            lead.city,
            lead.niche,
            {
                name: lead.name,
                address: lead.address,
                phone: lead.phone,
                reviewCount: lead.ratingCount,
                googlePlaceId: lead.id,
                primary_category: lead.primary_category
            }
        );
        setIsAuditing(prev => ({ ...prev, [lead.id]: false }));

        if (data) {
            setAuditedLeads(prev => ({ ...prev, [lead.id]: data }));
            if (drawerLead?.id === lead.id) {
                setDrawerLead({ ...lead, auditData: data });
            }
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
            const { data: auditData } = await runLocalSeoAudit(
                lead.website,
                lead.city,
                lead.niche,
                {
                    name: lead.name,
                    address: lead.address,
                    phone: lead.phone,
                    reviewCount: lead.ratingCount,
                    googlePlaceId: lead.id,
                    primary_category: lead.primary_category
                }
            );
            setIsAuditing(prev => ({ ...prev, [lead.id]: false }));
            if (auditData) {
                setAuditedLeads(prev => ({ ...prev, [lead.id]: auditData }));

                if (auditData.companyId && lead.website) {
                    fetchAndSavePageSpeed(auditData.companyId, lead.website).then(res => {
                        setAuditedLeads(prev => {
                            const current = prev[lead.id];
                            if (!current) return prev;
                            const newAudit = {
                                ...current,
                                score: res?.newScore?.total ?? current.score,
                                rawScrape: {
                                    ...current.rawScrape,
                                    totalScore: res?.newScore?.total ?? current.rawScrape?.totalScore,
                                    scoreBreakdown: res?.newScore || current.rawScrape?.scoreBreakdown,
                                    seoAudit: {
                                        ...current.rawScrape?.seoAudit,
                                        pagespeed_mobile: res?.success ? res.pagespeed_mobile : null,
                                        pagespeed_desktop: res?.success ? res.pagespeed_desktop : null,
                                        mobile_load_time: res?.success ? res.mobile_load_time : null,
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
                if (inboxSearch && !r.name.toLowerCase().includes(inboxSearch.toLowerCase())) return false;
                return true;
            });
            groupLeads.sort((a, b) => (b.ratingCount || 0) - (a.ratingCount || 0));
            return { groupName, groupLeads };
        }).filter(g => g.groupLeads.length > 0);
    }, [results, minScore, requireEmail, ratingFilter, auditedLeads]);

    const filteredResultsCount = groupedResultsArray.reduce((sum, g) => sum + g.groupLeads.length, 0);
    const auditedResultsCount = groupedResultsArray.reduce((sum, g) => sum + g.groupLeads.filter(r => auditedLeads[r.id]).length, 0);

    return (
        <div className="flex flex-col gap-10 pb-12 w-full min-w-0 bg-transparent text-zinc-100 font-sans p-8 sm:p-12 min-h-screen">
            <div className="flex flex-col gap-2">
                <h1 className="text-4xl sm:text-5xl font-black tracking-tighter uppercase font-heading">
                    PIPELINE SOURCING<span className="text-brand">.</span>
                </h1>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand/80 flex items-center gap-3">
                    <span className="h-[1px] w-4 bg-brand/50"></span>
                    ACCOUNT DISCOVERY & QUALIFICATION
                </p>
            </div>

            <Card className="rounded-3xl border border-zinc-700 bg-zinc-900/80 p-6 sm:p-8 shadow-2xl backdrop-blur-xl overflow-visible isolate relative group/search">
                <CardContent className="p-0 overflow-visible">
                    <form onSubmit={handleSearch} className="flex flex-col lg:flex-row gap-5 sm:gap-8 items-start lg:items-end w-full min-w-0 overflow-visible">
                        <div className="grid gap-2 w-full lg:flex-1 min-w-0">
                            <Label htmlFor="niche" className="font-bold text-[11px] uppercase tracking-widest text-zinc-400">Business Niche</Label>
                            <div className="relative w-full">
                                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500 pointer-events-none" />
                                <Input
                                    id="niche"
                                    name="niche"
                                    placeholder="e.g. Yoga Studio, MMA Gym, Spin Class, Basketball Academy"
                                    className="pl-11 h-12 bg-zinc-900 border-zinc-700 text-sm text-zinc-100 placeholder:text-zinc-500 w-full focus-visible:ring-brand/40 selection:bg-brand/30 selection:text-white autofill:shadow-[0_0_0_30px_#18181b_inset] autofill:[-webkit-text-fill-color:white] transition-all shadow-inner"
                                    value={niche}
                                    onChange={(e) => setNiche(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="grid gap-2 w-full lg:flex-1 min-w-0 relative">
                            <Label htmlFor="city" className="font-bold text-[11px] uppercase tracking-widest text-zinc-400">Target City</Label>
                            <div className="relative w-full">
                                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500 z-10 pointer-events-none" />
                                <Input
                                    id="city"
                                    name="city"
                                    placeholder="e.g. Vancouver, Seattle"
                                    className="pl-11 h-12 bg-zinc-900 border-zinc-700 text-sm text-zinc-100 placeholder:text-zinc-500 w-full focus-visible:ring-brand/40 selection:bg-brand/30 selection:text-white autofill:shadow-[0_0_0_30px_#18181b_inset] autofill:[-webkit-text-fill-color:white] transition-all shadow-inner"
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
                                    Find Leads
                                </Fragment>
                            )}
                        </Button>
                    </form>


                </CardContent>
            </Card>

            {results.length > 0 && (
                <div className="space-y-4 animate-in fade-in duration-500">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4 flex-1 w-full">
                            <h3 className="text-xs sm:text-[13px] font-black uppercase tracking-[0.2em] text-white">
                                Inbox - {filteredResultsCount} Sourced Leads, <span className="text-brand">{auditedResultsCount} Audited</span>
                            </h3>
                            <div className="flex-1 h-[1px] bg-zinc-800 hidden sm:block"></div>
                        </div>
                        <div className="relative w-full sm:w-72 shrink-0">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                            <Input 
                                placeholder="Search leads by name..." 
                                value={inboxSearch}
                                onChange={(e) => setInboxSearch(e.target.value)}
                                className="pl-10 h-10 bg-zinc-900 border-zinc-700 text-sm text-zinc-100 placeholder:text-zinc-500 w-full focus-visible:ring-brand/40 shadow-inner rounded-xl"
                            />
                        </div>
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
                                const groupAuditedCount = groupLeads.filter((r: any) => auditedLeads[r.id]).length;

                                return (
                                    <div key={groupName} className="space-y-6">
                                        <div
                                            className="flex items-center gap-4 cursor-pointer group/header select-none"
                                            onClick={() => toggleGroup(groupName, groupIndex)}
                                        >
                                            <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0 pr-2 sm:pr-0">
                                                <div className={cn(
                                                    "shrink-0 mt-0.5 sm:mt-0 p-1 rounded-md bg-zinc-900 border border-zinc-700/50 group-hover/header:border-brand/50 transition-all",
                                                    expanded && "border-brand/30"
                                                )}>
                                                    {expanded ? <ChevronDown className="h-4 w-4 text-brand" /> : <ChevronRight className="h-4 w-4 text-zinc-500" />}
                                                </div>
                                                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
                                                    <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-100 group-hover/header:text-brand transition-colors leading-[1.6] sm:leading-none break-words">
                                                        {groupName}
                                                    </h4>
                                                    <Badge variant="outline" className="shrink-0 w-fit bg-zinc-950/50 border-zinc-800 text-[10px] font-black tracking-widest px-3 h-6 rounded-full flex items-center gap-1.5 shadow-none transition-colors group-hover/header:border-zinc-700">
                                                        <span className="text-zinc-300">{groupLeads.length} LEADS</span>
                                                        <span className="text-zinc-700">|</span>
                                                        <span className={groupAuditedCount > 0 ? "text-brand shadow-[0_0_10px_rgba(255,102,0,0.15)]" : "text-zinc-500"}>
                                                            {groupAuditedCount} AUDITS
                                                        </span>
                                                    </Badge>
                                                </div>
                                            </div>
                                            <div className="hidden sm:block flex-1 h-[2px] bg-gradient-to-r from-zinc-800 to-transparent"></div>
                                        </div>

                                        {expanded && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8 animate-in fade-in slide-in-from-top-2 duration-300">
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
                                                                "h-full rounded-[2rem] border p-6 shadow-2xl shadow-black/40 backdrop-blur-xl transition-all duration-400 isolate relative overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-zinc-400/20 before:to-transparent group-hover:-translate-y-1",
                                                                auditData
                                                                    ? "border-zinc-700/60 bg-zinc-800/80 group-hover:border-brand/50 group-hover:bg-zinc-800 group-hover:shadow-[0_0_40px_rgba(255,102,0,0.15)]"
                                                                    : "border-zinc-700/60 bg-zinc-800/30 group-hover:border-brand/50 group-hover:bg-zinc-800/60 group-hover:shadow-[0_0_40px_rgba(255,102,0,0.12)]"
                                                            )}>
                                                                <div className="flex flex-col h-full gap-5">
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
                                                                        <div className="flex items-center gap-2 text-zinc-400 text-[12px] font-bold uppercase tracking-[0.15em]">
                                                                            <div className="bg-zinc-800/50 p-1 rounded-md">
                                                                                <MapPin className="h-3.5 w-3.5 shrink-0 text-brand/70" />
                                                                            </div>
                                                                            <span className="truncate">{result.city}</span>
                                                                        </div>
                                                                    </div>

                                                                    {auditData ? (
                                                                        <div className="mt-auto pt-4 flex items-center justify-between border-t border-zinc-800/50">
                                                                            <div className="flex items-center gap-2.5">
                                                                                <Activity className="h-4 w-4 text-emerald-400" />
                                                                                <div className="flex items-baseline gap-0.5">
                                                                                    <span className="text-[26px] font-black text-white tracking-tighter leading-none">
                                                                                        {auditData.score !== undefined ? `${auditData.score}` : '-'}
                                                                                    </span>
                                                                                    <span className="text-[12px] font-bold text-zinc-500 leading-[1.2]">/{auditData.max_score === 100 || auditData.rawScrape?.seoAudit?.pagespeed_mobile !== null ? 100 : 85}</span>
                                                                                </div>
                                                                            </div>
                                                                            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest group-hover:text-brand transition-colors flex items-center gap-1.5">
                                                                                Send Outreach
                                                                                <ChevronRight className="h-3.5 w-3.5 -mr-1" />
                                                                            </span>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="mt-auto pt-4 flex items-center justify-center border-t border-zinc-800/50">
                                                                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest group-hover:text-brand/80 transition-colors pt-3 flex items-center gap-2">
                                                                                <Sparkles className="h-3 w-3" />
                                                                                Click to Audit
                                                                            </span>
                                                                        </div>
                                                                    )}

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
                <DialogContent className="w-full max-w-[95vw] md:max-w-[90vw] lg:max-w-5xl h-[90vh] p-0 overflow-hidden border border-brand/30 bg-zinc-800/95 backdrop-blur-3xl shadow-[0_0_100px_rgba(0,0,0,0.9)] ring-1 ring-white/10 rounded-2xl sm:rounded-2xl">
                    <DialogHeader className="sr-only">
                        <DialogTitle>{drawerLead?.name}</DialogTitle>
                        <DialogDescription>Lead enrichment and audit data</DialogDescription>
                    </DialogHeader>
                    {drawerLead ? (() => {
                        const audit = auditedLeads[drawerLead.id] || drawerLead.auditData;
                        const enrichment: EnrichmentData | undefined = audit?.rawScrape?.enrichment;

                        return (
                            <div className="flex flex-col h-full bg-transparent text-zinc-100 w-full overflow-hidden focus-visible:outline-none relative">
                                <Tabs defaultValue="intel" className="flex flex-col h-full">
                                    {/* Header */}
                                    <div className="px-4 sm:px-6 pt-6 pb-4 border-b border-zinc-700/80 shrink-0 bg-transparent relative overflow-hidden">
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
                                                <span className="text-[11px] sm:text-[12px] font-black uppercase tracking-[0.3em] text-brand/80">Business Intelligence</span>
                                            </div>
                                            <h2 className="text-2xl sm:text-3xl font-heading uppercase leading-tight pr-10">{drawerLead.name}</h2>
                                            <div className="flex items-center text-zinc-400 text-[10.5px] sm:text-[11.5px] font-bold uppercase tracking-wider gap-x-2 sm:gap-x-4 mt-2 sm:mt-3 whitespace-nowrap">
                                                <span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-brand" /> {drawerLead.city}</span>
                                                {drawerLead.niche && <span className="flex items-center gap-2"><Building2 className="h-4 w-4 text-brand" />{drawerLead.niche}</span>}
                                                {drawerLead.website && (
                                                    <a href={drawerLead.website.startsWith('http') ? drawerLead.website : `https://${drawerLead.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-zinc-300 hover:text-brand transition-colors cursor-pointer group">
                                                        <Globe className="h-4 w-4 text-brand group-hover:scale-110 transition-transform" />
                                                        <span className="border-b border-transparent group-hover:border-brand/50 lowercase tracking-normal">{drawerLead.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</span>
                                                    </a>
                                                )}
                                                <div className="flex items-center gap-3 sm:gap-4 sm:border-l border-zinc-800 sm:pl-4 sm:ml-1 shrink-0">
                                                    <div className="flex items-baseline gap-2 py-1 group/rating">
                                                        <Star className="h-4 w-4 text-brand fill-brand shrink-0" />
                                                        <span className="text-xl sm:text-2xl font-black text-brand italic tracking-tighter leading-none">{drawerLead.rating}</span>
                                                        <span className="text-[11px] sm:text-[12px] text-zinc-500 font-bold uppercase tracking-widest leading-none">({drawerLead.ratingCount} reviews)</span>
                                                    </div>

                                                    <div className="flex items-center gap-3 py-1 sm:ml-2 border-l border-zinc-800/50 pl-4 sm:pl-8 group/score">
                                                        <Activity className="h-5 w-5 text-emerald-400 shrink-0" />
                                                        <div className="flex items-baseline gap-2">
                                                            <span className="text-[10px] sm:text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] leading-none">SCORE:</span>
                                                            <span className="text-xl sm:text-2xl font-black text-white italic tracking-tighter leading-none">
                                                                {audit?.rawScrape?.scoreBreakdown ? audit.rawScrape.scoreBreakdown.total : audit?.score}/{audit?.rawScrape?.scoreBreakdown?.maxTotal || audit?.max_score || (audit?.rawScrape?.seoAudit?.pagespeed_mobile !== null ? 100 : 85)}
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
                                            <TabsTrigger value="intel" className="px-8 py-2 text-zinc-500 hover:text-zinc-300 data-active:bg-zinc-100 data-active:text-zinc-950 transition-all">
                                                <div className="flex items-center gap-3">
                                                    <Globe className="h-4 w-4" />
                                                    <span className="text-[12px] font-black uppercase tracking-[0.15em]">Business Intel</span>
                                                </div>
                                            </TabsTrigger>
                                            <TabsTrigger value="audit" className="px-8 py-2 text-zinc-500 hover:text-zinc-300 data-active:bg-zinc-100 data-active:text-zinc-950 transition-all">
                                                <div className="flex items-center gap-3">
                                                    <Activity className="h-4 w-4" />
                                                    <span className="text-[12px] font-black uppercase tracking-[0.15em]">Audit Breakdown</span>
                                                </div>
                                            </TabsTrigger>
                                            <TabsTrigger value="outreach" className="px-8 py-2 text-zinc-500 hover:text-zinc-300 data-active:bg-zinc-100 data-active:text-zinc-950 transition-all">
                                                <div className="flex items-center gap-3">
                                                    <Send className="h-4 w-4" />
                                                    <span className="text-[12px] font-black uppercase tracking-[0.15em]">AI Outreach</span>
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
                                                    <div className="bg-zinc-800/60 backdrop-blur-md rounded-2xl border border-zinc-700/80 shadow-xl p-5 hover:shadow-brand/5 transition-all relative overflow-hidden group">
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
                                                                <a href={drawerLead.website.startsWith('http') ? drawerLead.website : `https://${drawerLead.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-2.5 sm:p-3 rounded-xl bg-zinc-900/40 border border-zinc-700/50 hover:bg-zinc-800/80 hover:shadow-xl hover:border-brand/40 transition-all group/link">
                                                                    <div className="bg-zinc-900 p-2 rounded-lg shadow-sm border border-zinc-800 group-hover/link:bg-zinc-800 transition-colors"><Globe className="h-4 w-4 text-brand group-hover/link:scale-110 transition-transform" /></div>
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none mb-1">Website</p>
                                                                        <p className="text-[13px] sm:text-sm font-semibold text-zinc-100 truncate">{drawerLead.website}</p>
                                                                    </div>
                                                                </a>
                                                            ) : (
                                                                <div className="flex items-center gap-3 p-2.5 sm:p-3 rounded-xl bg-zinc-900/40 border border-zinc-700/30 opacity-60"><Globe className="h-4 w-4 text-zinc-600" /><span className="text-[13px] sm:text-sm font-medium text-zinc-500">No Website</span></div>
                                                            )}

                                                            {enrichment.contacts.emails.length > 0 ? (
                                                                <div className="flex items-center gap-3 p-2.5 sm:p-3 rounded-xl bg-zinc-900/40 border border-zinc-700/50 group/link hover:bg-zinc-800/80 hover:shadow-xl hover:border-brand/40 transition-all">
                                                                    <div className="bg-zinc-900 p-2 rounded-lg shadow-sm border border-zinc-800 group-hover/link:bg-zinc-800 transition-colors"><Mail className="h-4 w-4 text-brand group-hover/link:scale-110 transition-transform" /></div>
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none mb-1">Email Match</p>
                                                                        <p className="text-[13px] sm:text-sm font-semibold text-zinc-100 truncate" title={enrichment.contacts.emails[0].email}>{enrichment.contacts.emails[0].email}</p>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-3 p-2.5 sm:p-3 rounded-xl bg-zinc-900/40 border border-zinc-700/30 opacity-60"><Mail className="h-4 w-4 text-zinc-600" /><span className="text-[13px] sm:text-sm font-medium text-zinc-500">No Email</span></div>
                                                            )}

                                                            <div className="flex items-center gap-3 p-2.5 sm:p-3 rounded-xl bg-zinc-900/40 border border-zinc-700/50 group/link hover:bg-zinc-800/80 hover:shadow-xl hover:border-brand/40 transition-all">
                                                                <div className="bg-zinc-900 p-2 text-brand rounded-lg shadow-sm border border-zinc-800 group-hover/link:bg-zinc-800 transition-colors flex justify-center items-center"><Phone className="h-4 w-4 group-hover/link:scale-110 transition-transform" /></div>
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none mb-1">Phone Match</p>
                                                                    <p className="text-[13px] sm:text-sm font-semibold text-zinc-100 truncate">{drawerLead.phone || (enrichment.contacts.hasPhone ? 'Linked on site' : 'Not found')}</p>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-2.5 p-2.5 sm:p-3 rounded-xl bg-zinc-900/40 border border-zinc-700/50">
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
                                                    <div className="bg-zinc-800/60 backdrop-blur-md rounded-2xl border border-zinc-700/80 shadow-xl p-5 hover:shadow-brand/5 transition-all relative overflow-hidden group">
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
                                                                    className="min-h-[100px] text-sm bg-zinc-900/40 border-zinc-700/50 text-zinc-100 focus:border-brand/50 focus:ring-brand/20 rounded-xl resize-none shadow-inner"
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
                                                                        className="h-11 text-sm bg-zinc-900/40 border-zinc-700/50 text-zinc-100 rounded-xl focus:border-brand/50 focus:ring-brand/20"
                                                                        value={igFollowers}
                                                                        onChange={(e) => setIgFollowers(e.target.value)}
                                                                    />
                                                                </div>
                                                                <div className="space-y-1.5">
                                                                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5"><Users className="h-3 w-3 text-brand" /> Activity</label>
                                                                    <Select value={igActivity} onValueChange={(val) => setIgActivity(val || '')}>
                                                                        <SelectTrigger className="h-11 text-sm bg-zinc-900/40 border-zinc-700/50 text-zinc-100 rounded-xl focus:border-brand/50 focus:ring-brand/20">
                                                                            <SelectValue placeholder="Select..." />
                                                                        </SelectTrigger>
                                                                        <SelectContent className="bg-zinc-800 border-zinc-700/50 text-zinc-100">
                                                                            <SelectItem value="very_active">🟢 Very Active</SelectItem>
                                                                            <SelectItem value="mid_active">🟡 Mid Active</SelectItem>
                                                                            <SelectItem value="low_active">🟠 Low Active</SelectItem>
                                                                            <SelectItem value="not_active">🔴 Not Active</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                            </div>

                                                            {/* Manual Instagram & Win Prob */}
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                                <div>
                                                                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><Instagram className="h-3 w-3 text-brand" /> Instagram Handle/URL</label>
                                                                    <Input
                                                                        placeholder="e.g. @fadeaway_performance or full URL"
                                                                        className="h-11 text-sm bg-zinc-900/40 border-zinc-700/50 text-zinc-100 rounded-xl focus:border-brand/50 focus:ring-brand/20 shadow-inner"
                                                                        value={manualIg}
                                                                        onChange={(e) => setManualIg(e.target.value)}
                                                                    />
                                                                </div>
                                                                <div className="space-y-1.5">
                                                                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5"><Activity className="h-3 w-3 text-brand" /> Win Probability</label>
                                                                    <Select value={winProbability} onValueChange={(val) => setWinProbability(val || '')}>
                                                                        <SelectTrigger className="h-11 text-sm bg-zinc-900/40 border-zinc-700/50 text-zinc-100 rounded-xl focus:border-brand/50 focus:ring-brand/20">
                                                                            <SelectValue placeholder="Select..." />
                                                                        </SelectTrigger>
                                                                        <SelectContent className="bg-zinc-800 border-zinc-700/50 text-zinc-100">
                                                                            <SelectItem value="high">🟢 High (75%+)</SelectItem>
                                                                            <SelectItem value="medium">🟡 Medium (25-75%)</SelectItem>
                                                                            <SelectItem value="low">🟠 Low (&lt;25%)</SelectItem>
                                                                            <SelectItem value="dead">🔴 Dead (0%)</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                            </div>

                                                            {/* Manual Contact */}
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div className="space-y-1.5">
                                                                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5"><Mail className="h-3 w-3 text-brand" /> Add Email</label>
                                                                    <Input
                                                                        type="email"
                                                                        placeholder="name@company.com"
                                                                        className="h-11 text-sm bg-zinc-900/40 border-zinc-700/50 text-zinc-100 rounded-xl focus:border-brand/50 focus:ring-brand/20"
                                                                        value={manualEmail}
                                                                        onChange={(e) => setManualEmail(e.target.value)}
                                                                    />
                                                                </div>
                                                                <div className="space-y-1.5">
                                                                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5"><Phone className="h-3 w-3 text-brand" /> Add Phone</label>
                                                                    <Input
                                                                        type="tel"
                                                                        placeholder="+1 (555) 000-0000"
                                                                        className="h-11 text-sm bg-zinc-900/40 border-zinc-700/50 text-zinc-100 rounded-xl focus:border-brand/50 focus:ring-brand/20"
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
                                                                            win_probability: winProbability || null,
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
                                                                                win_probability: winProbability,
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
                                                                                win_probability: winProbability,
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
                                                        const sb: ScoreBreakdown = audit.rawScrape?.scoreBreakdown;
                                                            const categories = [
                                                                {
                                                                    label: 'UX Decay & Tech',
                                                                    score: sb.uxDecayTechnical,
                                                                    max: sb.uxMax || 30,
                                                                    from: 'from-rose-500',
                                                                    to: 'to-orange-500',
                                                                    icon: <Activity className="h-4 w-4" />,
                                                                    rules: (sb.uxRules || []) as ScoringRule[],
                                                                    type: 'decay'
                                                                },
                                                                {
                                                                    label: 'Maturity & Cash',
                                                                    score: sb.cashFlowMaturity,
                                                                    max: 30,
                                                                    from: 'from-blue-500',
                                                                    to: 'to-cyan-500',
                                                                    icon: <TrendingUp className="h-4 w-4" />,
                                                                    rules: (sb.maturityRules || []) as ScoringRule[],
                                                                    type: 'growth'
                                                                },
                                                                {
                                                                    label: 'Contact Access',
                                                                    score: sb.contactability,
                                                                    max: 25,
                                                                    from: 'from-emerald-500',
                                                                    to: 'to-teal-500',
                                                                    icon: <Phone className="h-4 w-4" />,
                                                                    rules: (sb.contactRules || []) as ScoringRule[],
                                                                    type: 'access'
                                                                },
                                                            ];
                                                        return (
                                                            <div className="space-y-4">
                                                                <div className="bg-zinc-900/60 backdrop-blur-md rounded-2xl border border-zinc-800 shadow-xl overflow-hidden relative group">
                                                                    <div className="p-5 flex flex-col gap-4 relative z-10">
                                                                        <div className="flex items-center justify-between">
                                                                            <h3 className="font-black text-white flex items-center gap-3 uppercase tracking-tight text-lg">
                                                                                <Activity className="h-5 w-5 text-brand" /> 
                                                                                Audit Breakdown 
                                                                            </h3>
                                                                            <div className="flex items-center gap-2">
                                                                                <Button 
                                                                                    variant="ghost" 
                                                                                    size="icon" 
                                                                                    className="h-6 w-6 rounded-md hover:bg-brand/10 hover:text-brand text-zinc-500 transition-colors"
                                                                                    onClick={() => handleRunAudit(drawerLead, true)}
                                                                                    disabled={isAuditing[drawerLead.id]}
                                                                                >
                                                                                    <RefreshCw className={cn("h-3 w-3", isAuditing[drawerLead.id] && "animate-spin")} />
                                                                                </Button>
                                                                                <span className="bg-zinc-950 text-brand text-sm px-4 py-1.5 rounded-lg font-black border border-brand/20 shadow-[0_0_15px_rgba(255,102,0,0.1)]">
                                                                                    {sb.total}/{sb.maxTotal || 85}
                                                                                </span>
                                                                            </div>
                                                                        </div>

                                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                                                            {categories.map((cat, i) => (
                                                                                <div key={i} className="flex flex-col gap-6 p-6 bg-zinc-950/40 rounded-2xl border border-zinc-800/50 hover:border-zinc-700/50 transition-all group/card">
                                                                                    <div className="flex items-center justify-between">
                                                                                        <div className="flex items-center gap-3">
                                                                                            <div className={cn("p-2 rounded-lg bg-zinc-900 border border-zinc-800", (cat as any).from.replace('from-', 'text-'))}>
                                                                                                <div className="h-4 w-4">
                                                                                                    {cat.icon}
                                                                                                </div>
                                                                                            </div>
                                                                                            <span className="text-[13px] font-black text-zinc-400 uppercase tracking-widest leading-none">{cat.label}</span>
                                                                                        </div>
                                                                                        <span className="font-black text-white text-xl tracking-tighter italic">{cat.score || 0}<span className="text-zinc-600 text-[13px] font-bold not-italic ml-0.5">/{cat.max}</span></span>
                                                                                    </div>

                                                                                    <div className="h-1.5 bg-zinc-900 rounded-full w-full overflow-hidden">
                                                                                        <div
                                                                                            className={`h-full bg-gradient-to-r ${cat.from} ${cat.to} rounded-full transition-all duration-1000`}
                                                                                            style={{ width: `${Math.min((cat.score || 0) / cat.max, 1) * 100}%` }}
                                                                                        />
                                                                                    </div>

                                                                                    <div className="space-y-2">
                                                                                        {cat.rules.map((rule, idx) => {
                                                                                            // Category 1: isTriggered = BAD (Fail)
                                                                                            // Categories 2/3: isTriggered = GOOD (Pass)
                                                                                            const isSuccess = cat.type === 'decay' ? !rule.isTriggered : rule.isTriggered;
                                                                                            
                                                                                            return (
                                                                                                <div key={idx} className={cn(
                                                                                                    "flex items-start gap-3 text-xs p-3 rounded-xl border transition-colors group/rule",
                                                                                                    isSuccess 
                                                                                                        ? "text-emerald-100 bg-emerald-500/5 border-emerald-500/10 hover:border-emerald-500/30" 
                                                                                                        : "text-rose-100 bg-rose-500/5 border-rose-500/10 hover:border-rose-500/30"
                                                                                                )}>
                                                                                                    {isSuccess ? (
                                                                                                        <CheckSquare className="h-3.5 w-3.5 mt-0.5 text-emerald-500 shrink-0" />
                                                                                                    ) : (
                                                                                                        <AlertCircle className="h-3.5 w-3.5 mt-0.5 text-rose-500 shrink-0" />
                                                                                                    )}
                                                                                                    <div className="flex flex-col gap-0.5">
                                                                                                        <span className="leading-snug font-bold">{rule.label}</span>
                                                                                                        {rule.points > 0 && (
                                                                                                            <span className={cn(
                                                                                                                "text-[9px] font-black uppercase tracking-widest",
                                                                                                                isSuccess ? "text-emerald-500/80" : "text-rose-500/80"
                                                                                                            )}>
                                                                                                                +{rule.points} {cat.type === 'decay' ? 'pts penalty' : 'pts reward'}
                                                                                                            </span>
                                                                                                        )}
                                                                                                    </div>
                                                                                                </div>
                                                                                            );
                                                                                        })}
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* PageSpeed Quick Look (Dual Focus) */}
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                                    {/* Mobile Score */}
                                                                    <div className="bg-zinc-900/60 backdrop-blur-md rounded-2xl border border-zinc-800 p-4 flex items-center justify-between group/speed hover:border-zinc-700 transition-colors">
                                                                        <div className="flex items-center gap-4">
                                                                            <Smartphone className="h-5 w-5 text-brand" />
                                                                            <span className="text-[12px] font-black uppercase tracking-widest text-zinc-500">Mobile Speed</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            {isAuditing[drawerLead.id] && (
                                                                                <Loader2 className="h-3 w-3 text-brand animate-spin" />
                                                                            )}
                                                                            <div className={cn(
                                                                                "text-lg font-black italic",
                                                                                audit?.rawScrape?.seoAudit?.pagespeed_mobile >= 90 ? "text-emerald-500" : 
                                                                                audit?.rawScrape?.seoAudit?.pagespeed_mobile >= 50 ? "text-amber-500" : 
                                                                                audit?.rawScrape?.seoAudit?.pagespeed_mobile !== undefined ? "text-rose-500" : "text-zinc-700"
                                                                            )}>
                                                                                {audit?.rawScrape?.seoAudit?.pagespeed_mobile !== undefined ? `${audit.rawScrape.seoAudit.pagespeed_mobile}%` : "---"}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    {/* Desktop Score */}
                                                                    <div className="bg-zinc-900/60 backdrop-blur-md rounded-2xl border border-zinc-800 p-4 flex items-center justify-between group/speed hover:border-zinc-700 transition-colors">
                                                                        <div className="flex items-center gap-3">
                                                                            <Monitor className="h-4 w-4 text-brand" />
                                                                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Desktop Speed</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            {isAuditing[drawerLead.id] && (
                                                                                <Loader2 className="h-3 w-3 text-brand animate-spin" />
                                                                            )}
                                                                            <div className={cn(
                                                                                "text-lg font-black italic",
                                                                                audit?.rawScrape?.seoAudit?.pagespeed_desktop >= 90 ? "text-emerald-500" : 
                                                                                audit?.rawScrape?.seoAudit?.pagespeed_desktop >= 50 ? "text-amber-500" : 
                                                                                audit?.rawScrape?.seoAudit?.pagespeed_desktop !== undefined ? "text-rose-500" : "text-zinc-700"
                                                                            )}>
                                                                                {audit?.rawScrape?.seoAudit?.pagespeed_desktop !== undefined ? `${audit.rawScrape.seoAudit.pagespeed_desktop}%` : "---"}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
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

                                                    {/* Debug Accordion */}
                                                    {aiSuggestions?._debug && (
                                                        <details className="rounded-xl border border-zinc-800 bg-zinc-900/30 overflow-hidden group">
                                                            <summary className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 cursor-pointer hover:text-zinc-300 flex items-center gap-2 transition-colors list-none">
                                                                <span className="text-zinc-600 group-open:text-brand transition-colors">▶</span>
                                                                🔬 AI Debug — Prompt Sent to Gemini
                                                            </summary>
                                                            <div className="border-t border-zinc-800 p-4">
                                                                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">📝 Full Prompt Sent to Gemini</p>
                                                                <pre className="text-[11px] text-zinc-300 whitespace-pre-wrap leading-relaxed font-mono bg-zinc-950 rounded-lg p-3 overflow-x-auto max-h-[400px] overflow-y-auto">{aiSuggestions._debug.prompt}</pre>
                                                            </div>
                                                        </details>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex flex-col p-4 gap-4">
                                                    {/* Data Preview Panel */}
                                                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
                                                        <div className="px-4 py-2.5 border-b border-zinc-800 bg-zinc-900">
                                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">📊 Data Being Sent to AI</span>
                                                        </div>
                                                        {/* Business Identity Row */}
                                                        <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-950/40 flex flex-col gap-0.5">
                                                            <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Business</p>
                                                            <p className="text-[13px] font-black text-zinc-100">{drawerLead.name}</p>
                                                            <p className="text-[10px] text-zinc-500 font-bold">{drawerLead.niche || 'Local Business'} &bull; <span className="text-brand/80">{drawerLead.website || 'No website'}</span></p>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-0 divide-x divide-zinc-800">
                                                            {/* Left column */}
                                                            <div className="flex flex-col gap-0 divide-y divide-zinc-800/60">
                                                                <div className="px-3 py-2">
                                                                    <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Overall Score</p>
                                                                    <p className="text-[13px] font-black text-zinc-100">{audit?.score ?? '—'}<span className="text-zinc-500 text-[10px]">/{audit?.max_score || 85}</span></p>
                                                                </div>
                                                                <div className="px-3 py-2">
                                                                    <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">UX Decay & Tech</p>
                                                                    <p className="text-[13px] font-black text-zinc-100">{audit?.rawScrape?.scoreBreakdown?.uxDecayTechnical ?? '—'}<span className="text-zinc-500 text-[10px]">/{audit?.rawScrape?.scoreBreakdown?.uxMax || 30}</span></p>
                                                                </div>
                                                                <div className="px-3 py-2">
                                                                    <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Maturity & Cash</p>
                                                                    <p className="text-[13px] font-black text-zinc-100">{audit?.rawScrape?.scoreBreakdown?.cashFlowMaturity ?? '—'}<span className="text-zinc-500 text-[10px]">/{audit?.rawScrape?.scoreBreakdown?.maturityMax || 30}</span></p>
                                                                </div>
                                                                <div className="px-3 py-2">
                                                                    <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Contact Access</p>
                                                                    <p className="text-[13px] font-black text-zinc-100">{audit?.rawScrape?.scoreBreakdown?.contactability ?? '—'}<span className="text-zinc-500 text-[10px]">/{audit?.rawScrape?.scoreBreakdown?.contactMax || 25}</span></p>
                                                                </div>
                                                                <div className="px-3 py-2">
                                                                    <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">PageSpeed Mobile</p>
                                                                    <p className={`text-[13px] font-black ${(audit?.rawScrape?.seoAudit?.pagespeed_mobile ?? 100) < 50 ? 'text-red-400' : (audit?.rawScrape?.seoAudit?.pagespeed_mobile ?? 100) < 80 ? 'text-orange-400' : 'text-green-400'}`}>{audit?.rawScrape?.seoAudit?.pagespeed_mobile ?? 'N/A'}<span className="text-zinc-500 text-[10px]">/100</span></p>
                                                                </div>
                                                                <div className="px-3 py-2">
                                                                    <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">PageSpeed Desktop</p>
                                                                    <p className={`text-[13px] font-black ${(audit?.rawScrape?.seoAudit?.pagespeed_desktop ?? 100) < 50 ? 'text-red-400' : (audit?.rawScrape?.seoAudit?.pagespeed_desktop ?? 100) < 80 ? 'text-orange-400' : 'text-green-400'}`}>{audit?.rawScrape?.seoAudit?.pagespeed_desktop ?? 'N/A'}<span className="text-zinc-500 text-[10px]">/100</span></p>
                                                                </div>
                                                            </div>
                                                            {/* Right column */}
                                                            <div className="flex flex-col gap-0 divide-y divide-zinc-800/60">
                                                                <div className="px-3 py-2">
                                                                    <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Google Rating</p>
                                                                    <p className="text-[13px] font-black text-zinc-100">⭐ {drawerLead.rating ?? '—'}<span className="text-zinc-500 text-[10px]"> ({drawerLead.ratingCount ?? 0} reviews)</span></p>
                                                                </div>
                                                                <div className="px-3 py-2">
                                                                    <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Win Probability</p>
                                                                    <p className="text-[13px] font-black text-zinc-100">{drawerLead.win_probability ?? <span className="text-zinc-600">Not set</span>}</p>
                                                                </div>
                                                                <div className="px-3 py-2">
                                                                    <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">IG Followers</p>
                                                                    <p className="text-[13px] font-black text-zinc-100">{drawerLead.ig_followers ?? <span className="text-zinc-600">Not tracked</span>}</p>
                                                                </div>
                                                                <div className="px-3 py-2">
                                                                    <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">IG Activity</p>
                                                                    <p className="text-[13px] font-black text-zinc-100">{drawerLead.ig_activity ?? <span className="text-zinc-600">Not tracked</span>}</p>
                                                                </div>
                                                                <div className="px-3 py-2">
                                                                    <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Load Time</p>
                                                                    <p className="text-[13px] font-black text-zinc-100">{audit?.rawScrape?.seoAudit?.mobile_load_time ?? 'N/A'}</p>
                                                                </div>
                                                                <div className="px-3 py-2">
                                                                    <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Manual Notes</p>
                                                                    <p className="text-[12px] font-bold text-zinc-300 truncate">{drawerLead.manual_notes || <span className="text-zinc-600">None</span>}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {/* Biggest Weakness */}
                                                        {audit?.biggestWeakness && (
                                                            <div className="px-4 py-2.5 border-t border-zinc-800 bg-zinc-950/50">
                                                                <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold mb-1">🎯 Top Priority Issue <span className="text-zinc-600 normal-case">(auto-selected by scoring engine)</span></p>
                                                                <p className="text-[11px] font-bold text-orange-400">{audit.biggestWeakness}</p>
                                                            </div>
                                                        )}
                                                        {/* Rules count chips */}
                                                        <div className="px-4 py-2.5 border-t border-zinc-800 flex gap-2 flex-wrap">
                                                            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-zinc-800 text-zinc-400">{audit?.rawScrape?.scoreBreakdown?.uxRules?.filter((r: any) => r.isTriggered).length ?? 0} UX Issues</span>
                                                            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-zinc-800 text-zinc-400">{audit?.rawScrape?.scoreBreakdown?.maturityRules?.filter((r: any) => r.isTriggered).length ?? 0} Maturity Signals</span>
                                                            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-zinc-800 text-zinc-400">{audit?.rawScrape?.scoreBreakdown?.contactRules?.filter((r: any) => r.isTriggered).length ?? 0} Contact Signals</span>
                                                        </div>
                                                    </div>
                                                    <div className="text-center space-y-2">
                                                        <h3 className="text-sm font-black text-zinc-300 uppercase tracking-[0.3em]">AI Outreach Pitch</h3>
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 leading-relaxed mx-auto">
                                                            Generate a tailored email sequence for {drawerLead.name} based on the data above.
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
                                                                    maxScore: audit?.max_score || 85,
                                                                    seoScore: audit?.rawScrape?.scoreBreakdown?.uxDecayTechnical,
                                                                    uxMax: audit?.rawScrape?.scoreBreakdown?.uxMax || 30,
                                                                    localIntentScore: audit?.rawScrape?.scoreBreakdown?.cashFlowMaturity,
                                                                    maturityMax: audit?.rawScrape?.scoreBreakdown?.maturityMax || 30,
                                                                    contactabilityScore: audit?.rawScrape?.scoreBreakdown?.contactability,
                                                                    contactMax: audit?.rawScrape?.scoreBreakdown?.contactMax || 25,
                                                                    biggestWeakness: audit?.biggestWeakness,
                                                                    manualNotes: manualNotes || drawerLead.manual_notes,
                                                                    rating: drawerLead.rating,
                                                                    ratingCount: drawerLead.ratingCount,
                                                                    winProbability: drawerLead.win_probability,
                                                                    igFollowers: drawerLead.ig_followers,
                                                                    igActivity: drawerLead.ig_activity,
                                                                    pagespeedMobile: audit?.rawScrape?.seoAudit?.pagespeed_mobile,
                                                                    pagespeedDesktop: audit?.rawScrape?.seoAudit?.pagespeed_desktop,
                                                                    mobileLoadTime: audit?.rawScrape?.seoAudit?.mobile_load_time,
                                                                    rawAudit: audit?.rawScrape,
                                                                    scoringRules: {
                                                                        uxRules: audit?.rawScrape?.scoreBreakdown?.uxRules || [],
                                                                        maturityRules: audit?.rawScrape?.scoreBreakdown?.maturityRules || [],
                                                                        contactRules: audit?.rawScrape?.scoreBreakdown?.contactRules || [],
                                                                        rulesTriggered: audit?.rawScrape?.scoreBreakdown?.rulesTriggered || [],
                                                                    }
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
                    })() : null}
                </DialogContent>
            </Dialog>
        </div>
    );
}
