import { NextResponse } from "next/server";
import { getMenuItems } from "../../menu-data";
import { getUserForSessionToken, sessionCookieName } from "../../session";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const [menuItems, user] = await Promise.all([
      getMenuItems(),
      getUserForSessionToken(request.cookies.get(sessionCookieName)?.value)
    ]);

    return NextResponse.json({ menuItems, user });
  } catch (error) {
    console.error("Unable to load bag data.", error);
    return NextResponse.json({ menuItems: [], user: null }, { status: 200 });
  }
}
