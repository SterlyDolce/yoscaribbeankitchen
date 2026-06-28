import crypto from "crypto";
import { query } from "./db";

const vapidSubject = process.env.WEB_PUSH_SUBJECT || "mailto:orders@eatyos.com";

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);

  return Buffer.from(`${normalized}${padding}`, "base64");
}

function derToJose(signature) {
  let offset = 4;
  let rLength = signature[3];

  if (signature[offset] === 0) {
    offset += 1;
    rLength -= 1;
  }

  const r = signature.subarray(offset, offset + rLength);
  offset += rLength + 2;
  let sLength = signature[offset - 1];

  if (signature[offset] === 0) {
    offset += 1;
    sLength -= 1;
  }

  const s = signature.subarray(offset, offset + sLength);

  return Buffer.concat([
    Buffer.concat([Buffer.alloc(Math.max(0, 32 - r.length)), r]).subarray(-32),
    Buffer.concat([Buffer.alloc(Math.max(0, 32 - s.length)), s]).subarray(-32)
  ]);
}

function getVapidConfig() {
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY;

  if (!publicKey || !privateKey) return null;

  const publicKeyBytes = base64UrlDecode(publicKey);
  if (publicKeyBytes.length !== 65 || publicKeyBytes[0] !== 4) return null;

  return {
    privateKey,
    publicKey,
    x: base64UrlEncode(publicKeyBytes.subarray(1, 33)),
    y: base64UrlEncode(publicKeyBytes.subarray(33, 65))
  };
}

function createVapidToken(endpoint) {
  const config = getVapidConfig();
  if (!config) return null;

  const audience = new URL(endpoint).origin;
  const header = base64UrlEncode(JSON.stringify({ alg: "ES256", typ: "JWT" }));
  const payload = base64UrlEncode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: vapidSubject
  }));
  const privateKey = crypto.createPrivateKey({
    format: "jwk",
    key: {
      crv: "P-256",
      d: config.privateKey,
      kty: "EC",
      x: config.x,
      y: config.y
    }
  });
  const signature = crypto.sign("sha256", Buffer.from(`${header}.${payload}`), privateKey);

  return `${header}.${payload}.${base64UrlEncode(derToJose(signature))}`;
}

export function getCustomerWebPushPublicKey() {
  return getVapidConfig()?.publicKey || "";
}

export async function ensureCustomerPushSchema() {
  await query(`
    create table if not exists public.customer_push_subscriptions (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references public.users(id) on delete cascade,
      endpoint text not null unique,
      p256dh text not null,
      auth text not null,
      user_agent text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists customer_push_subscriptions_user_id_idx
    on public.customer_push_subscriptions (user_id);
  `);
}

export async function registerCustomerPushSubscription(userId, subscription, userAgent = "") {
  await ensureCustomerPushSchema();

  const endpoint = String(subscription?.endpoint || "").trim();
  const p256dh = String(subscription?.keys?.p256dh || "").trim();
  const auth = String(subscription?.keys?.auth || "").trim();

  if (!endpoint || !p256dh || !auth) {
    throw new Error("Invalid browser push subscription.");
  }

  await query(
    `insert into public.customer_push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
     values ($1, $2, $3, $4, $5)
     on conflict (endpoint)
     do update set user_id = excluded.user_id,
                   p256dh = excluded.p256dh,
                   auth = excluded.auth,
                   user_agent = excluded.user_agent,
                   updated_at = now()`,
    [userId, endpoint, p256dh, auth, userAgent || null]
  );
}

export async function removeCustomerPushSubscription(endpoint) {
  if (!endpoint) return;

  await ensureCustomerPushSchema();
  await query("delete from public.customer_push_subscriptions where endpoint = $1", [endpoint]);
}

async function sendWebPush(subscription) {
  const token = createVapidToken(subscription.endpoint);
  const config = getVapidConfig();

  if (!token || !config) {
    console.error("Unable to send web push notification. WEB_PUSH_PUBLIC_KEY and WEB_PUSH_PRIVATE_KEY are required.");
    return { ok: false, statusCode: 503 };
  }

  const response = await fetch(subscription.endpoint, {
    headers: {
      Authorization: `vapid t=${token}, k=${config.publicKey}`,
      TTL: "300",
      Urgency: "high"
    },
    method: "POST"
  });

  return { ok: response.ok, statusCode: response.status };
}

export async function notifyCustomerForOrderStatus(orderId, status) {
  await ensureCustomerPushSchema();

  const result = await query(
    `select s.endpoint
     from public.orders o
     join public.customer_push_subscriptions s on s.user_id = o.user_id
     where o.id = $1
       and o.user_id is not null`,
    [orderId]
  );

  const staleEndpoints = [];

  await Promise.all(result.rows.map(async (row) => {
    try {
      const pushResult = await sendWebPush(row);

      if ([404, 410].includes(pushResult.statusCode)) {
        staleEndpoints.push(row.endpoint);
      } else if (!pushResult.ok) {
        console.error("Web push failed.", pushResult.statusCode, status);
      }
    } catch (error) {
      console.error("Unable to send web push notification.", error);
    }
  }));

  await Promise.all(staleEndpoints.map((endpoint) => removeCustomerPushSubscription(endpoint)));
}
