-- Fadeaway Leads CRM - SEO Audit Engine Schema (Phase 6 / Pipeline 2.0)

-- Ensure UUID extension is enabled
create extension if not exists "uuid-ossp";

-- 1. runs (The Engine Tracker)
create table public.runs (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references public.workspaces(id) on delete restrict not null,
  query text,
  city text,
  lat float,
  lng float,
  radius_m int,
  status text check (status in ('queued', 'in_progress', 'done', 'error')) default 'queued',
  started_at timestamp with time zone,
  finished_at timestamp with time zone,
  totals_json jsonb
);

-- 2. companies (The Core Entity - Replaces plain 'leads' table logic)
create table public.companies (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references public.workspaces(id) on delete restrict not null,
  name text not null,
  normalized_name text,
  domain text,
  website text,
  phone text,
  street text,
  city text,
  region text,
  country text,
  postal text,
  lat float,
  lng float,
  geohash5 text,
  rating_avg float,
  rating_count int,
  source text,
  source_id text,
  status text check (status in ('New', 'Contacted', 'Booked', 'Closed')) default 'New',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Trigger for companies updated_at
create trigger update_companies_modtime
before update on public.companies
for each row execute procedure update_modified_column();


-- 3a. contacts
create table public.contacts (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references public.companies(id) on delete cascade not null,
  email text not null,
  type text check (type in ('generic', 'personal', 'form_only')),
  confidence int
);

-- 3b. socials
create table public.socials (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references public.companies(id) on delete cascade not null,
  platform text check (platform in ('instagram', 'facebook', 'youtube', 'tiktok', 'x')),
  url text,
  handle text
);

-- 4. seo_audits (The Sales Ammunition)
create table public.seo_audits (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references public.companies(id) on delete cascade not null,
  has_title boolean,
  title_len int,
  has_h1 boolean,
  has_booking_link boolean,
  has_business_profile boolean,
  schema_org_types text[],
  top_keywords_found text[]
);

-- 5. scores (The Prioritization Brain)
create table public.scores (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references public.companies(id) on delete cascade not null,
  score_overall int,
  score_contactability int,
  score_seo int,
  score_local_intent int,
  score_fit int
);

-- 6a. outreach_messages
create table public.outreach_messages (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references public.companies(id) on delete cascade not null,
  sequence_name text,
  step int,
  subject text,
  body text,
  sent_at timestamp with time zone,
  status text,
  open_count int default 0,
  click_count int default 0,
  reply_flag boolean default false
);

-- 6b. fetch_log (Crucial for debugging scraper blocks)
create table public.fetch_log (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references public.companies(id) on delete cascade not null,
  url text,
  step text,
  status text,
  notes text,
  fetched_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. settings (Global Configs)
create table public.settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  booking_link text,
  default_keywords text[],
  thresholds jsonb
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) FOR NEW TABLES
-- ==========================================

alter table public.runs enable row level security;
alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.socials enable row level security;
alter table public.seo_audits enable row level security;
alter table public.scores enable row level security;
alter table public.outreach_messages enable row level security;
alter table public.fetch_log enable row level security;
alter table public.settings enable row level security;

-- Workspaces Policies (assuming users belong to a workspace)
create policy "Users can view runs in their workspace" on public.runs for select using ( workspace_id in (select workspace_id from public.profiles where id = auth.uid()) );
create policy "Users can insert runs in their workspace" on public.runs for insert with check ( workspace_id in (select workspace_id from public.profiles where id = auth.uid()) );
create policy "Users can update runs in their workspace" on public.runs for update using ( workspace_id in (select workspace_id from public.profiles where id = auth.uid()) );

create policy "Users can view companies in their workspace" on public.companies for select using ( workspace_id in (select workspace_id from public.profiles where id = auth.uid()) );
create policy "Users can insert companies in their workspace" on public.companies for insert with check ( workspace_id in (select workspace_id from public.profiles where id = auth.uid()) );
create policy "Users can update companies in their workspace" on public.companies for update using ( workspace_id in (select workspace_id from public.profiles where id = auth.uid()) );
create policy "Users can delete companies in their workspace" on public.companies for delete using ( workspace_id in (select workspace_id from public.profiles where id = auth.uid()) );

-- Related tables inherit security by joining on company_id -> workspace_id
create policy "View contacts" on public.contacts for select using ( company_id in (select id from public.companies where workspace_id in (select workspace_id from public.profiles where id = auth.uid())) );
create policy "Insert contacts" on public.contacts for insert with check ( company_id in (select id from public.companies where workspace_id in (select workspace_id from public.profiles where id = auth.uid())) );
create policy "Update contacts" on public.contacts for update using ( company_id in (select id from public.companies where workspace_id in (select workspace_id from public.profiles where id = auth.uid())) );
create policy "Delete contacts" on public.contacts for delete using ( company_id in (select id from public.companies where workspace_id in (select workspace_id from public.profiles where id = auth.uid())) );

create policy "View socials" on public.socials for select using ( company_id in (select id from public.companies where workspace_id in (select workspace_id from public.profiles where id = auth.uid())) );
create policy "Insert socials" on public.socials for insert with check ( company_id in (select id from public.companies where workspace_id in (select workspace_id from public.profiles where id = auth.uid())) );
create policy "Update socials" on public.socials for update using ( company_id in (select id from public.companies where workspace_id in (select workspace_id from public.profiles where id = auth.uid())) );

create policy "View seo_audits" on public.seo_audits for select using ( company_id in (select id from public.companies where workspace_id in (select workspace_id from public.profiles where id = auth.uid())) );
create policy "Insert seo_audits" on public.seo_audits for insert with check ( company_id in (select id from public.companies where workspace_id in (select workspace_id from public.profiles where id = auth.uid())) );
create policy "Update seo_audits" on public.seo_audits for update using ( company_id in (select id from public.companies where workspace_id in (select workspace_id from public.profiles where id = auth.uid())) );

create policy "View scores" on public.scores for select using ( company_id in (select id from public.companies where workspace_id in (select workspace_id from public.profiles where id = auth.uid())) );
create policy "Insert scores" on public.scores for insert with check ( company_id in (select id from public.companies where workspace_id in (select workspace_id from public.profiles where id = auth.uid())) );
create policy "Update scores" on public.scores for update using ( company_id in (select id from public.companies where workspace_id in (select workspace_id from public.profiles where id = auth.uid())) );

create policy "View outreach_messages" on public.outreach_messages for select using ( company_id in (select id from public.companies where workspace_id in (select workspace_id from public.profiles where id = auth.uid())) );
create policy "Insert outreach_messages" on public.outreach_messages for insert with check ( company_id in (select id from public.companies where workspace_id in (select workspace_id from public.profiles where id = auth.uid())) );
create policy "Update outreach_messages" on public.outreach_messages for update using ( company_id in (select id from public.companies where workspace_id in (select workspace_id from public.profiles where id = auth.uid())) );

create policy "View fetch_log" on public.fetch_log for select using ( company_id in (select id from public.companies where workspace_id in (select workspace_id from public.profiles where id = auth.uid())) );
create policy "Insert fetch_log" on public.fetch_log for insert with check ( company_id in (select id from public.companies where workspace_id in (select workspace_id from public.profiles where id = auth.uid())) );
create policy "Update fetch_log" on public.fetch_log for update using ( company_id in (select id from public.companies where workspace_id in (select workspace_id from public.profiles where id = auth.uid())) );

create policy "Users can view settings" on public.settings for select using ( workspace_id in (select workspace_id from public.profiles where id = auth.uid()) );
create policy "Users can insert settings" on public.settings for insert with check ( workspace_id in (select workspace_id from public.profiles where id = auth.uid()) );
create policy "Users can update settings" on public.settings for update using ( workspace_id in (select workspace_id from public.profiles where id = auth.uid()) );
