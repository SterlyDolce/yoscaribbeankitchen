import crypto from "crypto";
import { hasDatabaseConfig, query } from "./db";

export const sessionCookieName = "yos_session";
const sessionLengthMs = 1000 * 60 * 60 * 24 * 30;

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function publicUser(user) {
  if (!user) {
    return null;
  }

  return {
    addressLine1: user.address_line1,
    addressLine2: user.address_line2,
    city: user.city,
    deliveryNotes: user.delivery_notes,
    email: user.email,
    fullName: user.full_name,
    id: user.id,
    phone: user.phone,
    postalCode: user.postal_code,
    role: user.role,
    state: user.state
  };
}

export async function createSessionToken(userId) {
  if (!hasDatabaseConfig()) {
    return null;
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + sessionLengthMs);

  await query(
    `insert into public.user_sessions (user_id, token_hash, expires_at)
     values ($1, $2, $3)`,
    [userId, hashToken(token), expiresAt]
  );

  return { expiresAt, maxAge: Math.floor(sessionLengthMs / 1000), token };
}

export async function getUserForSessionToken(token) {
  if (!hasDatabaseConfig()) {
    return null;
  }

  if (!token) {
    return null;
  }

  const result = await query(
    `select
       u.id,
       u.full_name,
       u.email,
       u.phone,
       u.role,
       u.address_line1,
       u.address_line2,
       u.city,
       u.state,
       u.postal_code,
       u.delivery_notes
     from public.user_sessions s
     join public.users u on u.id = s.user_id
     where s.token_hash = $1 and s.expires_at > now()
     limit 1`,
    [hashToken(token)]
  );

  return publicUser(result.rows[0]);
}

export async function deleteSessionToken(token) {
  if (token && hasDatabaseConfig()) {
    await query("delete from public.user_sessions where token_hash = $1", [hashToken(token)]);
  }
}
