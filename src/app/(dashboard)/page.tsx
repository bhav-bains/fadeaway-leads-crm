import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Badge } from "@/components/ui/badge";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch all leads (RLS protects it to the user's workspace)
  const { data: leads } = await supabase
    .from('leads')
    .select(`
        *,
        profiles:assigned_to ( full_name )
    `)
    .order('created_at', { ascending: false });

  const safeLeads = leads || [];

  // ================= METRICS MATH =================
  const now = new Date();
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(now.getDate() - 7);

  const sourcedThisWeek = safeLeads.filter(l => new Date(l.created_at) >= oneWeekAgo).length;
  const meetingsBooked = safeLeads.filter(l => l.status === 'Meeting Booked').length;

  // Projected Pipeline: assume $2,500 per meeting booked
  const expectedValuePerMeeting = 2500;
  const projectedRevenue = meetingsBooked * expectedValuePerMeeting;

  // ================= LEADERBOARD MATH =================
  // Group "Meeting Booked" and "Closed Won" by assigned user
  const repScores: Record<string, { name: string, points: number, meetings: number }> = {};

  safeLeads.forEach(lead => {
    // We only care about progressing leads for the leaderboard MVP
    if (lead.status === 'Meeting Booked' || lead.status === 'Closed Won') {
      // Safely extract name, defaulting if unknown
      let repName = "Unknown Rep";
      if (lead.profiles && !Array.isArray(lead.profiles) && lead.profiles.full_name) {
        repName = lead.profiles.full_name;
      } else if (lead.assigned_to === user.id) {
        repName = "You";
      }

      if (!repScores[repName]) {
        repScores[repName] = { name: repName, points: 0, meetings: 0 };
      }

      repScores[repName].meetings += 1;
      // Let's say Meeting Booked = 500 points, Closed Won = 2000 points
      repScores[repName].points += lead.status === 'Closed Won' ? 2000 : 500;
    }
  });

  const leaderboardTop3 = Object.values(repScores)
    .sort((a, b) => b.points - a.points)
    .slice(0, 3);

  // If nobody has points yet, we fake one for the MVP so it's not entirely empty
  if (leaderboardTop3.length === 0) {
    leaderboardTop3.push({ name: "Your Team", points: 0, meetings: 0 });
  }

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
            <h3 className="tracking-tight text-sm font-medium">Total Sourced This Week</h3>
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

        <div className="rounded-xl border bg-card text-card-foreground shadow lg:col-span-2">
          <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Projected Pipeline Revenue</h3>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="h-4 w-4 text-muted-foreground"><line x1="12" x2="12" y1="2" y2="22"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
          </div>
          <div className="p-6 pt-0">
            <div className="text-2xl font-bold">${projectedRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Assumes $2.5k avg. deal value per meeting</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="rounded-xl border bg-card text-card-foreground shadow col-span-4">
          <div className="flex flex-col space-y-1.5 p-6">
            <h3 className="font-semibold leading-none tracking-tight">Recent Pending Leads</h3>
            <p className="text-sm text-muted-foreground">Sourced prospects waiting to be worked.</p>
          </div>
          <div className="p-6 pt-0">
            <div className="space-y-4">
              {safeLeads.filter(l => l.status === 'Sourced').slice(0, 5).map(lead => (
                <div key={lead.id} className="flex items-center gap-4 border-b pb-4 last:border-0 last:pb-0">
                  <div className="bg-gray-100 text-gray-700 p-2 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">{lead.company_name}</p>
                    <p className="text-xs text-muted-foreground">{lead.city} • {lead.niche}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">{lead.status}</Badge>
                </div>
              ))}
              {safeLeads.filter(l => l.status === 'Sourced').length === 0 && (
                <div className="text-sm text-muted-foreground p-4 text-center border rounded-md bg-muted/20">
                  No new sourced leads waiting. Go find some!
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card text-card-foreground shadow col-span-3">
          <div className="flex flex-col space-y-1.5 p-6 pb-4">
            <h3 className="font-semibold leading-none tracking-tight">Leaderboard</h3>
          </div>
          <div className="p-6 pt-0">
            <div className="space-y-6">
              {leaderboardTop3.map((rep, idx) => {
                let bgColors = "bg-gray-100 text-gray-700";
                if (idx === 0) bgColors = "bg-yellow-100 text-yellow-700";
                if (idx === 1) bgColors = "bg-slate-200 text-slate-700";
                if (idx === 2) bgColors = "bg-amber-100/50 text-amber-700";

                return (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm ${bgColors}`}>
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium leading-none">{rep.name}</p>
                        <p className="text-xs text-muted-foreground">{rep.meetings} Meetings Booked</p>
                      </div>
                    </div>
                    <div className="font-medium text-emerald-600">{rep.points.toLocaleString()} pts</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
