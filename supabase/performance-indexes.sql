-- Recommended covering indexes for foreign keys reported by the Supabase performance advisor.
create index if not exists blocks_blocked_id_idx on public.blocks(blocked_id);
create index if not exists matches_user_b_idx on public.matches(user_b);
create index if not exists messages_sender_id_idx on public.messages(sender_id);
create index if not exists reports_reported_id_idx on public.reports(reported_id);
create index if not exists reports_reporter_id_idx on public.reports(reporter_id);
create index if not exists support_messages_sender_id_idx on public.support_messages(sender_id);
create index if not exists swipes_target_id_idx on public.swipes(target_id);
