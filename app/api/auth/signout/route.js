import { NextResponse } from "next/server";
import { deleteSessionToken, sessionCookieName } from "../../../session";

export async function POST(request) {
  const token = request.cookies.get(sessionCookieName)?.value;
  await deleteSessionToken(token);

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(sessionCookieName);

  return response;
}
