import { NextResponse } from "next/server";
import { hasDatabaseConfig, query } from "../../../db";
import { hashPassword } from "../../../passwords";
import { requireAdminKey } from "../admin-auth";

const staffRoles = new Set(["admin", "staff"]);

function serializeStaff(row) {
  return {
    createdAt: row.created_at,
    email: row.email,
    fullName: row.full_name,
    id: row.id,
    phone: row.phone,
    role: row.role
  };
}

export async function GET(request) {
  const unauthorized = requireAdminKey(request);
  if (unauthorized) return unauthorized;

  if (!hasDatabaseConfig()) {
    return NextResponse.json({ message: "Database is not configured." }, { status: 503 });
  }

  const result = await query(
    `select id, full_name, email, phone, role, created_at
     from public.users
     where role in ('admin', 'staff')
     order by created_at desc`
  );

  return NextResponse.json({ staff: result.rows.map(serializeStaff) });
}

export async function POST(request) {
  const unauthorized = requireAdminKey(request);
  if (unauthorized) return unauthorized;

  if (!hasDatabaseConfig()) {
    return NextResponse.json({ message: "Database is not configured." }, { status: 503 });
  }

  const body = await request.json();
  const fullName = body.fullName?.trim();
  const email = body.email?.trim().toLowerCase();
  const phone = body.phone?.trim() || null;
  const password = body.password;
  const role = body.role?.trim().toLowerCase() || "staff";

  if (!fullName || !email || !password) {
    return NextResponse.json({ message: "Full name, email, and password are required." }, { status: 400 });
  }

  if (!staffRoles.has(role)) {
    return NextResponse.json({ message: "Role must be staff or admin." }, { status: 400 });
  }

  try {
    const result = await query(
      `insert into public.users (full_name, email, phone, password_hash, role)
       values ($1, $2, $3, $4, $5)
       returning id, full_name, email, phone, role, created_at`,
      [fullName, email, phone, hashPassword(password), role]
    );

    return NextResponse.json({ staff: serializeStaff(result.rows[0]) }, { status: 201 });
  } catch (error) {
    if (error.code === "23505") {
      return NextResponse.json({ message: "An account already exists for that email." }, { status: 409 });
    }

    console.error("Failed to create staff account.", error);
    return NextResponse.json({ message: "Unable to create staff account right now." }, { status: 500 });
  }
}
