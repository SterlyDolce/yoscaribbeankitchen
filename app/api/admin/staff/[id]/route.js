import { NextResponse } from "next/server";
import { hasDatabaseConfig, query } from "../../../../db";
import { hashPassword } from "../../../../passwords";
import { ensureStaffPositionSchema } from "../../../../staff-schema";
import { normalizeStaffPosition } from "../../../../staff-positions";
import { requireAdminKey } from "../../admin-auth";

const staffRoles = new Set(["admin", "staff"]);

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

function roleDefaultPosition(role) {
  return role === "admin" ? "manager" : "front";
}

export async function PATCH(request, { params }) {
  const unauthorized = requireAdminKey(request);
  if (unauthorized) return unauthorized;

  if (!hasDatabaseConfig()) {
    return NextResponse.json({ message: "Database is not configured." }, { status: 503 });
  }

  await ensureStaffPositionSchema();

  const { id } = await params;
  const body = await request.json();
  const existingResult = await query(
    `select id, role, staff_position
     from public.users
     where id = $1
     limit 1`,
    [id]
  );
  const existingUser = existingResult.rows[0];

  if (!existingUser) {
    return NextResponse.json({ message: "Staff account not found." }, { status: 404 });
  }

  const fields = [];
  const values = [];
  let nextRole = existingUser.role;

  if (body.fullName !== undefined) {
    values.push(String(body.fullName || "").trim());
    fields.push(`full_name = $${values.length}`);
  }

  if (body.email !== undefined) {
    values.push(String(body.email || "").trim().toLowerCase());
    fields.push(`email = $${values.length}`);
  }

  if (body.employeeId !== undefined) {
    const employeeId = String(body.employeeId || "").trim().toLowerCase();

    if (!employeeId) {
      return NextResponse.json({ message: "Employee ID is required." }, { status: 400 });
    }

    values.push(employeeId);
    fields.push(`employee_id = $${values.length}`);
  }

  if (body.phone !== undefined) {
    values.push(String(body.phone || "").trim() || null);
    fields.push(`phone = $${values.length}`);
  }

  if (body.role !== undefined) {
    const role = String(body.role || "").trim().toLowerCase();

    if (!staffRoles.has(role)) {
      return NextResponse.json({ message: "Role must be staff or admin." }, { status: 400 });
    }

    nextRole = role;
    values.push(role);
    fields.push(`role = $${values.length}`);
  }

  if (body.role === undefined && body.staffPosition !== undefined && !staffRoles.has(nextRole)) {
    nextRole = "staff";
    values.push(nextRole);
    fields.push(`role = $${values.length}`);
  }

  if (body.staffPosition !== undefined) {
    values.push(normalizeStaffPosition(body.staffPosition, roleDefaultPosition(nextRole)));
    fields.push(`staff_position = $${values.length}`);
  } else if (body.role !== undefined && ["admin", "staff"].includes(nextRole)) {
    values.push(roleDefaultPosition(nextRole));
    fields.push(`staff_position = $${values.length}`);
  }

  if (body.password) {
    values.push(hashPassword(body.password));
    fields.push(`password_hash = $${values.length}`);
  }

  if (fields.length === 0) {
    return NextResponse.json({ message: "No staff fields were provided." }, { status: 400 });
  }

  values.push(id);

  try {
    const result = await query(
      `update public.users
       set ${fields.join(", ")}
       where id = $${values.length}
       returning id, full_name, email, employee_id, phone, role, staff_position, created_at`,
      values
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ message: "Staff account not found." }, { status: 404 });
    }

    return NextResponse.json({ staff: serializeStaff(result.rows[0]) });
  } catch (error) {
    if (error.code === "23505") {
      return NextResponse.json({ message: "An account already exists for that email or employee ID." }, { status: 409 });
    }

    console.error("Failed to update staff account.", error);
    return NextResponse.json({ message: "Unable to update staff account right now." }, { status: 500 });
  }
}
