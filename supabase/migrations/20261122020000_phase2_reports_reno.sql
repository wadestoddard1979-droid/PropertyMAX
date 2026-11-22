-- Phase 2 closeout: owner statements, renovation projects, turnover, assets
-- Pilot persists these in the AppStore JSON / hydrate layer; tables support
-- future Supabase-native reads.

create table if not exists public.owner_statements (
  id text primary key,
  property_id text not null references public.properties (id) on delete cascade,
  month text not null,
  payload jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  generated_by_user_id text references public.profiles (id) on delete set null
);

create table if not exists public.renovation_projects (
  id text primary key,
  property_id text not null references public.properties (id) on delete cascade,
  unit_id text references public.units (id) on delete set null,
  title text not null,
  scope text not null default '',
  budget_cents integer not null default 0,
  spent_cents integer not null default 0,
  status text not null default 'draft',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.turnover_checklists (
  id text primary key,
  property_id text not null references public.properties (id) on delete cascade,
  unit_id text references public.units (id) on delete set null,
  lease_id text references public.leases (id) on delete set null,
  title text not null,
  move_out_date date,
  status text not null default 'open',
  vacancy_cost_cents integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assets (
  id text primary key,
  property_id text not null references public.properties (id) on delete cascade,
  unit_id text references public.units (id) on delete set null,
  category text not null,
  name text not null,
  make_model text,
  serial_number text,
  installed_at date,
  warranty_ends_at date,
  expected_life_years integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.owner_statements enable row level security;
alter table public.renovation_projects enable row level security;
alter table public.turnover_checklists enable row level security;
alter table public.assets enable row level security;
