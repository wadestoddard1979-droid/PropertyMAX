-- AI maintenance intake classification audits (advisory only; never authorizes spend)
create table if not exists public.intake_audits (
  id text primary key,
  property_id text not null references public.properties (id) on delete cascade,
  work_order_id text references public.work_orders (id) on delete set null,
  actor_user_id text not null references public.profiles (id),
  answers jsonb not null,
  classification jsonb not null,
  trace jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.intake_audits enable row level security;

drop policy if exists intake_audits_access on public.intake_audits;
create policy intake_audits_access on public.intake_audits
  for all using (
    auth.role() = 'service_role'
    or public.has_property_access(property_id)
    or actor_user_id = public.current_profile_id()
  );

alter table public.work_orders
  add column if not exists intake_audit_id text,
  add column if not exists emergency_flag boolean not null default false;
