alter table public.users add column if not exists address_line1 text;
alter table public.users add column if not exists address_line2 text;
alter table public.users add column if not exists city text;
alter table public.users add column if not exists state text;
alter table public.users add column if not exists postal_code text;
alter table public.users add column if not exists delivery_notes text;

alter table public.orders add column if not exists delivery_address text;
