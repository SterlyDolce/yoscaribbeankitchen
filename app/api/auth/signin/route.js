import { NextResponse } from "next/server";
import { query, hasDatabaseConfig } from "../../../db";
import { verifyPassword } from "../../../passwords";
import { createSessionToken, sessionCookieName } from "../../../session";

export async function POST(request) {
  if (!hasDatabaseConfig()) {
    return NextResponse.json(
      { message: "Database is not configured. Add DATABASE_URL to enable sign-in." },
      { status: 503 }
    );
  }

  const body = await request.json();
  const email = body.email?.trim().toLowerCase();
  const password = body.password;

  if (!email || !password) {
    return NextResponse.json({ message: "Email and password are required." }, { status: 400 });
  }

  try {
    const result = await query(
      `select id, full_name, email, phone, role, password_hash
       from public.users
       where lower(email) = $1
       limit 1`,
      [email]
    );
    const user = result.rows[0];

    if (!user || !verifyPassword(password, user.password_hash)) {
      return NextResponse.json({ message: "Invalid email or password." }, { status: 401 });
    }

    const session = await createSessionToken(user.id);

    const response = NextResponse.json({
      user: {
        email: user.email,
        fullName: user.full_name,
        id: user.id,
        phone: user.phone,
        role: user.role
      }
    });

    if (session) {
      response.cookies.set(sessionCookieName, session.token, {
        httpOnly: true,
        maxAge: session.maxAge,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production" && process.env.AUTH_COOKIE_SECURE !== "false",
        path: "/"
      });
    }

    return response;
  } catch (error) {
    console.error("Failed to sign in.", error);
    return NextResponse.json({ message: "Unable to sign in right now." }, { status: 500 });
  }
}
