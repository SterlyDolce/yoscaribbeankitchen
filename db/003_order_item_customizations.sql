alter table public.order_items
add column if not exists special_instructions text;
