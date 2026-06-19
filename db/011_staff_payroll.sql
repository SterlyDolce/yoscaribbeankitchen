alter table public.users add column if not exists hourly_rate numeric(10, 2) not null default 0;

create table if not exists public.staff_time_entries (
  id uuid primary key default gen_random_uuid(),
  staff_user_id uuid not null references public.users(id) on delete cascade,
  clock_in_at timestamptz not null default now(),
  clock_out_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (clock_out_at is null or clock_out_at >= clock_in_at)
);

create unique index if not exists staff_time_entries_one_open_shift_idx
on public.staff_time_entries (staff_user_id)
where clock_out_at is null;

create index if not exists staff_time_entries_staff_clock_in_idx
on public.staff_time_entries (staff_user_id, clock_in_at desc);

create table if not exists public.staff_payments (
  id uuid primary key default gen_random_uuid(),
  staff_user_id uuid not null references public.users(id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  payment_method text not null default 'cash',
  period_start date,
  period_end date,
  note text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists staff_payments_staff_created_at_idx
on public.staff_payments (staff_user_id, created_at desc);
