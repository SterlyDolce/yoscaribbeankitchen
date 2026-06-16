create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  password_hash text,
  role text not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users add column if not exists password_hash text;
alter table public.users add column if not exists role text not null default 'customer';
alter table public.users add column if not exists address_line1 text;
alter table public.users add column if not exists address_line2 text;
alter table public.users add column if not exists city text;
alter table public.users add column if not exists state text;
alter table public.users add column if not exists postal_code text;
alter table public.users add column if not exists delivery_notes text;

create unique index if not exists users_email_lower_key on public.users (lower(email));

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  name_in_creole text not null,
  note text not null,
  tag text not null,
  accent text not null,
  category text not null,
  price numeric(10, 2) not null check (price >= 0),
  details text not null,
  image text,
  available boolean not null default true,
  display_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.menu_items add column if not exists image text;

create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists user_sessions_user_id_idx on public.user_sessions (user_id);
create index if not exists user_sessions_expires_at_idx on public.user_sessions (expires_at);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  fulfillment_method text not null,
  payment_preference text not null,
  delivery_address text,
  status text not null default 'requested',
  subtotal numeric(10, 2) not null check (subtotal >= 0),
  tax numeric(10, 2) not null check (tax >= 0),
  total numeric(10, 2) not null check (total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orders add column if not exists delivery_address text;

create index if not exists orders_user_id_created_at_idx on public.orders (user_id, created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id),
  menu_item_slug text not null,
  item_name text not null,
  special_instructions text,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  line_total numeric(10, 2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create index if not exists order_items_order_id_idx on public.order_items (order_id);

alter table public.order_items add column if not exists special_instructions text;

create table if not exists public.menu_item_option_groups (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  slug text not null,
  name text not null,
  min_selections integer not null default 0 check (min_selections >= 0),
  max_selections integer not null default 1 check (max_selections > 0),
  display_order integer not null default 0,
  available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (menu_item_id, slug),
  check (max_selections >= min_selections)
);

create table if not exists public.menu_item_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.menu_item_option_groups(id) on delete cascade,
  slug text not null,
  name text not null,
  price_adjustment numeric(10, 2) not null default 0,
  display_order integer not null default 0,
  available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, slug)
);

create index if not exists menu_item_option_groups_menu_item_idx
on public.menu_item_option_groups (menu_item_id, display_order);

create index if not exists menu_item_options_group_idx
on public.menu_item_options (group_id, display_order);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists set_menu_items_updated_at on public.menu_items;
create trigger set_menu_items_updated_at
before update on public.menu_items
for each row execute function public.set_updated_at();

drop trigger if exists set_orders_updated_at on public.orders;
create trigger set_orders_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

drop trigger if exists set_menu_item_option_groups_updated_at on public.menu_item_option_groups;
create trigger set_menu_item_option_groups_updated_at
before update on public.menu_item_option_groups
for each row execute function public.set_updated_at();

drop trigger if exists set_menu_item_options_updated_at on public.menu_item_options;
create trigger set_menu_item_options_updated_at
before update on public.menu_item_options
for each row execute function public.set_updated_at();

insert into public.menu_items (
  slug,
  name,
  name_in_creole,
  note,
  tag,
  accent,
  category,
  price,
  details,
  image,
  available,
  display_order
)
values
  (
    'haitian-patty',
    'Haitian Patty',
    'Pate Kode',
    'Golden Haitian-style pastry with a savory filling.',
    'Signature bite',
    'Crisp, flaky, ready to share',
    'appetizer',
    4.50,
    'Savory pastry made for a quick bite, a side, or a tray once larger orders open.',
    '/pate.png',
    true,
    1
  ),
  (
    'soup-joumou',
    'Soup Joumou',
    'Soup Joumou',
    'Comforting squash soup with deep Caribbean flavor.',
    'Current special',
    'Warm, rich, deeply seasoned',
    'soup',
    9.00,
    'A rich Caribbean comfort soup with deep squash flavor and a celebratory feel.',
    '/soup-joumou.png',
    true,
    2
  ),
  (
    'griot',
    'Griot',
    'Griyo',
    'Tender fried pork with bold Haitian spices.',
    'Customer favorite',
    'Crispy, tender, boldly seasoned',
    'main',
    15.00,
    'A classic Haitian dish of marinated pork shoulder that''s fried to perfection, offering a crispy exterior and tender interior.',
    '/griot.png',
    true,
    3
  ),
  (
    'rice-and-beans',
    'Rice and Beans',
    'Diri Kole',
    'Classic Haitian side dish with vibrant flavors.',
    'Popular side',
    'Hearty, flavorful, essential',
    'side',
    6.00,
    'A beloved Haitian side dish of rice and beans cooked together with aromatic seasonings.',
    '/rice-and-beans.png',
    true,
    4
  ),
  (
    'white-rice',
    'White Rice',
    'Diri Blan',
    'Fluffy white rice, a versatile staple.',
    'Simple side',
    'Light, fluffy, adaptable',
    'side',
    4.00,
    'A simple yet essential side of fluffy white rice, perfect for pairing with any main dish.',
    '/white-rice.png',
    true,
    5
  ),
  (
    'black-beans',
    'Black Beans',
    'Pwa Nwa',
    'Rich and hearty black beans, a Haitian staple.',
    'Classic side',
    'Thick, flavorful, comforting',
    'side',
    5.00,
    'A hearty side of black beans cooked with traditional Haitian seasonings for a rich and comforting flavor.',
    '/black-beans.png',
    true,
    6
  ),
  (
    'banan-peze',
    'Banan Peze',
    'Bannann Peze',
    'Crispy fried plantains with a savory twist.',
    'Tasty treat',
    'Crisp, savory, addictive',
    'side',
    5.00,
    'Twice-fried Haitian plantains that are crispy on the outside and soft on the inside.',
    '/plantain.png',
    true,
    7
  )
on conflict (slug) do update set
  name = excluded.name,
  name_in_creole = excluded.name_in_creole,
  note = excluded.note,
  tag = excluded.tag,
  accent = excluded.accent,
  category = excluded.category,
  price = excluded.price,
  details = excluded.details,
  image = coalesce(public.menu_items.image, excluded.image),
  available = public.menu_items.available,
  display_order = excluded.display_order,
  updated_at = now();
