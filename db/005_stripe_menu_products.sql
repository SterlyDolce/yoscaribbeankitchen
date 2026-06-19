alter table public.menu_items add column if not exists stripe_product_id text;
alter table public.menu_items add column if not exists stripe_price_id text;

create index if not exists menu_items_stripe_product_id_idx on public.menu_items (stripe_product_id);
create index if not exists menu_items_stripe_price_id_idx on public.menu_items (stripe_price_id);
