-- Planul alimentar, jurnalul alimentar, masuratorile, apa si ajustarile tintei calorice.

-- Tinta calorica stabilita printr-o ajustare acceptata (null = valoarea calculata din profil).
alter table profiles add column calorie_target int check (calorie_target between 1000 and 6000);

create table nutrition_programs (
  user_id uuid primary key references users (id) on delete cascade,
  preferences jsonb not null,
  plan jsonb not null,
  salt int not null default 0,
  created_at timestamptz not null default now()
);

create table food_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  day date not null,
  meal text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  source text not null check (source in ('food', 'recipe')),
  ref_id text not null,
  name text not null,
  amount numeric(7, 2) not null check (amount > 0),
  unit text not null check (unit in ('g', 'portion')),
  kcal numeric(7, 1) not null,
  protein numeric(6, 1) not null,
  carbs numeric(6, 1) not null,
  fat numeric(6, 1) not null,
  created_at timestamptz not null default now()
);
create index food_log_user_day_idx on food_log (user_id, day);

create table body_measurements (
  user_id uuid not null references users (id) on delete cascade,
  day date not null,
  weight_kg numeric(5, 1) not null check (weight_kg between 35 and 250),
  waist_cm numeric(5, 1) check (waist_cm between 40 and 250),
  primary key (user_id, day)
);

create table water_log (
  user_id uuid not null references users (id) on delete cascade,
  day date not null,
  ml int not null check (ml between 0 and 10000),
  primary key (user_id, day)
);

create table calorie_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  created_at timestamptz not null default now(),
  previous_target int not null,
  proposed_target int not null,
  weekly_change_pct numeric(5, 2) not null,
  status text not null check (status in ('accepted', 'rejected'))
);
create index calorie_adjustments_user_idx on calorie_adjustments (user_id, created_at desc);

do $$
declare t text;
begin
  foreach t in array array['nutrition_programs', 'food_log', 'body_measurements', 'water_log', 'calorie_adjustments']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format(
      'create policy %I on %I using (user_id = app_user_id()) with check (user_id = app_user_id())',
      t || '_owner', t
    );
    execute format('grant select, insert, update, delete on %I to movemeal_app', t);
  end loop;
end $$;
