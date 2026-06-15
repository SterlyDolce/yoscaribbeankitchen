import { hasDatabaseConfig, query } from "./db";

function normalizeMenuItem(item) {
  return {
    accent: item.accent,
    available: item.available,
    category: item.category,
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

export async function getMenuItems() {
  if (!hasDatabaseConfig()) {
    throw new Error("DATABASE_URL is required to load menu items.");
  }

  try {
    const result = await query(
      `select slug, name, name_in_creole, note, tag, accent, category, price, details, available, image
       from public.menu_items
       where available = true
       order by display_order asc, name asc`
    );

    return result.rows.map(normalizeMenuItem);
  } catch (error) {
    console.error("Failed to load menu items from database.", error);
    throw error;
  }
}
