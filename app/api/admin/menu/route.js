import { NextResponse } from "next/server";
import { query } from "../../../db";
import { requireAdmin } from "../admin-auth";
import { parseMenuPayload, serializeMenuItem } from "./menu-admin";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const includeUnavailable = new URL(request.url).searchParams.get("includeUnavailable") === "true";
  const result = await query(
    `select id, slug, name, name_in_creole, note, tag, accent, category, price, details, image, available, display_order, stripe_product_id, stripe_price_id
     from public.menu_items
     ${includeUnavailable ? "" : "where available = true"}
     order by display_order asc, name asc`
  );

  return NextResponse.json({ items: result.rows.map(serializeMenuItem) });
}

export async function POST(request) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const item = await parseMenuPayload(request);
    const result = await query(
      `insert into public.menu_items
        (slug, name, name_in_creole, note, tag, accent, category, price, details, image, available, display_order)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       returning id, slug, name, name_in_creole, note, tag, accent, category, price, details, image, available, display_order, stripe_product_id, stripe_price_id`,
      [
        item.slug,
        item.name,
        item.nameInCreole,
        item.note,
        item.tag,
        item.accent,
        item.category,
        item.price,
        item.details,
        item.image,
        item.available,
        item.displayOrder
      ]
    );

    return NextResponse.json({ item: serializeMenuItem(result.rows[0]) }, { status: 201 });
  } catch (error) {
    if (error.code === "23505") {
      return NextResponse.json({ message: "A menu item with that slug already exists." }, { status: 409 });
    }

    return NextResponse.json({ message: error.message || "Unable to create menu item." }, { status: 400 });
  }
}
