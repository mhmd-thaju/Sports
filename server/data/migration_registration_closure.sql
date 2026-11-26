-- Apply once in the connected Supabase project before deploying the server change.
alter table public.events
  add column if not exists registration_open boolean not null default true;
