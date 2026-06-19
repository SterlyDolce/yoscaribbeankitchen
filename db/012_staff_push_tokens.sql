create table if not exists public.staff_push_tokens (
  id uuid primary key default gen_random_uuid(),
  staff_user_id uuid not null references public.users(id) on delete cascade,
  expo_push_token text not null unique,
  platform text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists staff_push_tokens_staff_user_id_idx
on public.staff_push_tokens (staff_user_id);
