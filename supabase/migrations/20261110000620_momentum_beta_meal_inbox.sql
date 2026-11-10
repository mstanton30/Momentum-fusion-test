create table public.momentum_beta_meal_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.momentum_beta_workspace(user_id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 4096),
  status text not null default 'pending' check (status in ('pending', 'logged', 'duplicate', 'rejected')),
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  check ((status = 'pending') = (processed_at is null))
);

alter table public.momentum_beta_meal_inbox enable row level security;
revoke all on table public.momentum_beta_meal_inbox from public, anon, authenticated, service_role;
grant select, update (status, processed_at) on table public.momentum_beta_meal_inbox to service_role;

create index momentum_beta_meal_inbox_user_idx
  on public.momentum_beta_meal_inbox (user_id, status, created_at, id);
