alter table public.messages
add column if not exists reply_to_id uuid references public.messages(id) on delete set null;

create index if not exists messages_reply_to_id_idx
on public.messages (reply_to_id);