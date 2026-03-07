"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin, Building2, PlusCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useLeadStore, Lead } from "@/store/leadStore";
import { insertLead } from "@/app/actions/leads";
import { searchGooglePlaces } from "@/app/actions/search";

export default function LeadFinder() {
    const [niche, setNiche] = useState("");
    const [city, setCity] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [results, setResults] = useState<any[]>([]);

    const { leads, addLead } = useLeadStore();

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!niche || !city) {
            toast.error("Please enter both a niche and a city.");
            return;
        }

        setIsSearching(true);
        const { data, error } = await searchGooglePlaces(niche, city);

        if (error) {
            toast.error(error);
            setResults([]);
        } else if (data) {
            setResults(data);
            toast.success(`Found ${data.length} businesses.`);
        }
        setIsSearching(false);
    };

    const handleAddToPipeline = async (business: any) => {
        // Check if already in pipeline by name (simple mock check)
        if (leads.some(l => l.name === business.name)) {
            toast.error(`${business.name} is already in your pipeline.`);
            return;
        }

        const toastId = toast.loading("Adding to pipeline...");

        const result = await insertLead({
            name: business.name,
            address: business.address,
            city: business.city,
            niche: business.niche,
            phone: business.phone,
            website: business.website,
        });

        if (result.error) {
            toast.error(`Failed to add: ${result.error}`, { id: toastId });
            return;
        }

        const dbLead = result.data;

        const newLead: Lead = {
            id: dbLead.id,
            name: dbLead.company_name,
            address: `${dbLead.address}, ${dbLead.city}`,
            phone: dbLead.phone,
            website: dbLead.website,
            status: dbLead.status as any,
            createdAt: dbLead.created_at,
            workspaceId: dbLead.workspace_id,
        };

        addLead(newLead);
        toast.success("Added to pipeline successfully!", { id: toastId });
    };

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Lead Finder</h1>
                <p className="text-muted-foreground mt-2">
                    Search for local businesses by niche and city to instantly generate prospects.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Search Parameters</CardTitle>
                    <CardDescription>Enter your target criteria to query the database.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="grid gap-2 flex-1">
                            <Label htmlFor="niche">Niche / Industry</Label>
                            <div className="relative">
                                <Building2 className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="niche"
                                    placeholder="e.g. HVAC, Plumber, Dentist"
                                    className="pl-9"
                                    value={niche}
                                    onChange={(e) => setNiche(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="grid gap-2 flex-1">
                            <Label htmlFor="city">City / Location</Label>
                            <div className="relative">
                                <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="city"
                                    placeholder="e.g. Seattle, Toronto, Austin"
                                    className="pl-9"
                                    value={city}
                                    onChange={(e) => setCity(e.target.value)}
                                />
                            </div>
                        </div>
                        <Button type="submit" disabled={isSearching} className="w-full md:w-auto">
                            {isSearching ? (
                                <>
                                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                    Searching...
                                </>
                            ) : (
                                <>
                                    <Search className="h-4 w-4 mr-2" />
                                    Find Leads
                                </>
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {results.length > 0 && (
                <Card className="overflow-hidden">
                    <CardHeader>
                        <CardTitle>Results ({results.length})</CardTitle>
                        <CardDescription>Review and add viable prospects to your pipeline.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 sm:p-6">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="min-w-[200px]">Business Name</TableHead>
                                        <TableHead className="min-w-[150px]">Location</TableHead>
                                        <TableHead className="min-w-[200px]">Website</TableHead>
                                        <TableHead className="min-w-[120px]">Phone</TableHead>
                                        <TableHead className="text-right min-w-[150px]">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {results.map((result) => {
                                        const isAdded = leads.some(l => l.name === result.name);
                                        return (
                                            <TableRow key={result.id}>
                                                <TableCell className="font-medium max-w-[250px]">
                                                    <div className="truncate" title={result.name}>{result.name}</div>
                                                    <Badge variant="outline" className="mt-1">{result.niche}</Badge>
                                                </TableCell>
                                                <TableCell className="max-w-[200px]">
                                                    <div className="truncate" title={`${result.address}, ${result.city}`}>
                                                        {result.address}, {result.city}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="max-w-[200px]">
                                                    {result.website ? (
                                                        <a href={`https://${result.website}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate block" title={result.website}>
                                                            {result.website}
                                                        </a>
                                                    ) : (
                                                        <span className="text-muted-foreground">N/A</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>{result.phone || "N/A"}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        variant={isAdded ? "secondary" : "default"}
                                                        size="sm"
                                                        onClick={() => handleAddToPipeline(result)}
                                                        disabled={isAdded}
                                                    >
                                                        {isAdded ? (
                                                            <>
                                                                <CheckCircle2 className="h-4 w-4 mr-1 sm:mr-2" />
                                                                <span className="hidden sm:inline">Added</span>
                                                                <span className="inline sm:hidden">Done</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <PlusCircle className="h-4 w-4 mr-1 sm:mr-2" />
                                                                <span className="hidden sm:inline">Add to Pipeline</span>
                                                                <span className="inline sm:hidden">Add</span>
                                                            </>
                                                        )}
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
