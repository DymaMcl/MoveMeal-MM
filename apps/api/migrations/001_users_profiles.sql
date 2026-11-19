-- Conturi, sesiuni, acorduri si profilul utilizatorului.

create extension if not exists citext;

create table users (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  password_hash text not null,
  failed_logins int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  token_hash bytea not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index sessions_user_idx on sessions (user_id);

create table consents (
  user_id uuid not null references users (id) on delete cascade,
  kind text not null check (kind in ('health_data')),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (user_id, kind)
);

create table profiles (
  user_id uuid primary key references users (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  age int not null check (age between 16 and 100),
  sex text not null check (sex in ('male', 'female')),
  height_cm numeric(5, 1) not null check (height_cm between 120 and 230),
  weight_kg numeric(5, 1) not null check (weight_kg between 35 and 300),
  goal text not null check (goal in ('lose', 'gain', 'muscle', 'maintain')),
  activity_level text not null
    check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  target_weight_kg numeric(5, 1) check (target_weight_kg between 35 and 300),
  weeks int check (weeks between 1 and 104),
  updated_at timestamptz not null default now(),
  check ((goal in ('lose', 'gain')) = (target_weight_kg is not null and weeks is not null))
);

-- Utilizatorul curent este transmis de server pentru fiecare tranzactie (set_config('app.user_id', ...)).
create function app_user_id() returns uuid
  language sql stable
  as $$ select nullif(current_setting('app.user_id', true), '')::uuid $$;

-- Row Level Security: fiecare utilizator vede si modifica doar randurile proprii.
alter table profiles enable row level security;
alter table profiles force row level security;
create policy profiles_owner on profiles
  using (user_id = app_user_id())
  with check (user_id = app_user_id());

alter table consents enable row level security;
alter table consents force row level security;
create policy consents_owner on consents
  using (user_id = app_user_id())
  with check (user_id = app_user_id());

-- Rolul aplicatiei are acces doar la datele personale protejate prin RLS.
-- Tabelele users si sessions sunt folosite exclusiv de modulul de autentificare (rolul proprietar).
grant usage on schema public to movemeal_app;
grant select, insert, update, delete on profiles, consents to movemeal_app;
grant execute on function app_user_id() to movemeal_app;
