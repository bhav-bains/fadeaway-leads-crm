import { create } from 'zustand'

export interface Lead {
    id: string;
    name: string;
    address: string;
    phone?: string;
    website?: string;
    status: 'Sourced' | 'Auditing' | 'Active Outreach' | 'Meeting Booked' | 'Needs Analysis' | 'Closed Won' | 'Closed Lost';
    createdAt: string;
    workspaceId: string;
}

interface LeadStore {
    leads: Lead[];
    addLead: (lead: Lead) => void;
    updateLeadStatus: (id: string, status: Lead['status']) => void;
    setLeads: (leads: Lead[]) => void;
}

export const useLeadStore = create<LeadStore>((set) => ({
    leads: [],
    addLead: (lead) => set((state) => ({ leads: [...state.leads, lead] })),
    updateLeadStatus: (id, status) => set((state) => ({
        leads: state.leads.map(lead => lead.id === id ? { ...lead, status } : lead)
    })),
    setLeads: (leads) => set({ leads }),
}))
