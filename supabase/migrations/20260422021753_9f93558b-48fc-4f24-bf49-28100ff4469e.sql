create table public.onboarding_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  status text not null default 'pending',
  current_stage int not null default 1,
  stages jsonb not null default '[]'::jsonb,
  input_payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.onboarding_runs enable row level security;

create policy "users read own runs" on public.onboarding_runs
  for select to authenticated using (auth.uid() = user_id);

create policy "service role manages runs" on public.onboarding_runs
  for all to service_role using (true) with check (true);

create index onboarding_runs_user_created_idx on public.onboarding_runs (user_id, created_at desc);
create index onboarding_runs_active_idx on public.onboarding_runs (status) where status in ('pending','running');