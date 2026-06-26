import { query } from "./db";
import { getVisibleStatusesForPosition } from "./staff-positions";

const globalForStaffNotifications = globalThis;

export async function ensureStaffPushSchema() {
  if (globalForStaffNotifications.yosStaffPushSchemaReady) return;

  await query(`
    create table if not exists public.staff_push_tokens (
      id uuid primary key default gen_random_uuid(),
      staff_user_id uuid not null references public.users(id) on delete cascade,
      expo_push_token text not null unique,
      platform text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists staff_push_tokens_staff_user_id_idx
    on public.staff_push_tokens (staff_user_id);
  `);

  globalForStaffNotifications.yosStaffPushSchemaReady = true;
}

export async function registerStaffPushToken(staffUserId, token, platform = null) {
  await ensureStaffPushSchema();

  await query(
    `insert into public.staff_push_tokens (staff_user_id, expo_push_token, platform)
     values ($1, $2, $3)
     on conflict (expo_push_token)
     do update set staff_user_id = excluded.staff_user_id,
                   platform = excluded.platform,
                   updated_at = now()`,
    [staffUserId, token, platform]
  );
}

function canSeeStatus(position, status) {
  const visibleStatuses = getVisibleStatusesForPosition(position);
  return !visibleStatuses || visibleStatuses.includes(status);
}

async function sendExpoPush(messages) {
  if (messages.length === 0) return;

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      body: JSON.stringify(messages),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("Expo push failed.", response.status, body);
    }
  } catch (error) {
    console.error("Unable to send Expo push notification.", error);
  }
}

export async function notifyStaffForOrderStatus(orderId, status, title, body) {
  await ensureStaffPushSchema();

  const result = await query(
    `select
       t.expo_push_token,
       u.staff_position
     from public.staff_push_tokens t
     join public.users u on u.id = t.staff_user_id
     where u.role in ('admin', 'staff')`,
  );

  const messages = result.rows
    .filter((row) => canSeeStatus(row.staff_position, status))
    .map((row) => ({
      body,
      channelId: "orders",
      data: { orderId, status },
      priority: "high",
      sound: "default",
      title,
      to: row.expo_push_token
    }));

  await sendExpoPush(messages);
}
