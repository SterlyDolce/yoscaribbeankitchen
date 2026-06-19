import { NextResponse } from "next/server";
import { hasDatabaseConfig, query } from "../../../db";
import { isEmployeeId, normalizeEmployeeId } from "../../../employee-ids";
import { hashPassword } from "../../../passwords";
import { ensureStaffPositionSchema } from "../../../staff-schema";
import { normalizeStaffPosition } from "../../../staff-positions";
import { getStaffUserForRequest, requireAdminKey } from "../admin-auth";

const staffRoles = new Set(["admin", "staff"]);

async function requireStaffManager(request) {
  const adminKeyResult = requireAdminKey(request);
  if (!adminKeyResult) return null;

  const user = await getStaffUserForRequest(request);
  if (user?.staffPosition === "manager") return null;

  return adminKeyResult;
}

function serializeStaff(row) {
  return {
    createdAt: row.created_at,
    email: row.email,
    employeeId: row.employee_id,
    fullName: row.full_name,
    id: row.id,
    phone: row.phone,
    role: row.role,
    staffPosition: row.staff_position
  };
}

export async function GET(request) {
  const unauthorized = await requireStaffManager(request);
  if (unauthorized) return unauthorized;

  if (!hasDatabaseConfig()) {
    return NextResponse.json({ message: "Database is not configured." }, { status: 503 });
  }

  await ensureStaffPositionSchema();

  const result = await query(
    `select id, full_name, email, employee_id, phone, role, staff_position, created_at
     from public.users
     where role in ('admin', 'staff')
     order by created_at desc`
  );

  return NextResponse.json({ staff: result.rows.map(serializeStaff) });
}

export async function POST(request) {
  const unauthorized = await requireStaffManager(request);
  if (unauthorized) return unauthorized;

  if (!hasDatabaseConfig()) {
    return NextResponse.json({ message: "Database is not configured." }, { status: 503 });
  }

  await ensureStaffPositionSchema();

  const body = await request.json();
  const fullName = body.fullName?.trim();
  const email = body.email?.trim().toLowerCase();
  const employeeId = normalizeEmployeeId(body.employeeId);
  const phone = body.phone?.trim() || null;
  const password = body.password;
  const role = body.role?.trim().toLowerCase() || "staff";
  const staffPosition = role === "admin"
    ? normalizeStaffPosition(body.staffPosition, "manager")
    : normalizeStaffPosition(body.staffPosition, "front");

  if (!fullName || !email || !employeeId || !password) {
    return NextResponse.json({ message: "Full name, email, employee ID, and password are required." }, { status: 400 });
  }

  if (!staffRoles.has(role)) {
    return NextResponse.json({ message: "Role must be staff or admin." }, { status: 400 });
  }

  if (!isEmployeeId(employeeId)) {
    return NextResponse.json({ message: "Employee ID must be 6 numbers." }, { status: 400 });
  }

  try {
    const result = await query(
      `insert into public.users (full_name, email, employee_id, phone, password_hash, role, staff_position)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning id, full_name, email, employee_id, phone, role, staff_position, created_at`,
      [fullName, email, employeeId, phone, hashPassword(password), role, staffPosition]
    );

    return NextResponse.json({ staff: serializeStaff(result.rows[0]) }, { status: 201 });
  } catch (error) {
    if (error.code === "23505") {
      return NextResponse.json({ message: "An account already exists for that email or employee ID." }, { status: 409 });
    }

    console.error("Failed to create staff account.", error);
    return NextResponse.json({ message: "Unable to create staff account right now." }, { status: 500 });
  }
}
