import { NextResponse } from "next/server";
import { query } from "../../../../db";
import { requireAdmin } from "../../admin-auth";
import { parseMenuPayload, serializeMenuItem } from "../menu-admin";

export const dynamic = "force-dynamic";

export async function PATCH(request, { params }) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const { slug } = await params;
    const item = await parseMenuPayload(request, { partial: true });
    const fields = [];
    const values = [];

    const mapping = {
      accent: "accent",
      available: "available",
      category: "category",
      details: "details",
      displayOrder: "display_order",
      image: "image",
      name: "name",
      nameInCreole: "name_in_creole",
      note: "note",
      price: "price",
      slug: "slug",
      tag: "tag"
    };

    for (const [key, column] of Object.entries(mapping)) {
      if (item[key] !== undefined) {
        values.push(item[key]);
        fields.push(`${column} = $${values.length}`);
      }
    }

    if (fields.length === 0) {
      return NextResponse.json({ message: "No menu item fields were provided." }, { status: 400 });
    }

    values.push(slug);
    const result = await query(
      `update public.menu_items
       set ${fields.join(", ")}
       where slug = $${values.length}
       returning id, slug, name, name_in_creole, note, tag, accent, category, price, details, image, available, display_order, stripe_product_id, stripe_price_id`,
      values
    );

    if (!result.rows[0]) {
      return NextResponse.json({ message: "Menu item not found." }, { status: 404 });
    }

    return NextResponse.json({ item: serializeMenuItem(result.rows[0]) });
  } catch (error) {
    if (error.code === "23505") {
      return NextResponse.json({ message: "A menu item with that slug already exists." }, { status: 409 });
    }

    return NextResponse.json({ message: error.message || "Unable to update menu item." }, { status: 400 });
  }
}

export async function DELETE(request, { params }) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const { slug } = await params;
  const result = await query(
    `update public.menu_items
     set available = false
     where slug = $1
     returning id, slug, name, name_in_creole, note, tag, accent, category, price, details, image, available, display_order, stripe_product_id, stripe_price_id`,
    [slug]
  );

  if (!result.rows[0]) {
    return NextResponse.json({ message: "Menu item not found." }, { status: 404 });
  }

  return NextResponse.json({ item: serializeMenuItem(result.rows[0]) });
}
