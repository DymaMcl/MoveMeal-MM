-- Asistentul AI (Google Gemini) si recunoasterea alimentelor din fotografie.

-- Cererile catre serviciul AI, pentru limita zilnica pe utilizator.
create table ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  kind text not null check (kind in ('chat', 'photo')),
  created_at timestamptz not null default now()
);
create index ai_usage_user_idx on ai_usage (user_id, kind, created_at desc);

-- Rezultatul analizei unei fotografii. Imaginea nu se pastreaza; se salveaza doar alimentele
-- recunoscute, ca valorile adaugate in jurnal sa fie calculate pe server (nu primite de la client).
create table food_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  dish text not null check (char_length(dish) <= 120),
  items jsonb not null,
  model text not null,
  logged_at timestamptz,
  created_at timestamptz not null default now()
);
create index food_photos_user_idx on food_photos (user_id, created_at desc);

-- Inregistrarile din fotografie care nu corespund unui aliment din catalog.
alter table food_log drop constraint food_log_source_check;
alter table food_log add constraint food_log_source_check
  check (source in ('food', 'recipe', 'photo'));

do $$
declare t text;
begin
  foreach t in array array['ai_usage', 'food_photos']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format(
      'create policy %I on %I using (user_id = app_user_id()) with check (user_id = app_user_id())',
      t || '_owner', t
    );
  end loop;
end $$;

grant select, insert, delete on ai_usage to movemeal_app;
grant select, insert, update on food_photos to movemeal_app;
