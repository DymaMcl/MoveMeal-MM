-- Abonari intre utilizatori, sfaturile echipei in comunitate, noutatile aplicatiei („Ce e nou?”),
-- pasii zilnici si trofeele pentru provocari.

-- ------------------------------------------------------------------ abonari

create table follows (
  follower_id uuid not null references users (id) on delete cascade,
  followee_id uuid not null references users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee_idx on follows (followee_id, created_at desc);

alter table follows enable row level security;
alter table follows force row level security;
-- Cine pe cine urmareste este vizibil utilizatorilor conectati (numarul de urmaritori din profil).
create policy follows_read on follows for select using (app_user_id() is not null);
-- Fiecare isi gestioneaza doar propriile abonari, la conturi active.
create policy follows_insert on follows for insert
  with check (follower_id = app_user_id() and user_active(followee_id));
create policy follows_delete on follows for delete using (follower_id = app_user_id());
grant select, insert, delete on follows to movemeal_app;

-- ------------------------------------------------------------------ sfaturile echipei

-- Postarile text („Sfat”) ale nutritionistilor si administratorilor nu au fotografie.
alter table posts alter column media_id drop not null;
alter table posts drop constraint posts_kind_check;
alter table posts add constraint posts_kind_check
  check (kind in ('meal', 'workout', 'running', 'cycling', 'other', 'tip'));
alter table posts add column title text check (char_length(title) <= 80);
alter table posts add constraint posts_media_check check (media_id is not null or kind = 'tip');
alter table posts add constraint posts_tip_check
  check (kind <> 'tip' or (title is not null and char_length(caption) >= 10));

-- ------------------------------------------------------------------ noutati

-- „Ce e nou?”: anunturile aplicatiei, comune tuturor (functii noi, provocari si trofee).
create table news (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('feature', 'challenge')),
  -- Textele in limbile aplicatiei: {"ro": "...", "en": "...", "ru": "..."}.
  title jsonb not null,
  body jsonb not null,
  published boolean not null default true,
  created_by uuid references users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index news_created_idx on news (created_at desc) where published;

alter table news enable row level security;
alter table news force row level security;
create policy news_read on news for select
  using (published or app_user_role() = 'admin');
create policy news_admin on news for all
  using (app_user_role() = 'admin') with check (app_user_role() = 'admin');
grant select, insert, update, delete on news to movemeal_app;

-- Pana cand a citit fiecare utilizator noutatile (pentru numarul de noutati necitite).
create table news_seen (
  user_id uuid primary key references users (id) on delete cascade,
  seen_at timestamptz not null default now()
);
alter table news_seen enable row level security;
alter table news_seen force row level security;
create policy news_seen_owner on news_seen
  using (user_id = app_user_id()) with check (user_id = app_user_id());
grant select, insert, update on news_seen to movemeal_app;

-- ------------------------------------------------------------------ pasi

create table steps_log (
  user_id uuid not null references users (id) on delete cascade,
  day date not null,
  steps int not null check (steps between 0 and 100000),
  -- manual = introdus de utilizator; device = citit din telefon.
  source text not null default 'manual' check (source in ('manual', 'device')),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table steps_log enable row level security;
alter table steps_log force row level security;
create policy steps_log_owner on steps_log
  using (user_id = app_user_id()) with check (user_id = app_user_id());
grant select, insert, update, delete on steps_log to movemeal_app;

-- ------------------------------------------------------------------ trofee

create table user_trophies (
  user_id uuid not null references users (id) on delete cascade,
  trophy_id text not null check (char_length(trophy_id) <= 40),
  awarded_at timestamptz not null default now(),
  primary key (user_id, trophy_id)
);
alter table user_trophies enable row level security;
alter table user_trophies force row level security;
-- Trofeele apar in profil, deci sunt vizibile si celorlalti utilizatori.
create policy user_trophies_read on user_trophies for select using (app_user_id() is not null);
create policy user_trophies_insert on user_trophies for insert
  with check (user_id = app_user_id());
grant select, insert on user_trophies to movemeal_app;

-- ------------------------------------------------------------------ noutatile initiale

insert into news (kind, title, body, created_at) values
(
  'feature',
  '{"ro": "Cod de bare și produse proprii", "en": "Barcodes and your own products", "ru": "Штрихкоды и свои продукты"}',
  '{"ro": "Scanează codul de bare al produselor ambalate sau adaugă produsul cu valorile de pe etichetă: AI-ul poate citi tabelul nutrițional dintr-o fotografie.", "en": "Scan the barcode of packaged products or add a product with the values from its label: AI can read the nutrition table from a photo.", "ru": "Сканируйте штрихкод упакованных продуктов или добавьте продукт со значениями с этикетки: ИИ прочитает таблицу пищевой ценности по фото."}',
  now() - interval '2 days'
),
(
  'feature',
  '{"ro": "Calcularea caloriilor din fotografie, pentru Premium", "en": "Calories from a photo, for Premium", "ru": "Калории по фото для Premium"}',
  '{"ro": "În curând: recunoașterea nelimitată a meselor din fotografie va fi disponibilă pentru utilizatorii Premium, cu analiză detaliată a fiecărui aliment.", "en": "Coming soon: unlimited meal recognition from photos will be available to Premium users, with a detailed analysis of each food.", "ru": "Скоро: безлимитное распознавание блюд по фото станет доступно пользователям Premium с подробным анализом каждого продукта."}',
  now() - interval '1 day'
),
(
  'challenge',
  '{"ro": "Trofeu nou: 3 zile câte 10 000 de pași", "en": "New trophy: 3 days of 10,000 steps", "ru": "Новый трофей: 3 дня по 10 000 шагов"}',
  '{"ro": "Fă câte 10 000 de pași trei zile la rând și primește medalia „Pas cu pas”, care va apărea în profilul tău.", "en": "Walk 10,000 steps three days in a row and earn the “Step by step” medal, shown on your profile.", "ru": "Проходите по 10 000 шагов три дня подряд и получите медаль «Шаг за шагом», которая появится в вашем профиле."}',
  now()
);
