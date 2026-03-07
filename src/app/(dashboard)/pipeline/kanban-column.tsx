"use client";

import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { Lead } from "@/store/leadStore";
import { SortableLeadCard } from "./sortable-lead-card";

interface KanbanColumnProps {
    title: string;
    leads: Lead[];
    onLeadClick?: (lead: Lead) => void;
}

export function KanbanColumn({ title, leads, onLeadClick }: KanbanColumnProps) {
    const { setNodeRef } = useDroppable({
        id: title, // Provide the column title as the droppable ID
    });

    return (
        <div className="flex flex-col w-[300px] shrink-0 bg-muted/40 rounded-xl overflow-hidden border">
            <div className="p-3 bg-muted/80 border-b flex justify-between items-center bg-card">
                <h3 className="font-semibold text-sm tracking-tight">{title}</h3>
                <Badge variant="secondary" className="bg-background">{leads.length}</Badge>
            </div>

            {/* 
        This div is the droppable area for the column. 
        It needs min-h to ensure it can still receive drops when empty. 
      */}
            <div
                ref={setNodeRef}
                className="p-3 flex-1 overflow-y-auto"
            >
                <SortableContext
                    id={title}
                    items={leads.map(l => l.id)}
                    strategy={verticalListSortingStrategy}
                >
                    <div className="flex flex-col gap-3 min-h-[150px]">
                        {leads.map((lead) => (
                            <SortableLeadCard
                                key={lead.id}
                                lead={lead}
                                onClick={() => onLeadClick?.(lead)}
                            />
                        ))}
                    </div>
                </SortableContext>
            </div>
        </div>
    );
}
