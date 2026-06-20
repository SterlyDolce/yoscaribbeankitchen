alter table public.users add column if not exists account_balance numeric(10, 2) not null default 0;
alter table public.orders add column if not exists account_balance_applied numeric(10, 2) not null default 0;

alter table public.users drop constraint if exists users_account_balance_nonnegative;
alter table public.users
add constraint users_account_balance_nonnegative check (account_balance >= 0);

alter table public.orders drop constraint if exists orders_account_balance_applied_nonnegative;
alter table public.orders
add constraint orders_account_balance_applied_nonnegative check (account_balance_applied >= 0);
