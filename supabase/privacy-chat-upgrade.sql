-- Run after supabase/schema.sql on an existing/fresh Cosplay Match project.
-- Adds sender deletion, recipient view-once media, and transparent platform-support messaging.

alter table public.messages add column if not exists view_once boolean not null default false;
alter table public.messages add column if not exists viewed_at timestamptz;

create table if not exists public.support_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.support_threads(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_role text not null check (sender_role in ('user','admin')),
  body text not null check (char_length(btrim(body)) between 1 and 3000),
  created_at timestamptz not null default now()
);

create index if not exists support_messages_thread_created_idx on public.support_messages(thread_id,created_at);

create or replace function public.ensure_support_thread()
returns trigger language plpgsql set search_path = '' as $$
begin
  insert into public.support_threads(user_id) values(new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_create_support_thread on public.profiles;
create trigger profiles_create_support_thread after insert on public.profiles
for each row execute function public.ensure_support_thread();

insert into public.support_threads(user_id)
select id from public.profiles
on conflict (user_id) do nothing;

alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;

drop policy if exists "senders delete own messages" on public.messages;
create policy "senders delete own messages" on public.messages for delete to authenticated
using (sender_id = (select auth.uid()));

drop policy if exists "users or admin read support threads" on public.support_threads;
create policy "users or admin read support threads" on public.support_threads for select to authenticated
using (user_id = (select auth.uid()) or public.is_current_user_admin());

drop policy if exists "users or admin read support messages" on public.support_messages;
create policy "users or admin read support messages" on public.support_messages for select to authenticated
using (
  exists (
    select 1 from public.support_threads t
    where t.id = thread_id
      and (t.user_id = (select auth.uid()) or public.is_current_user_admin())
  )
);

create or replace function public.is_current_user_admin()
returns boolean
language sql stable set search_path = '' as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;
revoke all on function public.is_current_user_admin() from public,anon;
grant execute on function public.is_current_user_admin() to authenticated;

create or replace function public.consume_view_once_media(target_message uuid)
returns table (media_path text, message_type text)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return query
  update public.messages msg set viewed_at=now()
  from public.matches m
  where msg.id=target_message
    and msg.match_id=m.id
    and msg.view_once=true
    and msg.viewed_at is null
    and msg.media_path is not null
    and msg.message_type in ('image','video')
    and msg.sender_id<>auth.uid()
    and (m.user_a=auth.uid() or m.user_b=auth.uid())
  returning msg.media_path,msg.message_type;
  if not found then raise exception 'View-once media is already opened or unavailable'; end if;
end;
$$;

create or replace function public.get_my_support_thread()
returns uuid language plpgsql security definer set search_path = '' as $$
declare thread_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid()) then raise exception 'Complete your profile first'; end if;
  insert into public.support_threads(user_id) values(auth.uid()) on conflict(user_id) do nothing;
  select id into thread_id from public.support_threads where user_id=auth.uid();
  return thread_id;
end;
$$;

create or replace function public.send_support_message(message_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare thread_id uuid; new_message uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if nullif(btrim(message_body),'') is null then raise exception 'Message cannot be empty'; end if;
  select public.get_my_support_thread() into thread_id;
  insert into public.support_messages(thread_id,sender_id,sender_role,body)
  values(thread_id,auth.uid(),'user',left(btrim(message_body),3000)) returning id into new_message;
  return new_message;
end;
$$;

create or replace function public.admin_directory(search_term text default null)
returns table (user_id uuid, username text, display_name text, city text, support_thread_id uuid)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_current_user_admin() then raise exception 'Admin access required'; end if;
  return query
  select p.id,p.username,p.display_name,p.city,t.id
  from public.profiles p left join public.support_threads t on t.user_id=p.id
  where search_term is null or btrim(search_term)=''
     or p.username ilike '%'||btrim(search_term)||'%'
     or p.display_name ilike '%'||btrim(search_term)||'%'
  order by p.created_at desc limit 100;
end;
$$;

create or replace function public.admin_send_support(target_user uuid, message_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare thread_id uuid; new_message uuid;
begin
  if not public.is_current_user_admin() then raise exception 'Admin access required'; end if;
  if nullif(btrim(message_body),'') is null then raise exception 'Message cannot be empty'; end if;
  if not exists(select 1 from public.profiles where id=target_user) then raise exception 'Profile not found'; end if;
  insert into public.support_threads(user_id) values(target_user) on conflict(user_id) do nothing;
  select id into thread_id from public.support_threads where user_id=target_user;
  insert into public.support_messages(thread_id,sender_id,sender_role,body)
  values(thread_id,auth.uid(),'admin',left(btrim(message_body),3000)) returning id into new_message;
  return new_message;
end;
$$;

revoke all on function public.consume_view_once_media(uuid) from public,anon;
revoke all on function public.get_my_support_thread() from public,anon;
revoke all on function public.send_support_message(text) from public,anon;
revoke all on function public.admin_directory(text) from public,anon;
revoke all on function public.admin_send_support(uuid,text) from public,anon;
grant execute on function public.consume_view_once_media(uuid) to authenticated;
grant execute on function public.get_my_support_thread() to authenticated;
grant execute on function public.send_support_message(text) to authenticated;
grant execute on function public.admin_directory(text) to authenticated;
grant execute on function public.admin_send_support(uuid,text) to authenticated;

grant select,insert,delete on public.messages to authenticated;
grant select on public.support_threads to authenticated;
grant select on public.support_messages to authenticated;

drop policy if exists "match participants read chat media" on storage.objects;
drop policy if exists "chat media controlled read" on storage.objects;
create policy "chat media controlled read" on storage.objects for select to authenticated using (
  bucket_id='chat-media'
  and exists(
    select 1 from public.messages msg
    join public.matches m on m.id=msg.match_id
    where msg.media_path=name
      and (
        msg.sender_id=(select auth.uid())
        or (
          (m.user_a=(select auth.uid()) or m.user_b=(select auth.uid()))
          and (msg.view_once=false or (msg.view_once=true and msg.viewed_at is null and msg.sender_id<>(select auth.uid())))
        )
      )
  )
);

drop policy if exists "chat media sender delete" on storage.objects;
create policy "chat media sender delete" on storage.objects for delete to authenticated using (
  bucket_id='chat-media' and (storage.foldername(name))[2]=(select auth.uid())::text
);

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='support_messages') then
    alter publication supabase_realtime add table public.support_messages;
  end if;
end $$;
