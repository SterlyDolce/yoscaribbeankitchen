import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import pg from "pg";

const { Pool } = pg;
const root = process.cwd();

loadEnvFile(".env");
loadEnvFile(".env.local", { override: true });

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const databaseUrl = process.env.DATABASE_URL;
const databaseSsl = process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined;
const currency = (process.env.STRIPE_CURRENCY || "usd").toLowerCase();
const imageBaseUrl = normalizeBaseUrl(process.env.STRIPE_IMAGE_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL);

if (!databaseUrl) {
  fail("DATABASE_URL is required.");
}

if (!stripeSecretKey) {
  fail("STRIPE_SECRET_KEY is required. Add your Stripe secret key to .env.local.");
}

const pool = new Pool({ connectionString: databaseUrl, ssl: databaseSsl });

try {
  await ensureStripeColumns();
  const items = await loadMenuItems();

  if (items.length === 0) {
    console.log("No menu items found to sync.");
    process.exit(0);
  }

  for (const item of items) {
    const product = await upsertProduct(item);
    const price = await upsertPrice(item, product.id);

    await pool.query(
      `update public.menu_items
       set stripe_product_id = $1, stripe_price_id = $2
       where id = $3`,
      [product.id, price.id, item.id]
    );

    console.log(`${item.name}: ${product.id} / ${price.id}`);
  }

  console.log(`Synced ${items.length} Stripe products.`);
} finally {
  await pool.end();
}

function loadEnvFile(filename, { override = false } = {}) {
  const envPath = path.join(root, filename);
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (override || !process.env[key]) process.env[key] = value;
  }
}

async function ensureStripeColumns() {
  await pool.query("alter table public.menu_items add column if not exists stripe_product_id text");
  await pool.query("alter table public.menu_items add column if not exists stripe_price_id text");
  await pool.query("create index if not exists menu_items_stripe_product_id_idx on public.menu_items (stripe_product_id)");
  await pool.query("create index if not exists menu_items_stripe_price_id_idx on public.menu_items (stripe_price_id)");
}

async function loadMenuItems() {
  const result = await pool.query(
    `select id, slug, name, name_in_creole, note, tag, category, price, details, image, available, stripe_product_id, stripe_price_id
     from public.menu_items
     where available = true
     order by display_order asc, name asc`
  );

  return result.rows;
}

async function upsertProduct(item) {
  const productPayload = {
    active: item.available ? "true" : "false",
    description: item.details || item.note,
    "metadata[menu_item_id]": item.id,
    "metadata[slug]": item.slug,
    "metadata[category]": item.category,
    name: item.name
  };
  const imageUrl = getStripeImageUrl(item.image);

  if (imageUrl) {
    productPayload["images[0]"] = imageUrl;
  }

  if (item.stripe_product_id) {
    try {
      return await stripeRequest("POST", `/v1/products/${item.stripe_product_id}`, productPayload);
    } catch (error) {
      if (error.statusCode !== 404) throw error;
    }
  }

  return stripeRequest("POST", "/v1/products", productPayload);
}

async function upsertPrice(item, productId) {
  const unitAmount = Math.round(Number(item.price) * 100);

  if (item.stripe_price_id) {
    try {
      const currentPrice = await stripeRequest("GET", `/v1/prices/${item.stripe_price_id}`);
      if (
        currentPrice.active &&
        currentPrice.currency === currency &&
        currentPrice.unit_amount === unitAmount &&
        currentPrice.product === productId
      ) {
        return currentPrice;
      }

      await stripeRequest("POST", `/v1/prices/${item.stripe_price_id}`, { active: "false" });
    } catch (error) {
      if (error.statusCode !== 404) throw error;
    }
  }

  const newPrice = await stripeRequest("POST", "/v1/prices", {
    currency,
    "metadata[menu_item_id]": item.id,
    "metadata[slug]": item.slug,
    product: productId,
    unit_amount: String(unitAmount)
  });

  await stripeRequest("POST", `/v1/products/${productId}`, {
    default_price: newPrice.id
  });

  return newPrice;
}

async function stripeRequest(method, endpoint, payload = undefined) {
  const response = await fetch(`https://api.stripe.com${endpoint}`, {
    body: payload ? new URLSearchParams(payload) : undefined,
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    method
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data?.error?.message || `Stripe request failed: ${endpoint}`);
    error.statusCode = response.status;
    throw error;
  }

  return data;
}

function getStripeImageUrl(value) {
  if (typeof value !== "string" || !value || value.startsWith("data:")) return null;
  if (/^https?:\/\//.test(value)) return value;
  if (!imageBaseUrl || !value.startsWith("/")) return null;
  return `${imageBaseUrl}${value}`;
}

function normalizeBaseUrl(value) {
  if (!value) return "";
  return String(value).replace(/\/+$/, "");
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
