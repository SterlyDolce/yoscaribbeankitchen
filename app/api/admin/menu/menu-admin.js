import fs from "node:fs/promises";
import path from "node:path";

const maxImageBytes = 2 * 1024 * 1024;

export function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeBoolean(value, fallback = true) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return ["true", "1", "yes", "on"].includes(String(value).toLowerCase());
}

export function normalizeNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function serializeMenuItem(row) {
  return {
    accent: row.accent,
    available: row.available,
    category: row.category,
    details: row.details,
    displayOrder: row.display_order,
    id: row.id,
    image: row.image,
    name: row.name,
    nameInCreole: row.name_in_creole,
    note: row.note,
    price: Number(row.price),
    slug: row.slug,
    stripePriceId: row.stripe_price_id,
    stripeProductId: row.stripe_product_id,
    tag: row.tag
  };
}

export async function parseMenuPayload(request, { partial = false } = {}) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const payload = Object.fromEntries(formData.entries());
    const imageFile = formData.get("imageFile");

    if (imageFile && typeof imageFile.arrayBuffer === "function" && imageFile.size > 0) {
      if (!imageFile.type.startsWith("image/")) {
        throw new Error("Uploaded file must be an image.");
      }

      if (imageFile.size > maxImageBytes) {
        throw new Error("Image must be 2 MB or smaller.");
      }

      const buffer = Buffer.from(await imageFile.arrayBuffer());
      payload.image = await saveMenuImage(imageFile, buffer, payload);
    }

    return normalizeMenuPayload(payload, { partial });
  }

  return normalizeMenuPayload(await request.json(), { partial });
}

async function saveMenuImage(imageFile, buffer, payload) {
  const slug = slugify(payload.slug || payload.name || "menu-item");
  const extension = getImageExtension(imageFile.type);
  const fileName = `${slug}-${Date.now()}.${extension}`;
  const directory = path.join(process.cwd(), "public", "menu-images");

  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, fileName), buffer);

  return `/menu-images/${fileName}`;
}

function getImageExtension(contentType) {
  const subtype = String(contentType || "").split("/")[1] || "png";
  return subtype.replace("jpeg", "jpg").replace(/[^a-z0-9]/gi, "") || "png";
}

function normalizeMenuPayload(payload, { partial }) {
  const normalized = {};

  if (payload.name !== undefined) normalized.name = String(payload.name).trim();
  if (payload.slug !== undefined) normalized.slug = slugify(payload.slug);
  if (!normalized.slug && normalized.name) normalized.slug = slugify(normalized.name);
  if (payload.nameInCreole !== undefined) normalized.nameInCreole = String(payload.nameInCreole).trim();
  if (payload.name_in_creole !== undefined) normalized.nameInCreole = String(payload.name_in_creole).trim();
  if (payload.note !== undefined) normalized.note = String(payload.note).trim();
  if (payload.tag !== undefined) normalized.tag = String(payload.tag).trim();
  if (payload.accent !== undefined) normalized.accent = String(payload.accent).trim();
  if (payload.category !== undefined) normalized.category = String(payload.category).trim();
  if (payload.price !== undefined) normalized.price = normalizeNumber(payload.price);
  if (payload.details !== undefined) normalized.details = String(payload.details).trim();
  if (payload.image !== undefined) normalized.image = String(payload.image).trim();
  if (payload.available !== undefined) normalized.available = normalizeBoolean(payload.available);
  if (payload.displayOrder !== undefined) normalized.displayOrder = normalizeNumber(payload.displayOrder);
  if (payload.display_order !== undefined) normalized.displayOrder = normalizeNumber(payload.display_order);

  if (!partial) {
    const missing = [
      "slug",
      "name",
      "nameInCreole",
      "note",
      "tag",
      "accent",
      "category",
      "price",
      "details",
      "displayOrder"
    ].filter((key) => normalized[key] === undefined || normalized[key] === "");

    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(", ")}`);
    }

    if (normalized.available === undefined) normalized.available = true;
    if (!normalized.image) normalized.image = "/yos-logo.png";
  }

  return normalized;
}
