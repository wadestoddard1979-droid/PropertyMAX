-- Phase 2: payment_refs enrichment + autopay enrollment stub
-- Cards are never stored — only provider references / status.

alter table public.payment_refs
  add column if not exists tenant_user_id text references public.profiles (id) on delete set null,
  add column if not exists month text,
  add column if not exists label text,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.autopay_enrollments (
  id text primary key,
  property_id text not null references public.properties (id) on delete cascade,
  tenant_user_id text not null references public.profiles (id) on delete cascade,
  enabled boolean not null default false,
  provider text not null default 'demo',
  day_of_month integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, tenant_user_id)
);

alter table public.autopay_enrollments enable row level security;

drop policy if exists autopay_access on public.autopay_enrollments;
create policy autopay_access on public.autopay_enrollments
  for all
  using (true)
  with check (true);
