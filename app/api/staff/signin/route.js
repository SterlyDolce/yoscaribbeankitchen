import { NextResponse } from "next/server";
import { hasDatabaseConfig, query } from "../../../db";
import { verifyPassword } from "../../../passwords";
import { createSessionToken } from "../../../session";

export async function POST(request) {
  if (!hasDatabaseConfig()) {
    return NextResponse.json({ message: "Database is not configured." }, { status: 503 });
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

    if (!["admin", "staff"].includes(user.role)) {
      return NextResponse.json({ message: "This account does not have staff access." }, { status: 403 });
    }

    const session = await createSessionToken(user.id);

    return NextResponse.json({
      token: session.token,
      expiresAt: session.expiresAt,
      user: {
        email: user.email,
        fullName: user.full_name,
        id: user.id,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (error) {
    console.error("Failed to sign in staff.", error);
    return NextResponse.json({ message: "Unable to sign in right now." }, { status: 500 });
  }
}
