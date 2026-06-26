import crypto from "node:crypto";
import http2 from "node:http2";
import { query } from "./db";
import { getVisibleStatusesForPosition } from "./staff-positions";

const globalForStaffNotifications = globalThis;
const APNS_PRODUCTION_HOST = "https://api.push.apple.com";
const APNS_SANDBOX_HOST = "https://api.sandbox.push.apple.com";
const FCM_TOKEN_URL = "https://oauth2.googleapis.com/token";

export async function ensureStaffPushSchema() {
  if (globalForStaffNotifications.yosStaffPushSchemaReady) return;

  await query(`
    create table if not exists public.staff_push_tokens (
      id uuid primary key default gen_random_uuid(),
      staff_user_id uuid not null references public.users(id) on delete cascade,
      device_push_token text not null unique,
      push_service text not null default 'native',
      platform text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    alter table public.staff_push_tokens
    add column if not exists device_push_token text;

    alter table public.staff_push_tokens
    add column if not exists push_service text not null default 'native';

    do $$
    begin
      if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'staff_push_tokens'
          and column_name = 'expo_push_token'
      ) then
        update public.staff_push_tokens
        set device_push_token = expo_push_token,
            push_service = 'expo'
        where device_push_token is null;

        alter table public.staff_push_tokens
        alter column expo_push_token drop not null;
      end if;
    end $$;

    alter table public.staff_push_tokens
    alter column device_push_token set not null;

    create unique index if not exists staff_push_tokens_device_push_token_idx
    on public.staff_push_tokens (device_push_token);

    create index if not exists staff_push_tokens_staff_user_id_idx
    on public.staff_push_tokens (staff_user_id);
  `);

  globalForStaffNotifications.yosStaffPushSchemaReady = true;
}

export async function registerStaffPushToken(staffUserId, token, platform = null, pushService = "native") {
  await ensureStaffPushSchema();

  await query(
    `insert into public.staff_push_tokens (staff_user_id, device_push_token, platform, push_service)
     values ($1, $2, $3, $4)
     on conflict (device_push_token)
     do update set staff_user_id = excluded.staff_user_id,
                   platform = excluded.platform,
                   push_service = excluded.push_service,
                   updated_at = now()`,
    [staffUserId, token, platform, pushService]
  );
}

function canSeeStatus(position, status) {
  const visibleStatuses = getVisibleStatusesForPosition(position);
  return !visibleStatuses || visibleStatuses.includes(status);
}

function base64Url(input) {
  return Buffer.from(input).toString("base64url");
}

function normalizePrivateKey(value) {
  return value?.replace(/\\n/g, "\n");
}

function createJwt({ claims, header, privateKey, algorithm = "RSA-SHA256" }) {
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedClaims = base64Url(JSON.stringify(claims));
  const payload = `${encodedHeader}.${encodedClaims}`;
  const signature = crypto.sign(algorithm, Buffer.from(payload), privateKey).toString("base64url");

  return `${payload}.${signature}`;
}

function getApnsConfig() {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const bundleId = process.env.APNS_BUNDLE_ID;
  const privateKey = normalizePrivateKey(process.env.APNS_PRIVATE_KEY);

  if (!keyId || !teamId || !bundleId || !privateKey) return null;

  return {
    bundleId,
    host: process.env.APNS_ENV === "sandbox" ? APNS_SANDBOX_HOST : APNS_PRODUCTION_HOST,
    keyId,
    privateKey,
    teamId
  };
}

function createApnsJwt(config) {
  const now = Math.floor(Date.now() / 1000);
  const cached = globalForStaffNotifications.yosApnsJwt;

  if (cached && cached.expiresAt > now + 60) {
    return cached.token;
  }

  const token = createJwt({
    algorithm: "sha256",
    claims: {
      iat: now,
      iss: config.teamId
    },
    header: {
      alg: "ES256",
      kid: config.keyId
    },
    privateKey: config.privateKey
  });

  globalForStaffNotifications.yosApnsJwt = {
    expiresAt: now + 50 * 60,
    token
  };

  return token;
}

async function sendApnsPush(message) {
  const config = getApnsConfig();
  const body = String(message.body || "New order update");
  const title = String(message.title || "Yo's Kitchen Staff");
  const interruptionLevel = process.env.APNS_INTERRUPTION_LEVEL;

  if (!config) {
    console.error("Unable to send APNs push notification. APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID, and APNS_PRIVATE_KEY are required.");
    return;
  }

  const client = http2.connect(config.host);

  await new Promise((resolve) => {
    const request = client.request({
      ":method": "POST",
      ":path": `/3/device/${message.token}`,
      authorization: `bearer ${createApnsJwt(config)}`,
      "apns-priority": "10",
      "apns-push-type": "alert",
      "apns-topic": config.bundleId
    });

    let responseBody = "";
    let statusCode = null;

    request.setEncoding("utf8");
    request.on("response", (headers) => {
      statusCode = headers[":status"];
    });
    request.on("data", (chunk) => {
      responseBody += chunk;
    });
    request.on("end", () => {
      client.close();

      if (statusCode < 200 || statusCode >= 300) {
        console.error("APNs push failed.", statusCode, responseBody);
      }

      resolve();
    });
    request.on("error", (error) => {
      client.close();
      console.error("Unable to send APNs push notification.", error);
      resolve();
    });

    request.end(JSON.stringify({
      aps: {
        alert: {
          body,
          title
        },
        badge: 1,
        sound: "default",
        "thread-id": "orders",
        ...(interruptionLevel ? { "interruption-level": interruptionLevel } : {})
      },
      orderId: message.orderId,
      status: message.status
    }));
  });
}

async function getFcmAccessToken() {
  const projectId = process.env.FCM_PROJECT_ID;
  const clientEmail = process.env.FCM_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.FCM_PRIVATE_KEY);

  if (!projectId || !clientEmail || !privateKey) return null;

  const now = Math.floor(Date.now() / 1000);
  const cached = globalForStaffNotifications.yosFcmAccessToken;

  if (cached && cached.expiresAt > now + 60) {
    return cached.token;
  }

  const assertion = createJwt({
    claims: {
      aud: FCM_TOKEN_URL,
      exp: now + 60 * 60,
      iat: now,
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/firebase.messaging"
    },
    header: {
      alg: "RS256",
      typ: "JWT"
    },
    privateKey
  });

  try {
    const response = await fetch(FCM_TOKEN_URL, {
      body: new URLSearchParams({
        assertion,
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer"
      }),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      method: "POST"
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("Unable to get FCM access token.", response.status, body);
      return null;
    }

    const data = await response.json();
    const token = typeof data.access_token === "string" ? data.access_token : null;

    if (!token) return null;

    globalForStaffNotifications.yosFcmAccessToken = {
      expiresAt: now + Number(data.expires_in || 3600),
      token
    };

    return token;
  } catch (error) {
    console.error("Unable to get FCM access token.", error);
    return null;
  }
}

async function sendFcmPush(message) {
  const projectId = process.env.FCM_PROJECT_ID;
  const accessToken = await getFcmAccessToken();

  if (!projectId || !accessToken) {
    console.error("Unable to send FCM push notification. FCM_PROJECT_ID, FCM_CLIENT_EMAIL, and FCM_PRIVATE_KEY are required.");
    return;
  }

  try {
    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
      body: JSON.stringify({
        message: {
          android: {
            notification: {
              channel_id: "orders-high",
              default_vibrate_timings: true,
              notification_priority: "PRIORITY_MAX",
              sound: "default",
              visibility: "PUBLIC"
            },
            priority: "HIGH"
          },
          data: {
            orderId: String(message.orderId),
            status: String(message.status)
          },
          notification: {
            body: message.body,
            title: message.title
          },
          token: message.token
        }
      }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      method: "POST"
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("FCM push failed.", response.status, body);
    }
  } catch (error) {
    console.error("Unable to send FCM push notification.", error);
  }
}

async function sendNativePush(messages) {
  await Promise.all(
    messages.map((message) => {
      if (message.platform === "ios") {
        return sendApnsPush(message);
      }

      if (message.platform === "android") {
        return sendFcmPush(message);
      }

      console.error("Unable to send push notification for unknown platform.", message.platform);
      return Promise.resolve();
    })
  );
}

export async function notifyStaffForOrderStatus(orderId, status, title, body) {
  await ensureStaffPushSchema();

  const result = await query(
    `select
       t.device_push_token,
       t.platform,
       u.staff_position
     from public.staff_push_tokens t
     join public.users u on u.id = t.staff_user_id
     where u.role in ('admin', 'staff')
       and t.push_service = 'native'`,
  );

  const messages = result.rows
    .filter((row) => canSeeStatus(row.staff_position, status))
    .map((row) => ({
      body,
      orderId,
      platform: row.platform,
      status,
      title,
      token: row.device_push_token
    }));

  await sendNativePush(messages);
}
