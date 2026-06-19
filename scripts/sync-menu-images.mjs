import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import pg from "pg";

const { Pool } = pg;
const root = process.cwd();

loadEnvFile(".env");
loadEnvFile(".env.local", { override: true });

const databaseUrl = process.env.DATABASE_URL;
const databaseSsl = process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined;

if (!databaseUrl) {
  fail("DATABASE_URL is required.");
}

const pool = new Pool({ connectionString: databaseUrl, ssl: databaseSsl });
const knownImagePaths = new Map([
  ["bannann-peze", "/plantain.png"],
  ["cremasse", "/kremas.png"],
  ["haitian-patty", "/pate.png"]
]);

try {
  const items = await loadMenuItems();
  let extractedCount = 0;
  let matchedCount = 0;

  for (const item of items) {
    const knownImagePath = findPublicImageForSlug(item.slug);

    if (knownImagePath && item.image !== knownImagePath) {
      await updateMenuImage(item.id, knownImagePath);
      matchedCount += 1;
      console.log(`${item.slug}: set image to ${knownImagePath}`);
      continue;
    }

    if (isDataImage(item.image)) {
      const imagePath = await writeDataImage(item);
      await updateMenuImage(item.id, imagePath);
      extractedCount += 1;
      console.log(`${item.slug}: extracted database image to ${imagePath}`);
      continue;
    }

    if (!item.image || item.image === "/yos-logo.png") {
      const imagePath = findPublicImageForSlug(item.slug);
      if (imagePath) {
        await updateMenuImage(item.id, imagePath);
        matchedCount += 1;
        console.log(`${item.slug}: set image to ${imagePath}`);
      }
    }
  }

  console.log(`Extracted ${extractedCount} database images.`);
  console.log(`Matched ${matchedCount} existing public images.`);
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

async function loadMenuItems() {
  const result = await pool.query(
    `select id, slug, name, image
     from public.menu_items
     order by display_order asc, name asc`
  );

  return result.rows;
}

function isDataImage(value) {
  return typeof value === "string" && value.startsWith("data:image/");
}

async function writeDataImage(item) {
  const match = item.image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new Error(`Unsupported image data for ${item.slug}.`);
  }

  const extension = getImageExtension(match[1]);
  const fileName = `${slugify(item.slug || item.name)}.${extension}`;
  const directory = path.join(root, "public", "menu-images");
  const imagePath = `/menu-images/${fileName}`;

  await fsp.mkdir(directory, { recursive: true });
  await fsp.writeFile(path.join(directory, fileName), Buffer.from(match[2], "base64"));

  return imagePath;
}

function findPublicImageForSlug(slug) {
  const knownImagePath = knownImagePaths.get(slug);
  if (knownImagePath && fs.existsSync(path.join(root, "public", knownImagePath))) {
    return knownImagePath;
  }

  for (const extension of ["png", "jpg", "jpeg", "webp"]) {
    const candidate = `/${slug}.${extension}`;
    if (fs.existsSync(path.join(root, "public", candidate))) return candidate;
  }

  return null;
}

async function updateMenuImage(id, imagePath) {
  await pool.query(
    `update public.menu_items
     set image = $1
     where id = $2`,
    [imagePath, id]
  );
}

function getImageExtension(contentType) {
  const subtype = String(contentType || "").split("/")[1] || "png";
  return subtype.replace("jpeg", "jpg").replace(/[^a-z0-9]/gi, "") || "png";
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
