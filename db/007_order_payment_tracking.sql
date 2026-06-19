alter table public.orders add column if not exists payment_status text not null default 'unpaid';
alter table public.orders add column if not exists stripe_session_id text;
alter table public.orders add column if not exists stripe_payment_intent_id text;

create unique index if not exists orders_stripe_session_id_key
on public.orders (stripe_session_id)
where stripe_session_id is not null;
