-- Programul de antrenament si jurnalul exercitiilor efectuate.

create table workout_programs (
  user_id uuid primary key references users (id) on delete cascade,
  preferences jsonb not null,
  plan jsonb not null,
  created_at timestamptz not null default now()
);

create table workout_logs (
  user_id uuid not null references users (id) on delete cascade,
  day date not null,
  exercise_id text not null check (char_length(exercise_id) between 1 and 64),
  completed_at timestamptz not null default now(),
  primary key (user_id, day, exercise_id)
);

alter table workout_programs enable row level security;
alter table workout_programs force row level security;
create policy workout_programs_owner on workout_programs
  using (user_id = app_user_id())
  with check (user_id = app_user_id());

alter table workout_logs enable row level security;
alter table workout_logs force row level security;
create policy workout_logs_owner on workout_logs
  using (user_id = app_user_id())
  with check (user_id = app_user_id());

grant select, insert, update, delete on workout_programs, workout_logs to movemeal_app;
