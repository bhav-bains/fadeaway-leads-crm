"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Lead } from "@/store/leadStore";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, Globe, Building } from "lucide-react";

// Helper to determine if a lead is "stale" (> 7 days in current stage without update)
const isStale = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 7;
};

interface SortableLeadCardProps {
    lead: Lead;
    onClick?: () => void;
}

export function SortableLeadCard({ lead, onClick }: SortableLeadCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: lead.id, data: lead });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 999 : 1,
    };

    const stale = isStale(lead.createdAt);

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="touch-none cursor-grab group"
            onClick={(e) => {
                // Prevent click if we're just dragging
                if (!isDragging) {
                    onClick?.();
                }
            }}
        >
            <Card className={`mb-3 ${stale ? 'border-red-400 border-l-4' : 'hover:border-primary'} shadow-sm transition-colors group-hover:shadow-md`}>
                <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-start gap-2">
                        <div>
                            <h4 className="font-medium text-sm leading-tight text-foreground/90">{lead.name}</h4>
                            <p className="text-xs text-muted-foreground mt-0.5">Owner: Your Team</p>
                        </div>
                        <div className="flex flex-col gap-1 items-end">
                            {stale && <Badge variant="destructive" className="text-[10px] h-4 px-1">Stale</Badge>}
                            <Badge variant="outline" className={`text-[10px] h-4 px-1 ${lead.name.length % 2 === 0 ? 'text-orange-600 border-orange-200 bg-orange-50' : 'text-blue-600 border-blue-200 bg-blue-50'}`}>
                                {lead.name.length % 2 === 0 ? 'Hot' : 'Cold'}
                            </Badge>
                        </div>
                    </div>

                    <div className="space-y-1.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                            <Building className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{lead.address}</span>
                        </div>
                        {lead.phone && (
                            <div className="flex items-center gap-1.5">
                                <Phone className="h-3 w-3 flex-shrink-0" />
                                <span>{lead.phone}</span>
                            </div>
                        )}
                        {lead.website && (
                            <div className="flex items-center gap-1.5">
                                <Globe className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{lead.website}</span>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
