-- Roluri (utilizator, nutritionist, administrator), programari la nutritionist,
-- acordul de acces al nutritionistului, notificari si jurnalul administratorului.

-- ------------------------------------------------------------------ conturi

alter table users
  add column role text not null default 'user' check (role in ('user', 'nutritionist', 'admin')),
  add column blocked_at timestamptz,
  add column blocked_reason text check (char_length(blocked_reason) <= 300);

-- Parametrii sistemului, modificati de administrator (doar rolul proprietar are acces).
create table system_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into system_settings (key, value) values ('free_consultation_days', '30');

-- Jurnalul actiunilor administrative (doar rolul proprietar are acces).
create table admin_log (
  id bigint generated always as identity primary key,
  admin_id uuid references users (id) on delete set null,
  action text not null,
  target_user_id uuid references users (id) on delete set null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index admin_log_created_idx on admin_log (created_at desc);

-- ------------------------------------------------------------------ nutritionist

create table nutritionist_profiles (
  user_id uuid primary key references users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 80),
  title text not null default '' check (char_length(title) <= 120),
  bio text not null default '' check (char_length(bio) <= 2000),
  qualifications text not null default '' check (char_length(qualifications) <= 1000),
  experience_years int not null default 0 check (experience_years between 0 and 60),
  services text not null default '' check (char_length(services) <= 1000),
  price_mdl int not null default 0 check (price_mdl between 0 and 100000),
  slot_minutes int not null default 45 check (slot_minutes in (30, 45, 60, 90)),
  updated_at timestamptz not null default now()
);

-- Programul saptamanal: 0 = luni … 6 = duminica, ora locala (Europe/Chisinau).
create table nutritionist_hours (
  nutritionist_id uuid not null references users (id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  primary key (nutritionist_id, weekday, start_time),
  check (end_time > start_time)
);

create table nutritionist_days_off (
  nutritionist_id uuid not null references users (id) on delete cascade,
  day date not null,
  primary key (nutritionist_id, day)
);

create table appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  nutritionist_id uuid not null references users (id) on delete cascade,
  starts_at timestamptz not null,
  duration_min int not null check (duration_min between 15 and 180),
  status text not null default 'requested'
    check (status in ('requested', 'confirmed', 'rejected', 'cancelled')),
  free boolean not null default false,
  -- Numele trimis de utilizator odata cu solicitarea (nutritionistul nu vede profilul fara acord).
  client_name text not null check (char_length(client_name) between 1 and 60),
  user_note text not null default '' check (char_length(user_note) <= 500),
  nutritionist_note text not null default '' check (char_length(nutritionist_note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Un interval al nutritionistului poate fi ocupat de o singura programare activa.
create unique index appointments_slot_idx on appointments (nutritionist_id, starts_at)
  where status in ('requested', 'confirmed');
create index appointments_user_idx on appointments (user_id, starts_at desc);

-- Acordul utilizatorului ca nutritionistul sa ii vada planul si progresul (randul exista = acord dat).
create table nutritionist_access (
  user_id uuid not null references users (id) on delete cascade,
  nutritionist_id uuid not null references users (id) on delete cascade,
  granted_at timestamptz not null default now(),
  primary key (user_id, nutritionist_id)
);

-- Ajustarea facuta de nutritionist apare marcata in contul utilizatorului.
alter table profiles
  add column calorie_target_by text check (calorie_target_by in ('adjustment', 'nutritionist')),
  add column nutritionist_note text check (char_length(nutritionist_note) <= 1000),
  add column nutritionist_adjusted_at timestamptz;
update profiles set calorie_target_by = 'adjustment' where calorie_target is not null;
alter table nutrition_programs add column nutritionist_adjusted_at timestamptz;

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_user_idx on notifications (user_id, created_at desc);

-- ------------------------------------------------------------------ functii

-- Nutritionistul curent (app_user_id) are acordul utilizatorului dat.
-- Ruleaza cu drepturile proprietarului, pentru a putea citi rolul din tabela users.
create function nutritionist_can_view(client uuid) returns boolean
  language sql stable security definer set search_path = public
  as $$
    select exists (
      select 1
      from nutritionist_access a
      join users u on u.id = a.nutritionist_id
      where a.user_id = client
        and a.nutritionist_id = app_user_id()
        and u.role = 'nutritionist'
        and u.blocked_at is null
    )
  $$;

-- Intervalele ocupate ale unui nutritionist (fara date despre utilizatori), pentru calendarul liber.
create function nutritionist_busy(nid uuid, from_ts timestamptz, to_ts timestamptz)
  returns table (starts_at timestamptz, duration_min int)
  language sql stable security definer set search_path = public
  as $$
    select a.starts_at, a.duration_min
    from appointments a
    where a.nutritionist_id = nid
      and a.status in ('requested', 'confirmed')
      and a.starts_at < to_ts
      and a.starts_at + make_interval(mins => a.duration_min) > from_ts
  $$;

-- ------------------------------------------------------------------ RLS

alter table nutritionist_profiles enable row level security;
alter table nutritionist_profiles force row level security;
create policy nutritionist_profiles_read on nutritionist_profiles for select using (true);
create policy nutritionist_profiles_owner on nutritionist_profiles
  using (user_id = app_user_id()) with check (user_id = app_user_id());

alter table nutritionist_hours enable row level security;
alter table nutritionist_hours force row level security;
create policy nutritionist_hours_read on nutritionist_hours for select using (true);
create policy nutritionist_hours_owner on nutritionist_hours
  using (nutritionist_id = app_user_id()) with check (nutritionist_id = app_user_id());

alter table nutritionist_days_off enable row level security;
alter table nutritionist_days_off force row level security;
create policy nutritionist_days_off_read on nutritionist_days_off for select using (true);
create policy nutritionist_days_off_owner on nutritionist_days_off
  using (nutritionist_id = app_user_id()) with check (nutritionist_id = app_user_id());

-- Programarea este vazuta de utilizatorul care a facut-o si de nutritionistul ei.
-- Fara "force": functia nutritionist_busy (proprietar) vede toate intervalele ocupate.
alter table appointments enable row level security;
create policy appointments_parties on appointments
  using (user_id = app_user_id() or nutritionist_id = app_user_id())
  with check (user_id = app_user_id() or nutritionist_id = app_user_id());

alter table nutritionist_access enable row level security;
alter table nutritionist_access force row level security;
create policy nutritionist_access_user on nutritionist_access
  using (user_id = app_user_id()) with check (user_id = app_user_id());
create policy nutritionist_access_nutritionist on nutritionist_access for select
  using (nutritionist_id = app_user_id());

alter table notifications enable row level security;
alter table notifications force row level security;
create policy notifications_owner on notifications
  using (user_id = app_user_id()) with check (user_id = app_user_id());

-- Cu acordul utilizatorului, nutritionistul ii vede profilul, planul alimentar, jurnalul si
-- masuratorile si poate modifica tinta calorica si planul alimentar.
create policy profiles_nutritionist_read on profiles for select
  using (nutritionist_can_view(user_id));
create policy profiles_nutritionist_update on profiles for update
  using (nutritionist_can_view(user_id)) with check (nutritionist_can_view(user_id));
create policy nutrition_programs_nutritionist_read on nutrition_programs for select
  using (nutritionist_can_view(user_id));
create policy nutrition_programs_nutritionist_update on nutrition_programs for update
  using (nutritionist_can_view(user_id)) with check (nutritionist_can_view(user_id));
create policy food_log_nutritionist_read on food_log for select
  using (nutritionist_can_view(user_id));
create policy body_measurements_nutritionist_read on body_measurements for select
  using (nutritionist_can_view(user_id));

grant select, insert, update, delete on
  nutritionist_profiles, nutritionist_hours, nutritionist_days_off,
  appointments, nutritionist_access, notifications
  to movemeal_app;
grant execute on function nutritionist_can_view(uuid) to movemeal_app;
grant execute on function nutritionist_busy(uuid, timestamptz, timestamptz) to movemeal_app;
