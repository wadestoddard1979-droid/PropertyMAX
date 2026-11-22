-- Phase 3 commercial tables (AppStore still primary for pilot JSON mode)

create table if not exists public.saas_subscriptions (
  id text primary key,
  org_id text not null references public.organizations (id) on delete cascade,
  plan text not null,
  status text not null,
  provider text not null default 'demo',
  external_id text,
  seats integer not null default 1,
  unit_amount_cents integer not null default 0,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.saas_invoices (
  id text primary key,
  org_id text not null references public.organizations (id) on delete cascade,
  subscription_id text references public.saas_subscriptions (id) on delete set null,
  amount_cents integer not null,
  status text not null,
  label text not null,
  demo boolean not null default true,
  issued_at timestamptz not null default now()
);

create table if not exists public.white_label_themes (
  org_id text primary key references public.organizations (id) on delete cascade,
  brand_name text not null,
  logo_text text not null,
  tagline text not null default '',
  primary_color text not null,
  accent_color text not null,
  surface_color text not null,
  mark text not null default 'PM'
);

alter table public.properties add column if not exists org_id text references public.organizations (id);
alter table public.vendors add column if not exists org_id text;
alter table public.vendors add column if not exists preferred boolean default true;
