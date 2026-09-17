-- Cosplay Match complete schema. Run in the Supabase SQL editor on a fresh project.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null check (char_length(display_name) between 1 and 50),
  date_of_birth date not null,
  gender text not null check (gender in ('man','woman')),
  interested_in text not null check (interested_in in ('man','woman')),
  city text,
  bio text check (char_length(coalesce(bio,'')) <= 500),
  avatar_path text,
  cosplay_characters text[] not null default '{}',
  fandoms text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.enforce_adult_profile()
returns trigger language plpgsql as $$
begin
  if new.date_of_birth > (current_date - interval '18 years')::date then
    raise exception 'Users must be at least 18 years old';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_adult_gate on public.profiles;
create trigger profiles_adult_gate before insert or update of date_of_birth on public.profiles
for each row execute function public.enforce_adult_profile();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles
for each row execute function public.touch_updated_at();

create table if not exists public.swipes (
  swiper_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  decision text not null check (decision in ('like','pass')),
  created_at timestamptz not null default now(),
  primary key (swiper_id,target_id),
  check (swiper_id <> target_id)
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_a,user_b),
  check (user_a <> user_b)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text check (char_length(coalesce(body,'')) <= 2000),
  message_type text not null default 'text' check (message_type in ('text','image','video')),
  media_path text,
  created_at timestamptz not null default now(),
  check (
    (message_type = 'text' and nullif(btrim(body),'') is not null and media_path is null)
    or (message_type in ('image','video') and media_path is not null)
  )
);

create index if not exists messages_match_created_idx on public.messages(match_id,created_at);

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id,blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('inappropriate_behavior','harassment','spam','fake_profile','underage_concern','other')),
  details text check (char_length(coalesce(details,'')) <= 1000),
  created_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open','reviewing','closed')),
  check (reporter_id <> reported_id)
);

alter table public.profiles enable row level security;
alter table public.swipes enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;

drop policy if exists "profiles readable by authenticated users" on public.profiles;
drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile" on public.profiles for select to authenticated using (auth.uid() = id);

drop policy if exists "users insert own profile" on public.profiles;
create policy "users insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "users read own swipes" on public.swipes;
create policy "users read own swipes" on public.swipes for select to authenticated using (auth.uid() = swiper_id);

drop policy if exists "participants read matches" on public.matches;
create policy "participants read matches" on public.matches for select to authenticated using (auth.uid() = user_a or auth.uid() = user_b);

drop policy if exists "participants read messages" on public.messages;
create policy "participants read messages" on public.messages for select to authenticated using (
  exists (select 1 from public.matches m where m.id = match_id and (m.user_a = auth.uid() or m.user_b = auth.uid()))
);

drop policy if exists "participants send messages" on public.messages;
create policy "participants send messages" on public.messages for insert to authenticated with check (
  sender_id = auth.uid() and exists (
    select 1 from public.matches m where m.id = match_id and (m.user_a = auth.uid() or m.user_b = auth.uid())
  )
);

drop policy if exists "users read own blocks" on public.blocks;
create policy "users read own blocks" on public.blocks for select to authenticated using (blocker_id = auth.uid());

drop policy if exists "users read own reports" on public.reports;
create policy "users read own reports" on public.reports for select to authenticated using (reporter_id = auth.uid());

create or replace function public.discover_profiles(limit_count integer default 25)
returns table (
  id uuid, username text, display_name text, age integer, gender text, city text, bio text,
  avatar_path text, cosplay_characters text[], fandoms text[]
)
language sql security definer set search_path = public as $$
  with me as (select * from public.profiles where profiles.id = auth.uid())
  select p.id, p.username, p.display_name,
    extract(year from age(current_date, p.date_of_birth))::integer,
    p.gender, p.city, p.bio, p.avatar_path, p.cosplay_characters, p.fandoms
  from public.profiles p, me
  where p.id <> auth.uid()
    and p.gender = me.interested_in
    and p.interested_in = me.gender
    and not exists (select 1 from public.swipes s where s.swiper_id = auth.uid() and s.target_id = p.id)
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = auth.uid())
    )
  order by random()
  limit greatest(1, least(coalesce(limit_count,25),50));
$$;

create or replace function public.swipe_profile(target_user uuid, swipe_decision text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me public.profiles%rowtype;
  target public.profiles%rowtype;
  a uuid;
  b uuid;
  match_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if swipe_decision not in ('like','pass') then raise exception 'Invalid swipe decision'; end if;
  if target_user = auth.uid() then raise exception 'Cannot swipe yourself'; end if;
  if exists (
    select 1 from public.blocks
    where (blocker_id = auth.uid() and blocked_id = target_user)
       or (blocker_id = target_user and blocked_id = auth.uid())
  ) then raise exception 'Profile unavailable'; end if;

  select * into me from public.profiles where id = auth.uid();
  select * into target from public.profiles where id = target_user;
  if me.id is null or target.id is null then raise exception 'Profile not found'; end if;
  if target.gender <> me.interested_in or target.interested_in <> me.gender then raise exception 'Profile is outside mutual dating preferences'; end if;

  insert into public.swipes(swiper_id,target_id,decision)
  values(auth.uid(),target_user,swipe_decision)
  on conflict (swiper_id,target_id) do update set decision = excluded.decision, created_at = now();

  if swipe_decision = 'like' and exists (
    select 1 from public.swipes where swiper_id = target_user and target_id = auth.uid() and decision = 'like'
  ) then
    if auth.uid() < target_user then a := auth.uid(); b := target_user; else a := target_user; b := auth.uid(); end if;
    insert into public.matches(user_a,user_b) values(a,b)
    on conflict (user_a,user_b) do nothing returning id into match_id;
    if match_id is null then select id into match_id from public.matches where user_a = a and user_b = b; end if;
    return match_id;
  end if;
  return null;
end;
$$;

create or replace function public.my_matches()
returns table (
  match_id uuid, other_user_id uuid, username text, display_name text, age integer, city text,
  bio text, avatar_path text, cosplay_characters text[], fandoms text[], matched_at timestamptz
)
language sql security definer set search_path = public as $$
  select m.id, p.id, p.username, p.display_name,
    extract(year from age(current_date,p.date_of_birth))::integer,
    p.city, p.bio, p.avatar_path, p.cosplay_characters, p.fandoms, m.created_at
  from public.matches m
  join public.profiles p on p.id = case when m.user_a = auth.uid() then m.user_b else m.user_a end
  where m.user_a = auth.uid() or m.user_b = auth.uid()
  order by m.created_at desc;
$$;

create or replace function public.get_match_context(target_match uuid)
returns table (match_id uuid, other_user_id uuid, username text, display_name text, avatar_path text)
language sql security definer set search_path = public as $$
  select m.id, p.id, p.username, p.display_name, p.avatar_path
  from public.matches m
  join public.profiles p on p.id = case when m.user_a = auth.uid() then m.user_b else m.user_a end
  where m.id = target_match and (m.user_a = auth.uid() or m.user_b = auth.uid());
$$;

create or replace function public.block_user(blocked_user uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if blocked_user = auth.uid() then raise exception 'Cannot block yourself'; end if;
  if not exists (select 1 from public.profiles where id = blocked_user) then raise exception 'Profile not found'; end if;

  insert into public.blocks(blocker_id,blocked_id) values(auth.uid(),blocked_user)
  on conflict (blocker_id,blocked_id) do nothing;

  delete from public.matches
  where (user_a = auth.uid() and user_b = blocked_user)
     or (user_a = blocked_user and user_b = auth.uid());

  delete from public.swipes
  where (swiper_id = auth.uid() and target_id = blocked_user)
     or (swiper_id = blocked_user and target_id = auth.uid());
end;
$$;

create or replace function public.report_user(reported_user uuid, report_reason text, report_details text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare report_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if reported_user = auth.uid() then raise exception 'Cannot report yourself'; end if;
  if report_reason not in ('inappropriate_behavior','harassment','spam','fake_profile','underage_concern','other') then raise exception 'Invalid report reason'; end if;
  insert into public.reports(reporter_id,reported_id,reason,details)
  values(auth.uid(),reported_user,report_reason,left(coalesce(report_details,''),1000))
  returning id into report_id;
  return report_id;
end;
$$;

grant execute on function public.discover_profiles(integer) to authenticated;
grant execute on function public.swipe_profile(uuid,text) to authenticated;
grant execute on function public.my_matches() to authenticated;
grant execute on function public.get_match_context(uuid) to authenticated;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.report_user(uuid,text,text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-media','profile-media',false,8388608,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = false, file_size_limit = 8388608;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-media','chat-media',false,26214400,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public = false, file_size_limit = 26214400;

drop policy if exists "profile media upload own folder" on storage.objects;
create policy "profile media upload own folder" on storage.objects for insert to authenticated with check (
  bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "authenticated can read profile media" on storage.objects;
create policy "authenticated can read profile media" on storage.objects for select to authenticated using (bucket_id = 'profile-media');

drop policy if exists "profile media owner delete" on storage.objects;
create policy "profile media owner delete" on storage.objects for delete to authenticated using (
  bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "match participants upload chat media" on storage.objects;
create policy "match participants upload chat media" on storage.objects for insert to authenticated with check (
  bucket_id = 'chat-media'
  and (storage.foldername(name))[2] = auth.uid()::text
  and exists (
    select 1 from public.matches m
    where m.id::text = (storage.foldername(name))[1]
      and (m.user_a = auth.uid() or m.user_b = auth.uid())
  )
);

drop policy if exists "match participants read chat media" on storage.objects;
create policy "match participants read chat media" on storage.objects for select to authenticated using (
  bucket_id = 'chat-media'
  and exists (
    select 1 from public.matches m
    where m.id::text = (storage.foldername(name))[1]
      and (m.user_a = auth.uid() or m.user_b = auth.uid())
  )
);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
