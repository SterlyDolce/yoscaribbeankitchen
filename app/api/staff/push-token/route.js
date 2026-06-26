import { NextResponse } from "next/server";
import { hasDatabaseConfig } from "../../../db";
import { registerStaffPushToken } from "../../../staff-notifications";
import { getStaffUserForRequest } from "../../admin/admin-auth";

export async function POST(request) {
  if (!hasDatabaseConfig()) {
    return NextResponse.json({ message: "Database is not configured." }, { status: 503 });
  }

  const user = await getStaffUserForRequest(request);

  if (!user || !["admin", "staff"].includes(user.role)) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json();
  const token = String(body.token || "").trim();
  const platform = String(body.platform || "").trim().toLowerCase();

  if (!token) {
    return NextResponse.json({ message: "Choose a valid device push token." }, { status: 400 });
  }

  if (!["android", "ios"].includes(platform)) {
    return NextResponse.json({ message: "Choose a valid push token platform." }, { status: 400 });
  }

  await registerStaffPushToken(user.id, token, platform, "native");

  return NextResponse.json({ ok: true });
}
