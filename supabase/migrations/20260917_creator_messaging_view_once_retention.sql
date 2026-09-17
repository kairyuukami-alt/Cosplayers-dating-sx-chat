-- Creator/support messaging, user deletion, view-once media, moderation audit,
-- and temporary media-backup tracking.
-- Apply after supabase/schema.sql.

alter table public.messages
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null,
  add column if not exists view_once boolean not null default false,
  add column if not exists first_viewed_at timestamptz,
  add column if not exists first_viewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists media_expires_at timestamptz;

alter table public.messages drop constraint if exists messages_check;
alter table public.messages add constraint messages_payload_check check (
  deleted_at is not null
  or (message_type = 'text' and nullif(btrim(body),'') is not null and media_path is null and view_once = false)
  or (message_type in ('image','video') and media_path is not null)
);

create table if not exists public.support_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.support_threads(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create table if not exists public.moderation_cases (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.reports(id) on delete set null,
  match_id uuid not null references public.matches(id) on delete cascade,
  opened_by uuid not null references auth.users(id) on delete restrict,
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  status text not null default 'open' check (status in ('open','closed')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists public.moderation_access_log (
  id bigint generated always as identity primary key,
  case_id uuid not null references public.moderation_cases(id) on delete cascade,
  moderator_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('open_case','read_messages','view_media','close_case')),
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.media_backups (
  message_id uuid primary key references public.messages(id) on delete cascade,
  drive_file_id text,
  backup_status text not null default 'pending' check (backup_status in ('pending','backed_up','delete_pending','deleted','failed')),
  backed_up_at timestamptz,
  delete_after timestamptz not null default (now() + interval '72 hours'),
  deleted_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);

alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;
alter table public.moderation_cases enable row level security;
alter table public.moderation_access_log enable row level security;
alter table public.media_backups enable row level security;

-- Ordinary users only see their own support thread/messages.
drop policy if exists "users read own support thread" on public.support_threads;
create policy "users read own support thread" on public.support_threads
for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "users read own support messages" on public.support_messages;
create policy "users read own support messages" on public.support_messages
for select to authenticated using (
  exists (select 1 from public.support_threads t where t.id = thread_id and t.user_id = (select auth.uid()))
);

drop policy if exists "users reply to support" on public.support_messages;
create policy "users reply to support" on public.support_messages
for insert to authenticated with check (
  sender_id = (select auth.uid())
  and exists (select 1 from public.support_threads t where t.id = thread_id and t.user_id = (select auth.uid()))
);

-- Senders can soft-delete their own messages. Recipients can mark view-once media as viewed.
drop policy if exists "message sender can update own message" on public.messages;
create policy "message sender can update own message" on public.messages
for update to authenticated
using (sender_id = (select auth.uid()))
with check (sender_id = (select auth.uid()));

drop policy if exists "recipient can mark view once viewed" on public.messages;
create policy "recipient can mark view once viewed" on public.messages
for update to authenticated
using (
  view_once = true
  and deleted_at is null
  and first_viewed_at is null
  and sender_id <> (select auth.uid())
  and exists (
    select 1 from public.matches m
    where m.id = match_id
      and (m.user_a = (select auth.uid()) or m.user_b = (select auth.uid()))
  )
)
with check (
  view_once = true
  and sender_id <> (select auth.uid())
  and first_viewed_by = (select auth.uid())
  and first_viewed_at is not null
);

-- Chat-media objects are not directly readable by clients anymore. Server routes issue short-lived signed URLs.
drop policy if exists "match participants read chat media" on storage.objects;

drop policy if exists "chat media sender delete own folder" on storage.objects;
create policy "chat media sender delete own folder" on storage.objects
for delete to authenticated using (
  bucket_id = 'chat-media'
  and (storage.foldername(name))[2] = (select auth.uid())::text
);

-- Enqueue every new media message for the disclosed 72-hour operational backup.
create or replace function public.enqueue_media_backup()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if new.message_type in ('image','video') and new.media_path is not null then
    insert into public.media_backups(message_id, delete_after)
    values (new.id, now() + interval '72 hours')
    on conflict (message_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists messages_enqueue_media_backup on public.messages;
create trigger messages_enqueue_media_backup
after insert on public.messages
for each row execute function public.enqueue_media_backup();

create or replace function public.soft_delete_message(target_message uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare m public.messages%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into m from public.messages where id = target_message;
  if m.id is null then raise exception 'Message not found'; end if;
  if m.sender_id <> auth.uid() then raise exception 'Only the sender can delete this message'; end if;
  update public.messages
  set body = null,
      media_path = null,
      deleted_at = now(),
      deleted_by = auth.uid()
  where id = target_message;
end;
$$;

revoke all on function public.soft_delete_message(uuid) from public;
grant execute on function public.soft_delete_message(uuid) to authenticated;

create or replace function public.consume_view_once(target_message uuid)
returns table(message_id uuid, media_path text, message_type text)
language plpgsql security definer set search_path = public as $$
declare m public.messages%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into m from public.messages where id = target_message for update;
  if m.id is null or m.deleted_at is not null then raise exception 'Media unavailable'; end if;
  if m.view_once is not true or m.message_type not in ('image','video') then raise exception 'Not view-once media'; end if;
  if m.sender_id = auth.uid() then
    return query select m.id, m.media_path, m.message_type;
    return;
  end if;
  if not exists (
    select 1 from public.matches mt
    where mt.id = m.match_id and (mt.user_a = auth.uid() or mt.user_b = auth.uid())
  ) then raise exception 'Not authorized'; end if;
  if m.first_viewed_at is not null then raise exception 'View-once media already opened'; end if;

  update public.messages
  set first_viewed_at = now(), first_viewed_by = auth.uid(), media_expires_at = now() + interval '2 minutes'
  where id = m.id;

  return query select m.id, m.media_path, m.message_type;
end;
$$;

revoke all on function public.consume_view_once(uuid) from public;
grant execute on function public.consume_view_once(uuid) to authenticated;

-- The browser cannot read moderation tables or backup metadata directly.
revoke all on public.moderation_cases, public.moderation_access_log, public.media_backups from anon, authenticated;

-- Realtime updates for support messages if not already published.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'support_messages'
  ) then
    alter publication supabase_realtime add table public.support_messages;
  end if;
end $$;
