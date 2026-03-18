import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Badge } from "@/components/ui/badge";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch all companies (RLS protects it to the user's workspace)
  const { data: companies } = await supabase
    .from('companies')
    .select(`
        *,
        scores!left (score_overall)
    `)
    .order('created_at', { ascending: false });

  const safeCompanies = companies || [];

  // ================= METRICS MATH =================
  const now = new Date();
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(now.getDate() - 7);

  const sourcedThisWeek = safeCompanies.filter(c => new Date(c.created_at) >= oneWeekAgo).length;
  const meetingsBooked = safeCompanies.filter(c => c.status === 'Booked').length;

  // Projected Pipeline: assume $2,500 per meeting booked
  const expectedValuePerMeeting = 2500;
  const projectedRevenue = meetingsBooked * expectedValuePerMeeting;

  // ================= PIPELINE SUMMARY =================
  const statusCounts: Record<string, number> = {};
  safeCompanies.forEach(c => {
    const status = c.status || 'New';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  const pipelineStages = [
    { name: 'New', count: statusCounts['New'] || 0, color: 'bg-blue-100 text-blue-700' },
    { name: 'Contacted', count: statusCounts['Contacted'] || 0, color: 'bg-yellow-100 text-yellow-700' },
    { name: 'Booked', count: statusCounts['Booked'] || 0, color: 'bg-green-100 text-green-700' },
    { name: 'Closed', count: statusCounts['Closed'] || 0, color: 'bg-purple-100 text-purple-700' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Main Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Your pipeline and performance at a glance.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Sourced This Week</h3>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="h-4 w-4 text-muted-foreground"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          </div>
          <div className="p-6 pt-0">
            <div className="text-2xl font-bold">{sourcedThisWeek}</div>
            <p className="text-xs text-muted-foreground">Rolling 7 days</p>
          </div>
        </div>

        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Meetings Booked</h3>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="h-4 w-4 text-muted-foreground"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect><line x1="16" x2="16" y1="2" y2="6"></line><line x1="8" x2="8" y1="2" y2="6"></line><line x1="3" x2="21" y1="10" y2="10"></line></svg>
          </div>
          <div className="p-6 pt-0">
            <div className="text-2xl font-bold">{meetingsBooked}</div>
            <p className="text-xs text-muted-foreground">Lifetime pipeline</p>
          </div>
        </div>

        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Total Companies</h3>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="h-4 w-4 text-muted-foreground"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          </div>
          <div className="p-6 pt-0">
            <div className="text-2xl font-bold">{safeCompanies.length}</div>
            <p className="text-xs text-muted-foreground">In your workspace</p>
          </div>
        </div>

        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Projected Revenue</h3>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="h-4 w-4 text-muted-foreground"><line x1="12" x2="12" y1="2" y2="22"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
          </div>
          <div className="p-6 pt-0">
            <div className="text-2xl font-bold">${projectedRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">$2.5k avg. per booked meeting</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="rounded-xl border bg-card text-card-foreground shadow col-span-4">
          <div className="flex flex-col space-y-1.5 p-6">
            <h3 className="font-semibold leading-none tracking-tight">Recent New Leads</h3>
            <p className="text-sm text-muted-foreground">Fresh companies waiting to be worked.</p>
          </div>
          <div className="p-6 pt-0">
            <div className="space-y-4">
              {safeCompanies.filter(c => c.status === 'New').slice(0, 5).map(company => (
                <div key={company.id} className="flex items-center gap-4 border-b pb-4 last:border-0 last:pb-0">
                  <div className="bg-gray-100 text-gray-700 p-2 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">{company.name}</p>
                    <p className="text-xs text-muted-foreground">{company.city}{company.phone ? ` • ${company.phone}` : ''}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">{company.status}</Badge>
                </div>
              ))}
              {safeCompanies.filter(c => c.status === 'New').length === 0 && (
                <div className="text-sm text-muted-foreground p-4 text-center border rounded-md bg-muted/20">
                  No new leads waiting. Go find some!
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card text-card-foreground shadow col-span-3">
          <div className="flex flex-col space-y-1.5 p-6 pb-4">
            <h3 className="font-semibold leading-none tracking-tight">Pipeline Overview</h3>
          </div>
          <div className="p-6 pt-0">
            <div className="space-y-5">
              {pipelineStages.map((stage) => (
                <div key={stage.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm ${stage.color}`}>
                      {stage.count}
                    </div>
                    <p className="text-sm font-medium leading-none">{stage.name}</p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {safeCompanies.length > 0 ? Math.round((stage.count / safeCompanies.length) * 100) : 0}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
