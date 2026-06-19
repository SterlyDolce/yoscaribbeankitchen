import { NextResponse } from "next/server";
import { getUserForSessionToken } from "../../../session";

function getBearerToken(request) {
  const authorization = request.headers.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");

  return scheme?.toLowerCase() === "bearer" ? token : "";
}

export async function GET(request) {
  const user = await getUserForSessionToken(getBearerToken(request));

  if (!user || !["admin", "staff"].includes(user.role)) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json({ user });
}
