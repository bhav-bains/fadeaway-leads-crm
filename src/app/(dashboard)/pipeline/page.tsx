"use client";

import { useState, useEffect } from "react";
import {
    DndContext,
    DragOverlay,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragStartEvent,
    DragEndEvent,
} from "@dnd-kit/core";
import {
    sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";

import { useLeadStore, Lead } from "@/store/leadStore";
import { KanbanColumn } from "./kanban-column";
import { SortableLeadCard } from "./sortable-lead-card";
import { LeadDetailsDialog } from "./lead-details-dialog";
import { fetchLeads, updateLeadStatusAction } from "@/app/actions/leads";
import { toast } from "sonner";

export const STAGES = [
    "Sourced",
    "Auditing",
    "Active Outreach",
    "Meeting Booked",
    "Needs Analysis",
    "Closed Won",
    "Closed Lost",
];

export default function PipelineBoard() {
    const { leads, setLeads, updateLeadStatus } = useLeadStore();
    const [activeLead, setActiveLead] = useState<Lead | null>(null);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        const loadLeads = async () => {
            const { data, error } = await fetchLeads();
            if (error) {
                toast.error("Failed to load pipeline: " + error);
            } else if (data) {
                const mappedLeads: Lead[] = data.map((dbLead: any) => ({
                    id: dbLead.id,
                    name: dbLead.company_name,
                    address: `${dbLead.address}, ${dbLead.city}`,
                    phone: dbLead.phone,
                    website: dbLead.website,
                    status: dbLead.status as Lead['status'],
                    createdAt: dbLead.created_at,
                    workspaceId: dbLead.workspace_id,
                }));
                setLeads(mappedLeads);
            }
            setIsLoading(false);
        };
        loadLeads();
    }, [setLeads]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        setActiveLead(active.data.current as Lead);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (!over) {
            setActiveLead(null);
            return;
        }

        const activeLeadId = active.id as string;
        const overId = over.id as string;

        let newStatus = overId as Lead['status'];

        if (!STAGES.includes(overId as string)) {
            const overItem = leads.find(l => l.id === overId);
            if (overItem) {
                newStatus = overItem.status;
            }
        }

        if (STAGES.includes(newStatus)) {
            // Optimistic update in UI
            const oldStatus = leads.find(l => l.id === activeLeadId)?.status;
            updateLeadStatus(activeLeadId, newStatus);

            // Persist to Supabase
            const { error } = await updateLeadStatusAction(activeLeadId, newStatus);

            if (error) {
                toast.error("Failed to move lead: " + error);
                // Revert optimistic update
                if (oldStatus) updateLeadStatus(activeLeadId, oldStatus);
            } else if (newStatus === "Active Outreach") {
                // TRIGGER AUTOMATION
                const leadData = leads.find(l => l.id === activeLeadId);
                if (leadData) {
                    const mockEmail = "owner@example.com";
                    fetch("/api/automations/resend", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            leadId: leadData.id,
                            name: leadData.name,
                            email: mockEmail,
                            stage: "Active Outreach"
                        })
                    }).then(res => res.json())
                        .then(data => console.log("Automation Triggered:", data))
                        .catch(err => console.error("Automation Error:", err));
                }
            }
        }

        setActiveLead(null);
    };

    if (!isMounted) return null;

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)] gap-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Pipeline</h1>
                <p className="text-muted-foreground mt-2">
                    Manage and track leads through the outbound sales cycle.
                </p>
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
                    <div className="flex h-full gap-4 px-1 min-w-max">
                        {STAGES.map((stage) => (
                            <KanbanColumn
                                key={stage}
                                title={stage}
                                leads={leads.filter((l) => l.status === stage)}
                                onLeadClick={(lead) => setSelectedLead(lead)}
                            />
                        ))}
                    </div>
                </div>

                <DragOverlay>
                    {activeLead ? <SortableLeadCard lead={activeLead} /> : null}
                </DragOverlay>
            </DndContext>

            {selectedLead && (
                <LeadDetailsDialog
                    lead={selectedLead}
                    open={!!selectedLead}
                    onOpenChange={(open) => !open && setSelectedLead(null)}
                />
            )}
        </div>
    );
}
