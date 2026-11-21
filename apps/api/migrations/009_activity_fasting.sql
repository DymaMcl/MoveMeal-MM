-- Abordarea slabirii (dieta / exercitii / mixt), jurnalul activitatilor fizice cu caloriile arse
-- si postul intermitent (optional).

-- ------------------------------------------------------------------ abordarea slabirii

-- Doar pentru obiectivul „lose”; null = doar din alimentatie (comportamentul initial).
alter table profiles add column loss_approach text
  check (loss_approach in ('diet', 'exercise', 'mixed'));

-- ------------------------------------------------------------------ activitati

create table activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  day date not null,
  activity_id text not null check (char_length(activity_id) between 1 and 40),
  minutes int not null check (minutes between 1 and 600),
  -- Calculate pe server din MET, greutate si durata (sau introduse de utilizator).
  kcal int not null check (kcal between 0 and 5000),
  created_at timestamptz not null default now()
);
create index activity_log_user_day_idx on activity_log (user_id, day);
alter table activity_log enable row level security;
alter table activity_log force row level security;
create policy activity_log_owner on activity_log
  using (user_id = app_user_id()) with check (user_id = app_user_id());
grant select, insert, update, delete on activity_log to movemeal_app;

-- ------------------------------------------------------------------ post intermitent

create table fasting_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  plan_id text not null check (plan_id in ('12_12', '14_10', '16_8', '18_6')),
  planned_hours int not null check (planned_hours between 12 and 24),
  started_at timestamptz not null,
  ended_at timestamptz,
  check (ended_at is null or ended_at > started_at)
);
-- Cel mult un post in desfasurare pentru fiecare utilizator.
create unique index fasting_active_idx on fasting_sessions (user_id) where ended_at is null;
create index fasting_user_idx on fasting_sessions (user_id, started_at desc);
alter table fasting_sessions enable row level security;
alter table fasting_sessions force row level security;
create policy fasting_sessions_owner on fasting_sessions
  using (user_id = app_user_id()) with check (user_id = app_user_id());
grant select, insert, update, delete on fasting_sessions to movemeal_app;
