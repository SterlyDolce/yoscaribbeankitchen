create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  actor_name text,
  actor_role text,
  actor_position text,
  event_type text not null,
  from_value text,
  to_value text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists order_events_order_id_created_at_idx
on public.order_events (order_id, created_at desc);
