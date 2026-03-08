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
import { Search, MapPin, Building2, Download, Send, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useLeadStore, Lead } from "@/store/leadStore";
import { insertLead, runLocalSeoAudit } from "@/app/actions/leads";
import { searchGooglePlaces } from "@/app/actions/search";

export default function LeadFinder() {
    const [niche, setNiche] = useState("");
    const [city, setCity] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [results, setResults] = useState<any[]>([]);

    // Filters
    const [minScore, setMinScore] = useState([0]); // Default to 0 so unaudited leads show up
    const [requireEmail, setRequireEmail] = useState(false);
    const [ratingFilter, setRatingFilter] = useState("all");

    // Selection & Auditing
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [auditedLeads, setAuditedLeads] = useState<Record<string, any>>({});
    const [isAuditing, setIsAuditing] = useState<Record<string, boolean>>({});

    const { leads, addLead } = useLeadStore();

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!niche || !city) {
            toast.error("Please enter both a niche and a city.");
            return;
        }

        setIsSearching(true);
        toast.info("Scraping in progress... this may take a few seconds.");

        const { data, error } = await searchGooglePlaces(niche, city);

        if (error) {
            toast.error(error);
            setResults([]);
        } else if (data) {
            // Reset state for new search
            setResults(data);
            setSelectedIds(new Set());
            setAuditedLeads({});
            setIsAuditing({});
            setMinScore([0]); // Reset score filter to see new results
            setRequireEmail(false);
            toast.success(`Found ${data.length} businesses. Select leads to run SEO Audit.`);
        }
        setIsSearching(false);
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(new Set(filteredResults.map(r => r.id)));
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

    const handleRunAudit = async (lead: any) => {
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

    const filteredResults = useMemo(() => {
        return results.filter(r => {
            const auditData = auditedLeads[r.id];

            if (minScore[0] > 0) {
                if (!auditData || auditData.score < minScore[0]) return false;
            }
            if (requireEmail) {
                if (!auditData || !auditData.email || auditData.email.trim() === '') return false;
            }

            if (ratingFilter === "high" && r.rating < 4.0) return false;
            if (ratingFilter === "low" && r.rating >= 4.0) return false;
            return true;
        });
    }, [results, minScore, requireEmail, ratingFilter, auditedLeads]);

    return (
        <div className="flex flex-col gap-6 pb-12">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Lead Finder (SEO Auditor)</h1>
                <p className="text-muted-foreground mt-2">
                    Hunt down highly successful local businesses that have massive digital and SEO gaps.
                </p>
            </div>

            <Card className="border-primary/10 bg-primary/5">
                <CardHeader className="pb-4">
                    <CardTitle>Engine Parameters</CardTitle>
                    <CardDescription>Enter your target ICP and let the Cheerio scraper audit them behind the scenes.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="grid gap-2 flex-1">
                            <Label htmlFor="niche" className="font-semibold text-foreground/80">Business Niche</Label>
                            <div className="relative">
                                <Building2 className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="niche"
                                    placeholder="e.g. Plumber, Roofing, Dentist"
                                    className="pl-9 bg-background"
                                    value={niche}
                                    onChange={(e) => setNiche(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="grid gap-2 flex-1">
                            <Label htmlFor="city" className="font-semibold text-foreground/80">Target City</Label>
                            <div className="relative">
                                <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="city"
                                    placeholder="e.g. Seattle, Toronto, Austin"
                                    className="pl-9 bg-background"
                                    value={city}
                                    onChange={(e) => setCity(e.target.value)}
                                />
                            </div>
                        </div>
                        <Button type="submit" disabled={isSearching} className="w-full md:w-auto font-medium px-8">
                            {isSearching ? (
                                <>
                                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                    Scraping...
                                </>
                            ) : (
                                <>
                                    <Search className="h-4 w-4 mr-2" />
                                    Run Audit Scan
                                </>
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {results.length > 0 && (
                <div className="space-y-4 animate-in fade-in duration-500">

                    {/* Filters Bar */}
                    <Card>
                        <CardContent className="p-4 flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-6 bg-slate-50 border-b">
                            <div className="flex flex-col gap-2 w-full sm:w-auto sm:min-w-[200px]">
                                <div className="flex justify-between">
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
                    <div className="rounded-md border bg-card">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="w-[50px]">
                                        <Checkbox
                                            checked={selectedIds.size === filteredResults.length && filteredResults.length > 0}
                                            onCheckedChange={handleSelectAll}
                                        />
                                    </TableHead>
                                    <TableHead className="w-[280px]">Business & City</TableHead>
                                    <TableHead>Rating</TableHead>
                                    <TableHead>Scraped Email</TableHead>
                                    <TableHead className="text-center">Booking Link</TableHead>
                                    <TableHead className="text-right">Audit Score</TableHead>
                                    <TableHead className="w-[80px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredResults.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                            No leads match the current filters.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredResults.map((result) => {
                                        const auditData = auditedLeads[result.id];
                                        const isAuditingRow = isAuditing[result.id];

                                        return (
                                            <TableRow key={result.id} className={leads.some(l => l.name === result.name) ? "opacity-50" : ""}>
                                                <TableCell>
                                                    <Checkbox
                                                        checked={selectedIds.has(result.id)}
                                                        onCheckedChange={(c) => handleSelectRow(result.id, c as boolean)}
                                                    />
                                                </TableCell>
                                                <TableCell className="font-medium">
                                                    <div className="truncate" title={result.name}>{result.name}</div>
                                                    <div className="text-xs text-muted-foreground mt-0.5 truncate">{result.city} {auditData?.biggestWeakness ? `| ${auditData.biggestWeakness}` : ''}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1 text-sm font-medium">
                                                        ⭐ {result.rating} <span className="text-xs text-muted-foreground font-normal">({result.ratingCount})</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {!auditData ? (
                                                        <span className="text-xs text-muted-foreground">-</span>
                                                    ) : auditData.email ? (
                                                        <span className="text-sm font-medium">{auditData.email}</span>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">Not Found</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {!auditData ? (
                                                        <span className="text-xs text-muted-foreground">-</span>
                                                    ) : auditData.bookingDetected ? (
                                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Yes</Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Missing</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {!auditData ? (
                                                        <span className="text-xs text-muted-foreground">-</span>
                                                    ) : (
                                                        <Badge variant={auditData.score >= 12 ? 'default' : (auditData.score >= 7 ? 'secondary' : 'outline')} className="px-2 font-bold text-xs">
                                                            {auditData.score}/20
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1">
                                                        {!auditData && (
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-8 w-8 p-0"
                                                                onClick={() => handleRunAudit(result)}
                                                                disabled={isAuditingRow}
                                                                title="Run SEO Audit"
                                                            >
                                                                {isAuditingRow ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <Search className="h-4 w-4 text-blue-500" />}
                                                            </Button>
                                                        )}
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-8 w-8 p-0"
                                                            onClick={() => {
                                                                const newSet = new Set([result.id]);
                                                                setSelectedIds(newSet);
                                                                setTimeout(() => {
                                                                    document.getElementById('bulk-assign-btn')?.click();
                                                                }, 50);
                                                            }}
                                                            disabled={leads.some(l => l.name === result.name)}
                                                            title="Save to Pipeline"
                                                        >
                                                            <Send className="h-4 w-4 text-primary" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}
        </div>
    );
}
