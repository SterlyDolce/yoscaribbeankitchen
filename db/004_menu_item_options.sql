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

drop trigger if exists set_menu_item_option_groups_updated_at on public.menu_item_option_groups;
create trigger set_menu_item_option_groups_updated_at
before update on public.menu_item_option_groups
for each row execute function public.set_updated_at();

drop trigger if exists set_menu_item_options_updated_at on public.menu_item_options;
create trigger set_menu_item_options_updated_at
before update on public.menu_item_options
for each row execute function public.set_updated_at();
