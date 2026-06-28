import { NextResponse } from "next/server";
import { hasDatabaseConfig } from "../../../db";
import {
  registerCustomerPushSubscription,
  removeCustomerPushSubscription
} from "../../../customer-notifications";
import { getUserForSessionToken, sessionCookieName } from "../../../session";

export async function POST(request) {
  if (!hasDatabaseConfig()) {
    return NextResponse.json({ message: "Database is not configured." }, { status: 503 });
  }

  const user = await getUserForSessionToken(request.cookies.get(sessionCookieName)?.value);

  if (!user) {
    return NextResponse.json({ message: "Sign in to enable order notifications." }, { status: 401 });
  }

  const body = await request.json();

  try {
    await registerCustomerPushSubscription(
      user.id,
      body.subscription,
      request.headers.get("user-agent") || ""
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
}

export async function DELETE(request) {
  const body = await request.json().catch(() => ({}));

  await removeCustomerPushSubscription(body.endpoint);

  return NextResponse.json({ ok: true });
}
