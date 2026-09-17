-- Core profile/auth schema. Run in the Supabase SQL editor.
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

alter table public.profiles enable row level security;

drop policy if exists "profiles readable by authenticated users" on public.profiles;
create policy "profiles readable by authenticated users" on public.profiles
for select to authenticated using (true);

drop policy if exists "users insert own profile" on public.profiles;
create policy "users insert own profile" on public.profiles
for insert to authenticated with check (auth.uid() = id);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles
for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-media','profile-media',false,8388608,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = false, file_size_limit = 8388608;

drop policy if exists "profile media upload own folder" on storage.objects;
create policy "profile media upload own folder" on storage.objects
for insert to authenticated with check (
  bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "authenticated can read profile media" on storage.objects;
create policy "authenticated can read profile media" on storage.objects
for select to authenticated using (bucket_id = 'profile-media');

drop policy if exists "profile media owner delete" on storage.objects;
create policy "profile media owner delete" on storage.objects
for delete to authenticated using (
  bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text
);
