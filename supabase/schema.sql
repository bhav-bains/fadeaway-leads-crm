-- Fadeaway Leads CRM Database Schema

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Workspaces (Tenants)
create table public.workspaces (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Profiles (Users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  workspace_id uuid references public.workspaces(id) on delete restrict,
  role text check (role in ('admin', 'rep')) default 'rep',
  full_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Leads
create table public.leads (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references public.workspaces(id) on delete restrict not null,
  assigned_to uuid references public.profiles(id) on delete set null,
  
  -- Company Info
  company_name text not null,
  address text,
  city text,
  niche text,
  phone text,
  website text,
  
  -- Enrichment Data
  owner_name text,
  owner_email text,
  social_links jsonb,
  
  -- Pipeline Data
  status text check (status in ('Sourced', 'Auditing', 'Active Outreach', 'Meeting Booked', 'Needs Analysis', 'Closed Won', 'Closed Lost')) default 'Sourced',
  score text check (score in ('Hot', 'Warm', 'Cold')),
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Toggle RLS
alter table public.workspaces enable row level security;
alter table public.profiles enable row level security;
alter table public.leads enable row level security;

-- RLS Policies: Workspaces
create policy "Users can view their own workspace"
  on public.workspaces for select
  using ( id in (select workspace_id from public.profiles where id = auth.uid()) );

create policy "Users can insert workspaces"
  on public.workspaces for insert
  with check (auth.role() = 'authenticated');

-- RLS Policies: Profiles
create policy "Users can view their own profile"
  on public.profiles for select
  using ( id = auth.uid() );

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check ( id = auth.uid() );

create policy "Users can update their own profile"
  on public.profiles for update
  using ( id = auth.uid() );

-- RLS Policies: Leads
create policy "Users can view leads in their workspace"
  on public.leads for select
  using ( workspace_id in (select workspace_id from public.profiles where id = auth.uid()) );

create policy "Users can insert leads in their workspace"
  on public.leads for insert
  with check ( workspace_id in (select workspace_id from public.profiles where id = auth.uid()) );

create policy "Users can update leads in their workspace"
  on public.leads for update
  using ( workspace_id in (select workspace_id from public.profiles where id = auth.uid()) );

-- Trigger for updated_at
create or replace function update_modified_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language 'plpgsql';

create trigger update_leads_modtime
before update on public.leads
for each row execute procedure update_modified_column();
