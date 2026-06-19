alter table public.orders alter column user_id drop not null;
alter table public.orders add column if not exists guest_name text;
alter table public.orders add column if not exists guest_email text;
alter table public.orders add column if not exists guest_phone text;

create index if not exists orders_guest_email_created_at_idx on public.orders (lower(guest_email), created_at desc);
