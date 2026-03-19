import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Badge } from "@/components/ui/badge";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch all companies
  const { data: companies } = await supabase
    .from('companies')
    .select(`
        *,
        scores!left (score_overall)
    `)
    .order('created_at', { ascending: false });

  const safeCompanies = companies || [];
  const now = new Date();
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(now.getDate() - 7);

  const sourcedThisWeek = safeCompanies.filter(c => new Date(c.created_at) >= oneWeekAgo).length;
  const meetingsBooked = safeCompanies.filter(c => c.status === 'Booked').length;
  const projectedRevenue = meetingsBooked * 2500;

  const statusCounts: Record<string, number> = {};
  safeCompanies.forEach(c => {
    const status = c.status || 'New';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  const pipelineStages = [
    { name: 'New', count: statusCounts['New'] || 0, color: 'text-brand' },
    { name: 'Contacted', count: statusCounts['Contacted'] || 0, color: 'text-brand' },
    { name: 'Booked', count: statusCounts['Booked'] || 0, color: 'text-brand' },
    { name: 'Closed', count: statusCounts['Closed'] || 0, color: 'text-brand' },
  ];

  return (
    <div className="flex flex-col gap-10 font-sans relative">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl lg:text-6xl font-heading font-black tracking-tighter uppercase">
          Performance<span className="text-brand">.</span>
        </h1>
        <p className="text-zinc-400 text-base lg:text-lg">
          Live performance metrics.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Metric Card: New Leads */}
        <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/40 p-6 shadow-sm backdrop-blur-sm relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">New Leads</h3>
            <div className="bg-brand/10 p-2 rounded-lg group-hover:bg-brand/20 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4 text-brand"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <div className="text-4xl font-heading font-black">{sourcedThisWeek}</div>
            <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Sourced</div>
          </div>
        </div>

        {/* Metric Card: Meetings */}
        <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/40 p-6 shadow-sm backdrop-blur-sm relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Meetings</h3>
            <div className="bg-brand/10 p-2 rounded-lg group-hover:bg-brand/20 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4 text-brand"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect><line x1="3" x2="21" y1="10" y2="10"></line></svg>
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <div className="text-4xl font-heading font-black">{meetingsBooked}</div>
            <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Booked</div>
          </div>
        </div>

        {/* Metric Card: Total Leads */}
        <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/40 p-6 shadow-sm backdrop-blur-sm relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Total Leads</h3>
            <div className="bg-brand/10 p-2 rounded-lg group-hover:bg-brand/20 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4 text-brand"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <div className="text-4xl font-heading font-black">{safeCompanies.length}</div>
            <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Verified</div>
          </div>
        </div>

        {/* Metric Card: Pipeline Value */}
        <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/40 p-6 shadow-sm backdrop-blur-sm relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Pipeline Value</h3>
            <div className="bg-brand/10 p-2 rounded-lg group-hover:bg-brand/20 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4 text-brand"><line x1="12" x2="12" y1="2" y2="22"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <div className="text-4xl font-heading font-black">${(projectedRevenue / 1000).toFixed(1)}k</div>
            <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Est. ROI</div>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-7">
        {/* Recent Leads Section */}
        <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/20 backdrop-blur-sm col-span-4 overflow-hidden">
          <div className="p-8 border-b border-zinc-800/50 flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <h3 className="text-xl font-heading font-bold uppercase">Recent Leads</h3>
              <p className="text-xs text-zinc-500 font-medium tracking-wide">HIGH-PRIORITY PIPELINE ENTRY</p>
            </div>
            <button className="text-[10px] font-bold uppercase tracking-widest text-brand hover:underline">View All</button>
          </div>
          <div className="p-8">
            <div className="space-y-6">
              {safeCompanies.filter(c => c.status === 'New').slice(0, 5).map(company => (
                <div key={company.id} className="flex items-center gap-6 group">
                  <div className="h-10 w-10 bg-zinc-800/50 rounded-lg flex items-center justify-center text-zinc-400 group-hover:bg-brand/10 group-hover:text-brand transition-all border border-zinc-700/30">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 font-bold"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-bold text-lg truncate text-white">{company.name}</p>
                    <p className="text-xs text-zinc-500 font-medium truncate uppercase tracking-wider">{company.city}{company.phone ? ` • ${company.phone}` : ''}</p>
                  </div>
                  <Badge variant="outline" className="text-xs font-black px-3 py-1 bg-zinc-800/30 border-zinc-700/50 uppercase tracking-tighter text-zinc-400">NEW</Badge>
                </div>
              ))}
              {safeCompanies.filter(c => c.status === 'New').length === 0 && (
                <div className="text-sm text-zinc-500 p-12 text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-900/10 uppercase font-black tracking-widest opacity-50">
                  No new leads sourced.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Pipeline Summary Section */}
        <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/20 backdrop-blur-sm col-span-3 overflow-hidden flex flex-col">
          <div className="p-8 border-b border-zinc-800/50">
            <h3 className="text-xl font-heading font-bold uppercase italic tracking-tighter">Pipeline Core</h3>
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

            {/* High-Performance Advice */}
            <div className="mt-12 p-6 rounded-xl bg-brand/5 border border-brand/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-12 w-12 text-brand"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" x2="12" y1="3" y2="15"></line></svg>
                </div>
                <div className="flex items-center gap-2 mb-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse"></div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-brand">Performance Advice</span>
                </div>
                <p className="text-xs italic text-zinc-400 leading-relaxed font-sans">
                  "Your conversion rate is optimized. Increase outreach volume by 15% to hit next-tier targets."
                </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
