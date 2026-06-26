create table if not exists public.staff_push_tokens (
  id uuid primary key default gen_random_uuid(),
  staff_user_id uuid not null references public.users(id) on delete cascade,
  device_push_token text not null unique,
  push_service text not null default 'native',
  platform text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.staff_push_tokens
add column if not exists device_push_token text;

alter table public.staff_push_tokens
add column if not exists push_service text not null default 'native';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'staff_push_tokens'
      and column_name = 'expo_push_token'
  ) then
    update public.staff_push_tokens
    set device_push_token = expo_push_token,
        push_service = 'expo'
    where device_push_token is null;

    alter table public.staff_push_tokens
    alter column expo_push_token drop not null;
  end if;
end $$;

alter table public.staff_push_tokens
alter column device_push_token set not null;

create unique index if not exists staff_push_tokens_device_push_token_idx
on public.staff_push_tokens (device_push_token);

create index if not exists staff_push_tokens_staff_user_id_idx
on public.staff_push_tokens (staff_user_id);
