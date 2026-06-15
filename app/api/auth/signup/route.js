import { NextResponse } from "next/server";
import { hashPassword } from "../../../passwords";
import { hasDatabaseConfig, query } from "../../../db";
import { createSessionToken, sessionCookieName } from "../../../session";

export async function POST(request) {
  if (!hasDatabaseConfig()) {
    return NextResponse.json(
      { message: "Database is not configured. Add DATABASE_URL to enable accounts." },
      { status: 503 }
    );
  }

  const body = await request.json();
  const fullName = body.fullName?.trim();
  const email = body.email?.trim().toLowerCase();
  const phone = body.phone?.trim();
  const password = body.password;

  if (!fullName || !email || !phone || !password) {
    return NextResponse.json({ message: "Full name, email, phone, and password are required." }, { status: 400 });
  }

  try {
    const result = await query(
      `insert into public.users (full_name, email, phone, password_hash)
       values ($1, $2, $3, $4)
       returning id, full_name, email, phone, role`,
      [fullName, email, phone, hashPassword(password)]
    );
    const user = result.rows[0];

    const session = await createSessionToken(user.id);

    const response = NextResponse.json({
      user: {
        email: user.email,
        fullName: user.full_name,
        id: user.id,
        phone: user.phone,
        role: user.role
      }
    }, { status: 201 });

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
    if (error.code === "23505") {
      return NextResponse.json({ message: "An account already exists for that email." }, { status: 409 });
    }

    console.error("Failed to create account.", error);
    return NextResponse.json({ message: "Unable to create account right now." }, { status: 500 });
  }
}
