import { hasDatabaseConfig, query } from "./db";

function normalizeMenuItem(item) {
  return {
    accent: item.accent,
    available: item.available,
    category: item.category,
    customizationGroups: [],
    details: item.details,
    image: item.image || "/yos-logo.png",
    name: item.name,
    nameInCreole: item.name_in_creole,
    note: item.note,
    price: Number(item.price),
    slug: item.slug,
    tag: item.tag
  };
}

async function attachCustomizationGroups(items) {
  if (items.length === 0) return items;

  let result;

  try {
    result = await query(
      `select
         g.menu_item_id,
         g.slug as group_slug,
         g.name as group_name,
         g.min_selections,
         g.max_selections,
         o.slug as option_slug,
         o.name as option_name,
         o.price_adjustment
       from public.menu_item_option_groups g
       left join public.menu_item_options o
         on o.group_id = g.id and o.available = true
       where g.available = true and g.menu_item_id = any($1::uuid[])
       order by g.display_order asc, g.name asc, o.display_order asc, o.name asc`,
      [items.map((item) => item.id)]
    );
  } catch (error) {
    if (error.code === "42P01") return items;
    throw error;
  }

  const groupsByItemId = new Map();

  for (const row of result.rows) {
    const itemGroups = groupsByItemId.get(row.menu_item_id) || [];
    let group = itemGroups.find((candidate) => candidate.id === row.group_slug);

    if (!group) {
      group = {
        id: row.group_slug,
        label: row.group_name,
        max: row.max_selections,
        min: row.min_selections,
        name: row.group_name,
        options: []
      };
      itemGroups.push(group);
      groupsByItemId.set(row.menu_item_id, itemGroups);
    }

    if (row.option_slug) {
      group.options.push({
        id: row.option_slug,
        label: row.option_name,
        priceAdjustment: Number(row.price_adjustment)
      });
    }
  }

  return items.map((item) => ({
    ...item,
    customizationGroups: groupsByItemId.get(item.id) || []
  }));
}

export async function getMenuItems() {
  if (!hasDatabaseConfig()) {
    throw new Error("DATABASE_URL is required to load menu items.");
  }

  try {
    const result = await query(
      `select id, slug, name, name_in_creole, note, tag, accent, category, price, details, available, image
       from public.menu_items
       where available = true
       order by display_order asc, name asc`
    );

    return attachCustomizationGroups(result.rows.map((row) => ({ ...normalizeMenuItem(row), id: row.id })));
  } catch (error) {
    console.error("Failed to load menu items from database.", error);
    throw error;
  }
}

export async function getMenuItem(slug) {
  if (!hasDatabaseConfig()) {
    throw new Error("DATABASE_URL is required to load menu items.");
  }

  const result = await query(
    `select id, slug, name, name_in_creole, note, tag, accent, category, price, details, available, image
     from public.menu_items
     where available = true and slug = $1
     limit 1`,
    [slug]
  );

  if (!result.rows[0]) return null;

  const [item] = await attachCustomizationGroups([
    { ...normalizeMenuItem(result.rows[0]), id: result.rows[0].id }
  ]);
  return item;
}
