import crypto from "crypto";
import { NextResponse } from "next/server";

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function requireAdmin(request) {
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
