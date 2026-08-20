-- Carbon Emission Monitoring & Forecasting System — initial schema
-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run.
--
-- Note: no separate "users" table is created — Supabase Auth already
-- provides auth.users, and every other table references it directly
-- via user_id uuid references auth.users(id).

-- ==========================================================
-- 1. emission_records
-- ==========================================================
create table if not exists public.emission_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  year int not null check (year >= 2000 and year <= 2100),
  electricity_emissions numeric not null check (electricity_emissions >= 0),
  transportation_emissions numeric not null check (transportation_emissions >= 0),
  waste_emissions numeric not null check (waste_emissions >= 0),
  total_emissions numeric generated always as (
    electricity_emissions + transportation_emissions + waste_emissions
  ) stored,
  created_at timestamptz not null default now(),
  unique (user_id, year)
);

create index if not exists idx_emission_records_user_id on public.emission_records(user_id);
create index if not exists idx_emission_records_year on public.emission_records(year);

-- ==========================================================
-- 2. forecast_runs
-- ==========================================================
create table if not exists public.forecast_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data_start_period int not null,
  data_end_period int not null,
  forecast_start_period int not null,
  forecast_end_period int not null,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_forecast_runs_user_id on public.forecast_runs(user_id);

-- ==========================================================
-- 3. forecast_results
-- ==========================================================
create table if not exists public.forecast_results (
  id uuid primary key default gen_random_uuid(),
  forecast_run_id uuid not null references public.forecast_runs(id) on delete cascade,
  period int not null,
  electricity_forecast numeric,
  transportation_forecast numeric,
  waste_forecast numeric,
  total_forecast numeric,
  unique (forecast_run_id, period)
);

create index if not exists idx_forecast_results_run_id on public.forecast_results(forecast_run_id);

-- ==========================================================
-- 4. forecast_metrics
-- ==========================================================
create table if not exists public.forecast_metrics (
  id uuid primary key default gen_random_uuid(),
  forecast_run_id uuid not null references public.forecast_runs(id) on delete cascade,
  emission_factor text not null check (emission_factor in ('electricity', 'transportation', 'waste')),
  mae numeric,
  rmse numeric,
  mape numeric,
  unique (forecast_run_id, emission_factor)
);

create index if not exists idx_forecast_metrics_run_id on public.forecast_metrics(forecast_run_id);

-- ==========================================================
-- 5. Row Level Security — each authenticated user only sees their own data
-- ==========================================================
alter table public.emission_records enable row level security;
alter table public.forecast_runs enable row level security;
alter table public.forecast_results enable row level security;
alter table public.forecast_metrics enable row level security;

-- emission_records: direct user_id check
create policy "Users manage their own emission records"
  on public.emission_records
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- forecast_runs: direct user_id check
create policy "Users manage their own forecast runs"
  on public.forecast_runs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- forecast_results: check ownership via the parent forecast_run
create policy "Users manage results for their own forecast runs"
  on public.forecast_results
  for all
  using (
    exists (
      select 1 from public.forecast_runs
      where forecast_runs.id = forecast_results.forecast_run_id
        and forecast_runs.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.forecast_runs
      where forecast_runs.id = forecast_results.forecast_run_id
        and forecast_runs.user_id = auth.uid()
    )
  );

-- forecast_metrics: check ownership via the parent forecast_run
create policy "Users manage metrics for their own forecast runs"
  on public.forecast_metrics
  for all
  using (
    exists (
      select 1 from public.forecast_runs
      where forecast_runs.id = forecast_metrics.forecast_run_id
        and forecast_runs.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.forecast_runs
      where forecast_runs.id = forecast_metrics.forecast_run_id
        and forecast_runs.user_id = auth.uid()
    )
  );
