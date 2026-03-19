import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { LayoutDashboard, Users, Search, Settings, LogOut, PanelLeftOpen, PanelLeftClose, Quote } from "lucide-react";
import { logout } from "@/app/auth/actions";
import { Users as UsersIcon, ShieldCheck, Send, MessageSquare, Calendar, DollarSign, ArrowUpRight, Globe, Star, MapPin, Building2, Mail, Phone, CheckCircle2, XCircle, FileJson, Quote as QuoteIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch all companies with enrichment and outreach history
  const { data: companies } = await supabase
    .from('companies')
    .select(`
        *,
        scores!left (*),
        outreach_messages!left (*)
    `)
    .order('created_at', { ascending: false });

  const now = new Date();
  const day = now.getDay();
  // Adjust to previous Monday
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const startOfMonday = new Date(now.setDate(diff));
  startOfMonday.setHours(0, 0, 0, 0);

  const safeCompanies = (companies || []).filter(c => new Date(c.created_at) >= startOfMonday);
  
  // High-Density Metrics Calculations (Weekly Filter)
  const leadsSourced = safeCompanies.filter(c => new Date(c.created_at) >= startOfMonday).length;
  
  const leadsAudited = safeCompanies.filter(c => 
    (c.status === 'Audited' && new Date(c.updated_at) >= startOfMonday) || 
    (c.scores && c.scores.some((s: any) => new Date(s.created_at) >= startOfMonday))
  ).length;

  const leadsContacted = safeCompanies.filter(c => 
    c.outreach_messages && c.outreach_messages.some((m: any) => new Date(m.sent_at) >= startOfMonday)
  ).length;
  
  // Engaged: Activity in outreach_messages THIS WEEK
  const leadsEngaged = safeCompanies.filter(c => 
    c.outreach_messages && c.outreach_messages.some((m: any) => 
        new Date(m.sent_at) >= startOfMonday && 
        (m.open_count > 0 || m.click_count > 0 || m.reply_flag)
    )
  ).length;
  
  const meetingsBooked = safeCompanies.filter(c => 
    c.status === 'Booked' && new Date(c.updated_at) >= startOfMonday
  ).length;

  const closedDeals = safeCompanies.filter(c => 
    c.status === 'Closed' && new Date(c.updated_at) >= startOfMonday
  ).length;
  
  const revenueGenerated = closedDeals * 2500;

  const statusCounts: Record<string, number> = {};
  safeCompanies.forEach(c => {
    const status = c.status || 'New';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  const pipelineStages = [
    { name: 'Sourced', count: leadsSourced, color: 'text-zinc-400' },
    { name: 'Audited', count: leadsAudited, color: 'text-brand' },
    { name: 'Contacted', count: leadsContacted, color: 'text-brand' },
    { name: 'Engaged', count: leadsEngaged, color: 'text-brand' },
    { name: 'Booked', count: meetingsBooked, color: 'text-brand' },
    { name: 'Closed', count: closedDeals, color: 'text-brand' },
  ];

  const QUOTES = [
    "Volume negates luck.",
    "You don't lack leads. You lack the discipline to follow up.",
    "The work needs doing. Stop negotiating with yourself.",
    "100 cold emails is a test. 10,000 is a business.",
    "Your pipeline is a direct reflection of your work ethic.",
    "Don't optimize a funnel you haven't even filled yet.",
    "If they don't know you exist, they can't pay you.",
    "The market rewards execution, not ideas.",
    "Outwork your self-doubt.",
    "They aren't ignoring you; you just haven't followed up enough."
  ];

  const dailyQuote = QUOTES[Math.floor(Math.random() * QUOTES.length)];

  return (
    <div className="flex-1 p-8 sm:p-12 pt-16 max-w-[1500px] mx-auto min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      <div className="flex flex-col gap-10">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 shrink-0">
          <div className="space-y-2">
            <h1 className="text-4xl sm:text-5xl font-black tracking-tighter uppercase font-heading">
              Performance Dashboard<span className="text-brand">.</span>
            </h1>
          </div>
          
          {/* Mobile-only prominent navigation - showing only on small screens */}
          <div className="flex sm:hidden w-full gap-2">
              <a href="/lead-finder" className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-zinc-900 border border-zinc-700/50 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-white hover:border-brand/40 hover:bg-zinc-800/50 transition-all shadow-md active:scale-[0.98]">
                  Find Leads
                  <ArrowUpRight className="h-3 w-3 text-brand" />
              </a>
              <a href="/pipeline" className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-zinc-900 border border-zinc-700/50 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-white hover:border-brand/40 hover:bg-zinc-800/50 transition-all shadow-md active:scale-[0.98]">
                  Pipeline
                  <ArrowUpRight className="h-3 w-3 text-brand" />
              </a>
          </div>
        </div>

        {/* Daily Directive / Quote Rotator */}
        <div className="relative overflow-hidden rounded-2xl border border-brand/20 bg-brand/[0.03] p-8 group">
          <div className="absolute top-0 right-0 p-4 opacity-[0.05] group-hover:opacity-10 transition-opacity">
            <QuoteIcon className="h-24 w-24 text-brand rotate-12" />
          </div>
          <div className="relative z-10 flex flex-col gap-2">
            <p className="text-2xl font-heading font-black italic tracking-tight text-white max-w-2xl leading-tight">
              "{dailyQuote}"
            </p>
          </div>
        </div>

        {/* This Week Metrics Grid */}
        <div className="space-y-6">
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand/80 flex items-center gap-3">
              <span className="h-[1px] w-4 bg-brand/50"></span>
              THIS WEEK
          </div>
          
          <div className="grid gap-4 sm:gap-6 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {/* Metric Card: Sourced */}
            <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/40 p-4 sm:p-6 shadow-sm backdrop-blur-sm group">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Sourced</h3>
                <div className="bg-brand/10 p-2 rounded-lg group-hover:bg-brand/20 transition-colors">
                    <UsersIcon className="h-3.5 w-3.5 text-brand" />
                </div>
              </div>
              <div className="flex items-baseline flex-wrap gap-2">
                <div className="text-2xl sm:text-3xl font-heading font-black">{leadsSourced}</div>
                <div className="text-[8px] sm:text-[10px] font-bold text-zinc-600 uppercase tracking-widest whitespace-nowrap">Leads</div>
              </div>
            </div>

            {/* Metric Card: Audited */}
            <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/40 p-4 sm:p-6 shadow-sm backdrop-blur-sm group">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Audited</h3>
                <div className="bg-brand/10 p-2 rounded-lg group-hover:bg-brand/20 transition-colors">
                    <ShieldCheck className="h-3.5 w-3.5 text-brand" />
                </div>
              </div>
              <div className="flex items-baseline flex-wrap gap-2">
                <div className="text-2xl sm:text-3xl font-heading font-black">{leadsAudited}</div>
                <div className="text-[8px] sm:text-[10px] font-bold text-zinc-600 uppercase tracking-widest whitespace-nowrap">Enriched</div>
              </div>
            </div>

            {/* Metric Card: Contacted */}
            <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/40 p-4 sm:p-6 shadow-sm backdrop-blur-sm group">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Contacted</h3>
                <div className="bg-brand/10 p-2 rounded-lg group-hover:bg-brand/20 transition-colors">
                    <Send className="h-3.5 w-3.5 text-brand" />
                </div>
              </div>
              <div className="flex items-baseline flex-wrap gap-2">
                <div className="text-2xl sm:text-3xl font-heading font-black">{leadsContacted}</div>
                <div className="text-[8px] sm:text-[10px] font-bold text-zinc-600 uppercase tracking-widest whitespace-nowrap">Reach</div>
              </div>
            </div>

            {/* Metric Card: Engaged */}
            <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/40 p-4 sm:p-6 shadow-sm backdrop-blur-sm group">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Engaged</h3>
                <div className="bg-brand/10 p-2 rounded-lg group-hover:bg-brand/20 transition-colors">
                    <MessageSquare className="h-3.5 w-3.5 text-brand" />
                </div>
              </div>
              <div className="flex items-baseline flex-wrap gap-2">
                <div className="text-2xl sm:text-3xl font-heading font-black">{leadsEngaged}</div>
                <div className="text-[8px] sm:text-[10px] font-bold text-zinc-600 uppercase tracking-widest whitespace-nowrap">Active</div>
              </div>
            </div>

            {/* Metric Card: Meetings */}
            <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/40 p-4 sm:p-6 shadow-sm backdrop-blur-sm group">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Meetings</h3>
                <div className="bg-brand/10 p-2 rounded-lg group-hover:bg-brand/20 transition-colors">
                    <Calendar className="h-3.5 w-3.5 text-brand" />
                </div>
              </div>
              <div className="flex items-baseline flex-wrap gap-2">
                <div className="text-2xl sm:text-3xl font-heading font-black">{meetingsBooked}</div>
                <div className="text-[8px] sm:text-[10px] font-bold text-zinc-600 uppercase tracking-widest whitespace-nowrap">Booked</div>
              </div>
            </div>

            {/* Metric Card: Revenue */}
            <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/40 p-4 sm:p-6 shadow-sm backdrop-blur-sm group">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Revenue</h3>
                <div className="bg-brand/10 p-2 rounded-lg group-hover:bg-brand/20 transition-colors">
                    <DollarSign className="h-3.5 w-3.5 text-brand" />
                </div>
              </div>
              <div className="flex items-baseline flex-wrap gap-2">
                <div className="text-2xl sm:text-3xl font-heading font-black truncate">${revenueGenerated.toLocaleString()}</div>
                <div className="text-[8px] sm:text-[10px] font-bold text-zinc-600 uppercase tracking-widest whitespace-nowrap">Closed</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-7">
          {/* Highest Rated Audits Section */}
          <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/20 backdrop-blur-sm lg:col-span-4 overflow-hidden">
            <div className="p-8 border-b border-zinc-800/50 flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <h3 className="text-xl font-heading font-bold uppercase">Highest Rated Audits</h3>
                <p className="text-xs text-zinc-500 font-medium tracking-wide">TOP PERFORMING AUDITS</p>
              </div>
              <button className="text-[10px] font-bold uppercase tracking-widest text-brand hover:underline">View All</button>
            </div>
            <div className="p-8">
              <div className="space-y-6">
                {safeCompanies
                  .filter(c => (c.scores?.length || 0) > 0)
                  .sort((a, b) => {
                    const scoreA = Math.max(...(a.scores || []).map((s: any) => s.score_overall || 0));
                    const scoreB = Math.max(...(b.scores || []).map((s: any) => s.score_overall || 0));
                    return scoreB - scoreA;
                  })
                  .slice(0, 5)
                  .map(company => {
                    const topScore = Math.max(...(company.scores || []).map((s: any) => s.score_overall || 0));
                    return (
                      <div key={company.id} className="flex items-center gap-6 group">
                        <div className="h-10 w-10 bg-zinc-800/50 rounded-lg flex items-center justify-center text-zinc-400 group-hover:bg-brand/10 group-hover:text-brand transition-all border border-zinc-700/30">
                          <ShieldCheck className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-heading font-bold text-lg truncate text-white">{company.name}</p>
                          <p className="text-xs text-zinc-500 font-medium truncate uppercase tracking-wider">{company.city}{company.phone ? ` • ${company.phone}` : ''}</p>
                        </div>
                        <Badge variant="outline" className="text-xs font-black px-3 py-1 bg-brand/10 border-brand/20 uppercase tracking-tighter text-brand italic">
                          {topScore} SCORE
                        </Badge>
                      </div>
                    );
                  })}
                {safeCompanies.filter(c => (c.scores?.length || 0) > 0).length === 0 && (
                  <div className="text-sm text-zinc-500 p-12 text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-900/10 uppercase font-black tracking-widest opacity-50">
                    No leads audited this week.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Pipeline Summary Section */}
          <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/20 backdrop-blur-sm lg:col-span-3 overflow-hidden flex flex-col">
            <div className="p-8 border-b border-zinc-800/50">
              <h3 className="text-xl font-heading font-bold uppercase tracking-tighter">Pipeline Core</h3>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Conversion Efficiency</p>
            </div>
            <div className="p-8 flex-1 flex flex-col justify-between">
              <div className="space-y-8">
                {pipelineStages.map((stage) => {
                  const percentage = safeCompanies.length > 0 ? Math.round((stage.count / safeCompanies.length) * 100) : 0;
                  return (
                    <div key={stage.name} className="flex flex-col gap-2">
                      <div className="flex items-end justify-between">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-black uppercase tracking-widest text-zinc-400">{stage.name}</span>
                          <span className="text-[10px] font-bold text-brand uppercase">{stage.count} Units</span>
                        </div>
                        <span className="text-xs font-black text-white">{percentage}%</span>
                      </div>
                      <div className="h-2 w-full bg-zinc-800/50 rounded-full overflow-hidden">
                          <div 
                              className="h-full bg-brand transition-all duration-500" 
                              style={{ width: `${percentage}%` }}
                          />
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
