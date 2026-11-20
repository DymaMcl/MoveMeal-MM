-- Adaugarea rapida in jurnal: produse cu cod de bare, mese salvate, calorii introduse direct
-- si descrierea mesei in cuvinte (analizata de AI).

-- Produsele ambalate. owner_id null = produs preluat din Open Food Facts (comun, scris doar de
-- server cu rolul proprietar); altfel = produs adaugat de utilizator, vizibil doar lui.
create table products (
  id uuid primary key default gen_random_uuid(),
  barcode text check (barcode ~ '^[0-9]{8,14}$'),
  owner_id uuid references users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  brand text check (char_length(brand) <= 80),
  kcal numeric(6, 1) not null check (kcal between 0 and 900),
  protein numeric(5, 1) not null check (protein between 0 and 100),
  carbs numeric(5, 1) not null check (carbs between 0 and 100),
  fat numeric(5, 1) not null check (fat between 0 and 100),
  serving_g numeric(6, 1) check (serving_g > 0 and serving_g <= 2000),
  image_url text check (char_length(image_url) <= 500),
  source text not null check (source in ('off', 'user')),
  check ((source = 'off') = (owner_id is null)),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index products_off_barcode_idx on products (barcode) where owner_id is null;
create unique index products_owner_barcode_idx on products (owner_id, barcode)
  where owner_id is not null and barcode is not null;
create index products_owner_idx on products (owner_id, updated_at desc) where owner_id is not null;

alter table products enable row level security;
alter table products force row level security;
create policy products_read on products for select
  using (owner_id is null or owner_id = app_user_id());
create policy products_insert on products for insert with check (owner_id = app_user_id());
create policy products_update on products for update
  using (owner_id = app_user_id()) with check (owner_id = app_user_id());
create policy products_delete on products for delete using (owner_id = app_user_id());
grant select, insert, update, delete on products to movemeal_app;

-- Mesele salvate („micul dejun obisnuit”), adaugate apoi in jurnal dintr-o atingere.
-- Alimentele pastreaza valorile calculate pe server cand au fost adaugate in jurnal.
create table saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 20),
  kcal numeric(7, 1) not null,
  uses int not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
create index saved_meals_user_idx on saved_meals (user_id, last_used_at desc nulls last);

alter table saved_meals enable row level security;
alter table saved_meals force row level security;
create policy saved_meals_owner on saved_meals
  using (user_id = app_user_id()) with check (user_id = app_user_id());
grant select, insert, update, delete on saved_meals to movemeal_app;

-- Sursele noi din jurnal: produs (cod de bare / produs propriu) si calorii introduse direct.
alter table food_log drop constraint food_log_source_check;
alter table food_log add constraint food_log_source_check
  check (source in ('food', 'recipe', 'photo', 'product', 'quick'));

-- Analiza AI pornita de la o descriere in cuvinte (fara fotografie).
alter table food_photos add column origin text not null default 'photo'
  check (origin in ('photo', 'text'));
