-- Blog (articole scrise de nutritionisti si administratori), comunitatea (lenta cu fotografii
-- de la utilizatori), profilul public, fotografiile salvate pe server si moderarea continutului.

-- Totalul mesei salvate din fotografie (calculat pe server), pentru postarea mesei.
alter table food_photos add column logged_total jsonb;

-- ------------------------------------------------------------------ functii comune

-- Rolul contului curent (ruleaza cu drepturile proprietarului, care poate citi tabela users).
create function app_user_role() returns text
  language sql stable security definer set search_path = public
  as $$ select role from users where id = app_user_id() and blocked_at is null $$;

-- Contul exista si nu este blocat (postarile conturilor blocate nu mai apar nimanui).
create function user_active(uid uuid) returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from users where id = uid and blocked_at is null) $$;

-- ------------------------------------------------------------------ fotografii

-- Fotografiile (micsorate pe telefon). Se pastreaza in baza de date, ca sa fie protejate de
-- aceleasi politici RLS si sa fie sterse odata cu contul.
create table media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users (id) on delete cascade,
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  data bytea not null,
  bytes int not null check (bytes between 1 and 4500000),
  created_at timestamptz not null default now()
);
create index media_owner_idx on media (owner_id, created_at desc);

-- ------------------------------------------------------------------ profil public

create table social_profiles (
  user_id uuid primary key references users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  bio text not null default '' check (char_length(bio) <= 160),
  avatar_media_id uuid references media (id) on delete set null,
  show_progress boolean not null default true,
  -- Progresul spre obiectiv, calculat de server din datele proprii (ceilalti nu au acces la ele).
  goal text check (goal in ('lose', 'gain', 'muscle', 'maintain')),
  progress_pct int check (progress_pct between 0 and 100),
  progress_kind text check (progress_kind in ('weight', 'consistency')),
  progress_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ comunitate

create table posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  media_id uuid not null references media (id) on delete cascade,
  kind text not null check (kind in ('meal', 'workout', 'running', 'cycling', 'other')),
  caption text not null default '' check (char_length(caption) <= 500),
  -- private = doar in albumul propriu; public = si in lenta comunitatii.
  visibility text not null check (visibility in ('private', 'public')),
  -- pending = asteapta verificarea unui administrator (serviciul AI nu a fost disponibil
  -- sau verificarea manuala este activata); removed = ascunsa de un administrator.
  status text not null default 'published'
    check (status in ('published', 'pending', 'removed')),
  moderation jsonb not null default '{}',
  removed_reason text check (char_length(removed_reason) <= 300),
  -- Masa din fotografiere (valori calculate pe server la salvarea in jurnal).
  food_photo_id uuid references food_photos (id) on delete set null,
  meal_dish text check (char_length(meal_dish) <= 120),
  meal_nutrients jsonb,
  like_count int not null default 0,
  save_count int not null default 0,
  report_count int not null default 0,
  created_at timestamptz not null default now()
);
create index posts_feed_idx on posts (created_at desc)
  where status = 'published' and visibility = 'public';
create index posts_user_idx on posts (user_id, created_at desc);
create index posts_moderation_idx on posts (created_at desc)
  where status = 'pending' or report_count > 0;

create table post_likes (
  user_id uuid not null references users (id) on delete cascade,
  post_id uuid not null references posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table post_saves (
  user_id uuid not null references users (id) on delete cascade,
  post_id uuid not null references posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index post_saves_user_idx on post_saves (user_id, created_at desc);

create table post_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts (id) on delete cascade,
  reporter_id uuid not null references users (id) on delete cascade,
  reason text not null
    check (reason in ('nudity', 'violence', 'spam', 'harassment', 'not_relevant', 'other')),
  note text not null default '' check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (post_id, reporter_id)
);

-- Rezultatul verificarii automate (fara imagine), pentru statisticile administratorului.
create table moderation_events (
  id bigint generated always as identity primary key,
  user_id uuid references users (id) on delete set null,
  verdict text not null check (verdict in ('approved', 'rejected', 'pending')),
  reason text,
  created_at timestamptz not null default now()
);
create index moderation_events_created_idx on moderation_events (created_at desc);

-- ------------------------------------------------------------------ blog

create table blog_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references users (id) on delete set null,
  title text not null check (char_length(title) between 5 and 140),
  summary text not null default '' check (char_length(summary) <= 300),
  body text not null check (char_length(body) between 20 and 20000),
  category text not null
    check (category in ('nutrition', 'training', 'health', 'recipes', 'motivation')),
  cover_media_id uuid references media (id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  pinned boolean not null default false,
  read_minutes int not null default 1 check (read_minutes between 1 and 120),
  like_count int not null default 0,
  view_count int not null default 0,
  save_count int not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index blog_posts_published_idx on blog_posts (pinned desc, published_at desc)
  where status = 'published';

create table blog_likes (
  user_id uuid not null references users (id) on delete cascade,
  post_id uuid not null references blog_posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

-- O vizualizare per utilizator: se afiseaza doar numarul, nu si cine a citit.
create table blog_views (
  user_id uuid not null references users (id) on delete cascade,
  post_id uuid not null references blog_posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table blog_saves (
  user_id uuid not null references users (id) on delete cascade,
  post_id uuid not null references blog_posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index blog_saves_user_idx on blog_saves (user_id, created_at desc);

-- ------------------------------------------------------------------ contoare

-- Contoarele (aprecieri, salvari, vizualizari) se actualizeaza in baza de date; functia ruleaza
-- cu drepturile proprietarului, deoarece utilizatorul nu poate modifica postarea altcuiva.
create function bump_counter() returns trigger
  language plpgsql security definer set search_path = public
  as $$
  declare
    delta int := case when tg_op = 'INSERT' then 1 else -1 end;
    post uuid := case when tg_op = 'INSERT' then new.post_id else old.post_id end;
  begin
    execute format(
      'update %I set %I = greatest(0, %I + $1) where id = $2',
      tg_argv[0], tg_argv[1], tg_argv[1]
    ) using delta, post;
    return null;
  end
  $$;

create trigger post_likes_count after insert or delete on post_likes
  for each row execute function bump_counter('posts', 'like_count');
create trigger post_saves_count after insert or delete on post_saves
  for each row execute function bump_counter('posts', 'save_count');
create trigger post_reports_count after insert or delete on post_reports
  for each row execute function bump_counter('posts', 'report_count');
create trigger blog_likes_count after insert or delete on blog_likes
  for each row execute function bump_counter('blog_posts', 'like_count');
create trigger blog_views_count after insert or delete on blog_views
  for each row execute function bump_counter('blog_posts', 'view_count');
create trigger blog_saves_count after insert or delete on blog_saves
  for each row execute function bump_counter('blog_posts', 'save_count');

-- ------------------------------------------------------------------ RLS

-- Postarea se vede de autor sau, daca este publica si publicata, de toti (autor activ).
create function post_visible(p posts) returns boolean
  language sql stable
  as $$
    select p.user_id = app_user_id()
        or (p.visibility = 'public' and p.status = 'published' and user_active(p.user_id))
  $$;

-- Fotografia se vede de proprietar sau daca apare intr-o postare / articol / profil vizibil.
create function media_visible(mid uuid) returns boolean
  language sql stable security definer set search_path = public
  as $$
    select exists (
             select 1 from posts p
             where p.media_id = mid and p.visibility = 'public' and p.status = 'published'
               and user_active(p.user_id))
        or exists (select 1 from blog_posts b where b.cover_media_id = mid and b.status = 'published')
        or exists (select 1 from social_profiles s where s.avatar_media_id = mid)
  $$;

alter table media enable row level security;
create policy media_read on media for select
  using (owner_id = app_user_id() or media_visible(id));
create policy media_owner on media
  using (owner_id = app_user_id()) with check (owner_id = app_user_id());

alter table social_profiles enable row level security;
create policy social_profiles_read on social_profiles for select using (true);
create policy social_profiles_owner on social_profiles
  using (user_id = app_user_id()) with check (user_id = app_user_id());

-- Fara "force": rolul proprietar (moderarea administratorului) vede toate postarile.
alter table posts enable row level security;
create policy posts_read on posts for select using (post_visible(posts));
create policy posts_owner on posts
  using (user_id = app_user_id()) with check (user_id = app_user_id());

do $$
declare t text;
begin
  foreach t in array array['post_likes', 'post_saves', 'blog_likes', 'blog_views', 'blog_saves']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format(
      'create policy %I on %I using (user_id = app_user_id()) with check (user_id = app_user_id())',
      t || '_owner', t
    );
  end loop;
end $$;

alter table post_reports enable row level security;
create policy post_reports_owner on post_reports
  using (reporter_id = app_user_id()) with check (reporter_id = app_user_id());

-- Articolele publicate le vede oricine; ciornele doar autorul. Doar nutritionistii si
-- administratorii pot scrie articole.
alter table blog_posts enable row level security;
create policy blog_posts_read on blog_posts for select
  using (status = 'published' or author_id = app_user_id());
create policy blog_posts_author on blog_posts
  using (author_id = app_user_id())
  with check (author_id = app_user_id() and app_user_role() in ('nutritionist', 'admin'));

grant select, insert, update, delete on
  media, social_profiles, posts, post_likes, post_saves, post_reports,
  blog_posts, blog_likes, blog_views, blog_saves
  to movemeal_app;
grant execute on function app_user_role() to movemeal_app;
grant execute on function user_active(uuid) to movemeal_app;
grant execute on function media_visible(uuid) to movemeal_app;
grant execute on function post_visible(posts) to movemeal_app;

-- ------------------------------------------------------------------ parametri

insert into system_settings (key, value) values
  ('ai_chat_daily', '60'),
  ('ai_photo_daily', '15'),
  ('community_enabled', 'true'),
  -- true = postarile publice apar in lenta doar dupa aprobarea unui administrator.
  ('community_premoderation', 'false'),
  ('posts_daily', '10')
on conflict (key) do nothing;

-- Rolul unui cont (insigna „Nutritionist” / „Administrator” langa nume); nu dezvaluie alte date.
create function public_role(uid uuid) returns text
  language sql stable security definer set search_path = public
  as $$ select role from users where id = uid $$;
grant execute on function public_role(uuid) to movemeal_app;
