import crypto from "crypto";
import { NextResponse } from "next/server";
import { getUserForSessionToken } from "../../session";

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function getBearerToken(request) {
  const authorization = request.headers.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");

  return scheme?.toLowerCase() === "bearer" ? token : "";
}

export async function getStaffUserForRequest(request) {
  const bearerToken = getBearerToken(request);
  return getUserForSessionToken(bearerToken);
}

export function requireAdminKey(request) {
  const configuredKey = process.env.ADMIN_API_KEY;
  const providedKey = request.headers.get("x-admin-key") || "";

  if (!configuredKey) {
    return NextResponse.json({ message: "ADMIN_API_KEY is not configured." }, { status: 503 });
  }

  if (!providedKey || !safeEqual(providedKey, configuredKey)) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  return null;
}

export async function requireAdmin(request, { allowStaffSession = true } = {}) {
  const adminKeyResult = requireAdminKey(request);

  if (!adminKeyResult) {
    return null;
  }

  if (!allowStaffSession) {
    return adminKeyResult;
  }

  const user = await getStaffUserForRequest(request);

  if (user && ["admin", "staff"].includes(user.role)) {
    return null;
  }

  return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
}
