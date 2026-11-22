-- PropertMax Phase 2 foundation schema
-- Apply with: supabase db push | psql $DATABASE_URL -f ...
-- Production: Postgres + RLS; app still enforces server-side permission checks.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Organizations & memberships
-- ---------------------------------------------------------------------------
create table if not exists public.organizations (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id text primary key,
  email text not null unique,
  full_name text not null,
  -- Demo password used only when ALLOW_DEMO_LOGIN=true; prefer Supabase Auth.
  demo_password text,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create type public.app_role as enum ('owner', 'manager', 'tenant', 'contractor');

create table if not exists public.memberships (
  id text primary key,
  org_id text not null references public.organizations (id) on delete cascade,
  user_id text not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  unique (org_id, user_id, role)
);

-- ---------------------------------------------------------------------------
-- Properties / units / leases
-- ---------------------------------------------------------------------------
create table if not exists public.properties (
  id text primary key,
  org_id text not null references public.organizations (id) on delete cascade,
  name text not null,
  address text not null,
  type text not null default 'Townhouse',
  beds numeric not null default 0,
  baths numeric not null default 0,
  sqft integer not null default 0,
  occupancy text not null check (occupancy in ('Occupied', 'Vacant')),
  owner_id text not null references public.profiles (id),
  manager_id text not null references public.profiles (id),
  owner_approval_threshold_cents integer not null default 20000,
  monthly_rent numeric not null default 0,
  lease_end text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.property_tenants (
  property_id text not null references public.properties (id) on delete cascade,
  tenant_id text not null references public.profiles (id) on delete cascade,
  primary key (property_id, tenant_id)
);

create table if not exists public.units (
  id text primary key,
  property_id text not null references public.properties (id) on delete cascade,
  label text not null,
  beds numeric not null default 0,
  baths numeric not null default 0,
  sqft integer not null default 0,
  occupancy text not null check (occupancy in ('Occupied', 'Vacant')),
  monthly_rent_cents integer not null default 0
);

create table if not exists public.leases (
  id text primary key,
  property_id text not null references public.properties (id) on delete cascade,
  unit_id text not null references public.units (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  monthly_rent_cents integer not null,
  deposit_cents integer not null default 0,
  status text not null check (status in ('active', 'upcoming', 'ended')),
  notes text not null default ''
);

create table if not exists public.lease_tenants (
  lease_id text not null references public.leases (id) on delete cascade,
  tenant_id text not null references public.profiles (id) on delete cascade,
  primary key (lease_id, tenant_id)
);

-- ---------------------------------------------------------------------------
-- Vendors & work orders
-- ---------------------------------------------------------------------------
create table if not exists public.vendors (
  id text primary key,
  org_id text not null references public.organizations (id) on delete cascade,
  name text not null,
  trade text not null,
  contractor_user_id text not null references public.profiles (id)
);

create table if not exists public.work_orders (
  id text primary key,
  property_id text not null references public.properties (id) on delete cascade,
  created_by_user_id text not null references public.profiles (id),
  title text not null,
  details text not null,
  category text not null,
  urgency text not null,
  status text not null,
  estimate_cents integer,
  estimate_notes text,
  contractor_user_id text references public.profiles (id),
  vendor_id text references public.vendors (id),
  owner_decision text,
  owner_note text,
  requires_owner_approval boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

-- ---------------------------------------------------------------------------
-- Expenses / payments (refs) / projections
-- ---------------------------------------------------------------------------
create table if not exists public.ledger_entries (
  id text primary key,
  property_id text not null references public.properties (id) on delete cascade,
  month text not null,
  category text not null,
  label text not null,
  amount_cents integer not null,
  source text not null check (source in ('illustrative', 'manual', 'verified')),
  created_at timestamptz not null default now()
);

create table if not exists public.payment_refs (
  id text primary key,
  property_id text not null references public.properties (id) on delete cascade,
  lease_id text references public.leases (id) on delete set null,
  provider text not null default 'pending',
  external_id text,
  amount_cents integer not null,
  status text not null default 'planned',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.projection_assumptions (
  property_id text primary key references public.properties (id) on delete cascade,
  monthly_rent_cents integer not null,
  vacancy_rate_pct numeric not null,
  monthly_repairs_cents integer not null,
  monthly_mortgage_cents integer not null,
  monthly_taxes_cents integer not null,
  monthly_insurance_cents integer not null,
  monthly_pm_fee_cents integer not null,
  monthly_hoa_cents integer not null,
  monthly_utilities_owner_cents integer not null,
  annual_rent_growth_pct numeric not null,
  renovation_spend_cents integer not null,
  renovation_month_offset integer not null,
  renovation_rent_uplift_cents integer not null,
  vacancy_months_on_turnover numeric not null
);

-- ---------------------------------------------------------------------------
-- Documents / messages / notifications / activity / audit
-- ---------------------------------------------------------------------------
create table if not exists public.documents (
  id text primary key,
  property_id text not null references public.properties (id) on delete cascade,
  work_order_id text references public.work_orders (id) on delete set null,
  lease_id text references public.leases (id) on delete set null,
  title text not null,
  category text not null,
  file_name text not null,
  storage_path text,
  uploaded_by_user_id text not null references public.profiles (id),
  visibility public.app_role[] not null default array['owner','manager']::public.app_role[],
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.message_threads (
  id text primary key,
  property_id text not null references public.properties (id) on delete cascade,
  work_order_id text references public.work_orders (id) on delete set null,
  subject text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists public.message_participants (
  thread_id text not null references public.message_threads (id) on delete cascade,
  user_id text not null references public.profiles (id) on delete cascade,
  primary key (thread_id, user_id)
);

create table if not exists public.messages (
  id text primary key,
  thread_id text not null references public.message_threads (id) on delete cascade,
  author_user_id text not null references public.profiles (id),
  body text not null,
  created_at timestamptz not null
);

create table if not exists public.notifications (
  id text primary key,
  user_id text not null references public.profiles (id) on delete cascade,
  work_order_id text references public.work_orders (id) on delete set null,
  title text not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null
);

create table if not exists public.activity_events (
  id text primary key,
  work_order_id text references public.work_orders (id) on delete set null,
  property_id text not null references public.properties (id) on delete cascade,
  actor_user_id text not null references public.profiles (id),
  kind text not null,
  message text not null,
  created_at timestamptz not null
);

create table if not exists public.audit_logs (
  id text primary key default gen_random_uuid()::text,
  org_id text references public.organizations (id) on delete set null,
  actor_user_id text references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.automation_policies (
  id text primary key,
  property_id text not null references public.properties (id) on delete cascade,
  name text not null,
  spend_threshold_cents integer not null default 20000,
  preapproved_categories text[] not null default '{}',
  emergency_process text,
  preferred_vendor_ids text[] not null default '{}',
  escalation_contact_user_id text references public.profiles (id),
  max_wait_hours integer,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Durable job queue (DB-backed; production may swap to SQS/Cloud Tasks/Inngest)
-- ---------------------------------------------------------------------------
create table if not exists public.job_queue (
  id text primary key default gen_random_uuid()::text,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed', 'dead')),
  attempts integer not null default 0,
  run_after timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_queue_pending_idx
  on public.job_queue (status, run_after);

-- ---------------------------------------------------------------------------
-- Helpers for RLS
-- ---------------------------------------------------------------------------
create or replace function public.current_profile_id()
returns text
language sql
stable
as $$
  select coalesce(
    (select id from public.profiles where auth_user_id = auth.uid() limit 1),
    auth.jwt() ->> 'propertmax_profile_id'
  );
$$;

create or replace function public.has_property_access(p_property_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.properties p
    where p.id = p_property_id
      and (
        p.owner_id = public.current_profile_id()
        or p.manager_id = public.current_profile_id()
        or exists (
          select 1 from public.property_tenants t
          where t.property_id = p.id and t.tenant_id = public.current_profile_id()
        )
        or exists (
          select 1 from public.work_orders w
          where w.property_id = p.id
            and w.contractor_user_id = public.current_profile_id()
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.properties enable row level security;
alter table public.property_tenants enable row level security;
alter table public.units enable row level security;
alter table public.leases enable row level security;
alter table public.lease_tenants enable row level security;
alter table public.vendors enable row level security;
alter table public.work_orders enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.payment_refs enable row level security;
alter table public.projection_assumptions enable row level security;
alter table public.documents enable row level security;
alter table public.message_threads enable row level security;
alter table public.message_participants enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_events enable row level security;
alter table public.audit_logs enable row level security;
alter table public.automation_policies enable row level security;
alter table public.job_queue enable row level security;

-- Profiles: users can read own + peers on shared properties (simplified: read self)
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select using (id = public.current_profile_id() or auth.role() = 'service_role');

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = public.current_profile_id() or auth.role() = 'service_role');

-- Generic property-scoped read
drop policy if exists properties_access on public.properties;
create policy properties_access on public.properties
  for all using (
    auth.role() = 'service_role'
    or owner_id = public.current_profile_id()
    or manager_id = public.current_profile_id()
    or exists (
      select 1 from public.property_tenants t
      where t.property_id = id and t.tenant_id = public.current_profile_id()
    )
  )
  with check (auth.role() = 'service_role' or manager_id = public.current_profile_id());

drop policy if exists units_access on public.units;
create policy units_access on public.units
  for all using (auth.role() = 'service_role' or public.has_property_access(property_id))
  with check (auth.role() = 'service_role' or public.has_property_access(property_id));

drop policy if exists leases_access on public.leases;
create policy leases_access on public.leases
  for all using (auth.role() = 'service_role' or public.has_property_access(property_id))
  with check (auth.role() = 'service_role' or public.has_property_access(property_id));

drop policy if exists work_orders_access on public.work_orders;
create policy work_orders_access on public.work_orders
  for all using (
    auth.role() = 'service_role'
    or public.has_property_access(property_id)
    or contractor_user_id = public.current_profile_id()
    or created_by_user_id = public.current_profile_id()
  )
  with check (auth.role() = 'service_role' or public.has_property_access(property_id));

drop policy if exists ledger_access on public.ledger_entries;
create policy ledger_access on public.ledger_entries
  for all using (auth.role() = 'service_role' or public.has_property_access(property_id))
  with check (auth.role() = 'service_role' or public.has_property_access(property_id));

drop policy if exists documents_access on public.documents;
create policy documents_access on public.documents
  for select using (
    auth.role() = 'service_role'
    or (
      public.has_property_access(property_id)
      and (
        public.current_profile_id() in (
          select manager_id from public.properties where id = property_id
        )
        or (select role from public.memberships m
            where m.user_id = public.current_profile_id() limit 1)
           = any (visibility)
      )
    )
  );
create policy documents_write on public.documents
  for insert with check (auth.role() = 'service_role' or public.has_property_access(property_id));

drop policy if exists messages_threads_access on public.message_threads;
create policy messages_threads_access on public.message_threads
  for all using (
    auth.role() = 'service_role'
    or public.has_property_access(property_id)
    or exists (
      select 1 from public.message_participants mp
      where mp.thread_id = id and mp.user_id = public.current_profile_id()
    )
  );

drop policy if exists messages_access on public.messages;
create policy messages_access on public.messages
  for all using (
    auth.role() = 'service_role'
    or exists (
      select 1 from public.message_threads t
      where t.id = thread_id
        and (
          public.has_property_access(t.property_id)
          or exists (
            select 1 from public.message_participants mp
            where mp.thread_id = t.id and mp.user_id = public.current_profile_id()
          )
        )
    )
  );

drop policy if exists notifications_own on public.notifications;
create policy notifications_own on public.notifications
  for all using (auth.role() = 'service_role' or user_id = public.current_profile_id());

drop policy if exists activity_access on public.activity_events;
create policy activity_access on public.activity_events
  for select using (auth.role() = 'service_role' or public.has_property_access(property_id));

drop policy if exists audit_service on public.audit_logs;
create policy audit_service on public.audit_logs
  for all using (auth.role() = 'service_role');

drop policy if exists jobs_service on public.job_queue;
create policy jobs_service on public.job_queue
  for all using (auth.role() = 'service_role');

drop policy if exists automation_access on public.automation_policies;
create policy automation_access on public.automation_policies
  for all using (auth.role() = 'service_role' or public.has_property_access(property_id));

drop policy if exists payment_refs_access on public.payment_refs;
create policy payment_refs_access on public.payment_refs
  for all using (auth.role() = 'service_role' or public.has_property_access(property_id));

drop policy if exists projection_access on public.projection_assumptions;
create policy projection_access on public.projection_assumptions
  for all using (auth.role() = 'service_role' or public.has_property_access(property_id));

drop policy if exists memberships_access on public.memberships;
create policy memberships_access on public.memberships
  for select using (auth.role() = 'service_role' or user_id = public.current_profile_id());

drop policy if exists orgs_access on public.organizations;
create policy orgs_access on public.organizations
  for select using (
    auth.role() = 'service_role'
    or exists (
      select 1 from public.memberships m
      where m.org_id = id and m.user_id = public.current_profile_id()
    )
  );

drop policy if exists property_tenants_access on public.property_tenants;
create policy property_tenants_access on public.property_tenants
  for select using (auth.role() = 'service_role' or public.has_property_access(property_id));

drop policy if exists lease_tenants_access on public.lease_tenants;
create policy lease_tenants_access on public.lease_tenants
  for select using (
    auth.role() = 'service_role'
    or exists (
      select 1 from public.leases l
      where l.id = lease_id and public.has_property_access(l.property_id)
    )
  );

drop policy if exists vendors_access on public.vendors;
create policy vendors_access on public.vendors
  for select using (auth.role() = 'service_role' or true);

drop policy if exists message_participants_access on public.message_participants;
create policy message_participants_access on public.message_participants
  for select using (
    auth.role() = 'service_role'
    or user_id = public.current_profile_id()
    or exists (
      select 1 from public.message_threads t
      where t.id = thread_id and public.has_property_access(t.property_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Storage bucket for documents (Supabase Storage only; skip on plain Postgres)
-- ---------------------------------------------------------------------------
do $$
begin
  insert into storage.buckets (id, name, public)
  values ('documents', 'documents', false)
  on conflict (id) do nothing;

  execute $p$
    drop policy if exists documents_storage_read on storage.objects;
    create policy documents_storage_read on storage.objects
      for select using (
        bucket_id = 'documents'
        and (
          auth.role() = 'service_role'
          or (storage.foldername(name))[1] is not null
        )
      );
    drop policy if exists documents_storage_write on storage.objects;
    create policy documents_storage_write on storage.objects
      for insert with check (
        bucket_id = 'documents'
        and (auth.role() = 'service_role' or auth.uid() is not null)
      );
  $p$;
exception
  when undefined_table then
    raise notice 'storage schema not present — create documents bucket in Supabase dashboard';
  when undefined_object then
    raise notice 'storage objects missing — skip storage policies';
end $$;
