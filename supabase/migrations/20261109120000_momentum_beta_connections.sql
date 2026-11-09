-- Apply to an isolated Beta project. The CREATE IF NOT EXISTS mirrors the existing
-- health table so a clean Beta project can run without copying production data.
create table if not exists public.momentum_health_samples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null,
  sample_key text not null,
  measured_at timestamptz not null,
  weight_lb numeric,
  body_fat_pct numeric,
  created_at timestamptz not null default now()
);
create unique index if not exists health_unique_sample
  on public.momentum_health_samples (user_id, source, sample_key);
create index if not exists momentum_health_samples_user_time_idx
  on public.momentum_health_samples (user_id, measured_at desc);
alter table public.momentum_health_samples enable row level security;
revoke all on public.momentum_health_samples from public, anon, authenticated;
grant select, insert on public.momentum_health_samples to authenticated;
grant all on public.momentum_health_samples to service_role;
drop policy if exists health_samples_select_own on public.momentum_health_samples;
drop policy if exists health_samples_insert_own on public.momentum_health_samples;
create policy health_samples_select_own on public.momentum_health_samples for select
  to authenticated using ((select auth.uid()) = user_id);
create policy health_samples_insert_own on public.momentum_health_samples for insert
  to authenticated with check ((select auth.uid()) = user_id);

create table public.momentum_beta_workspace (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision integer not null default 0,
  state jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
create table public.momentum_beta_health_status (
  user_id uuid primary key references auth.users(id) on delete cascade,
  synced_at timestamptz not null
);
create table public.momentum_beta_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('health','code','ai')),
  secret_hash text not null unique,
  refresh_hash text unique,
  label text not null,
  expires_at timestamptz not null,
  refresh_expires_at timestamptz,
  meta jsonb not null default '{}',
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
create index momentum_beta_credentials_owner on public.momentum_beta_credentials(user_id, kind);
alter table public.momentum_beta_workspace enable row level security;
alter table public.momentum_beta_credentials enable row level security;
alter table public.momentum_beta_health_status enable row level security;
revoke all on public.momentum_beta_workspace, public.momentum_beta_credentials, public.momentum_beta_health_status from public, anon, authenticated;
grant all on public.momentum_beta_workspace, public.momentum_beta_credentials, public.momentum_beta_health_status to service_role;

-- Store samples and update the Shortcut's last-success timestamp atomically.
create function public.momentum_beta_health_import(p_id uuid, p_hash text, p_samples jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid;
  inserted integer;
  completed timestamptz := clock_timestamp();
begin
  select user_id into owner_id from public.momentum_beta_credentials
  where id = p_id and kind = 'health' and secret_hash = p_hash and expires_at > completed
  for update;
  if owner_id is null then return null; end if;
  insert into public.momentum_health_samples(user_id, source, sample_key, measured_at, weight_lb, body_fat_pct)
  select owner_id, 'apple_health', r.sample_key, r.measured_at, r.weight_lb, r.body_fat_pct
  from jsonb_to_recordset(p_samples)
    as r(sample_key text, measured_at timestamptz, weight_lb numeric, body_fat_pct numeric)
  on conflict (user_id, source, sample_key) do nothing;
  get diagnostics inserted = row_count;
  update public.momentum_beta_credentials set last_used_at = completed where id = p_id;
  insert into public.momentum_beta_health_status (user_id,synced_at) values (owner_id,completed)
  on conflict (user_id) do update set synced_at = greatest(momentum_beta_health_status.synced_at, excluded.synced_at);
  return jsonb_build_object('inserted', inserted, 'synced_at', completed);
end $$;
revoke all on function public.momentum_beta_health_import(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.momentum_beta_health_import(uuid,text,jsonb) to service_role;
