import { NextResponse } from "next/server";
import { hasDatabaseConfig, query } from "../../../db";
import { verifyPassword } from "../../../passwords";
import { createSessionToken } from "../../../session";
import { ensureStaffPositionSchema } from "../../../staff-schema";
import { normalizeStaffPosition } from "../../../staff-positions";

export async function POST(request) {
  if (!hasDatabaseConfig()) {
    return NextResponse.json({ message: "Database is not configured." }, { status: 503 });
  }

  const body = await request.json();
  const employeeId = body.employeeId?.trim().toLowerCase();
  const password = body.password;

  if (!employeeId || !password) {
    return NextResponse.json({ message: "Employee ID and password are required." }, { status: 400 });
  }

  try {
    await ensureStaffPositionSchema();

    const result = await query(
      `select id, full_name, email, employee_id, phone, role, staff_position, password_hash
       from public.users
       where lower(employee_id) = $1
       limit 1`,
      [employeeId]
    );
    const user = result.rows[0];

    if (!user || !verifyPassword(password, user.password_hash)) {
      return NextResponse.json({ message: "Invalid employee ID or password." }, { status: 401 });
    }

    if (!["admin", "staff"].includes(user.role)) {
      return NextResponse.json({ message: "This account does not have staff access." }, { status: 403 });
    }

    const session = await createSessionToken(user.id);
    const staffPosition = normalizeStaffPosition(user.staff_position, user.role === "admin" ? "manager" : "front");

    return NextResponse.json({
      token: session.token,
      expiresAt: session.expiresAt,
      user: {
        email: user.email,
        employeeId: user.employee_id,
        fullName: user.full_name,
        id: user.id,
        phone: user.phone,
        role: user.role,
        staffPosition
      }
    });
  } catch (error) {
    console.error("Failed to sign in staff.", error);
    return NextResponse.json({ message: "Unable to sign in right now." }, { status: 500 });
  }
}
