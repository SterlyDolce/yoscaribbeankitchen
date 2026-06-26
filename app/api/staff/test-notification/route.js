import { NextResponse } from "next/server";
import { hasDatabaseConfig } from "../../../db";
import { notifyStaffUserTest } from "../../../staff-notifications";
import { getStaffUserForRequest } from "../../admin/admin-auth";

export async function POST(request) {
  if (!hasDatabaseConfig()) {
    return NextResponse.json({ message: "Database is not configured." }, { status: 503 });
  }

  const user = await getStaffUserForRequest(request);

  if (!user || !["admin", "staff"].includes(user.role)) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const title = String(body.title || "Yo's test notification").trim();
  const message = String(body.body || "If you can see this, staff notifications are working.").trim();
  const result = await notifyStaffUserTest(user.id, title, message);

  return NextResponse.json({
    ok: true,
    ...result
  });
}
