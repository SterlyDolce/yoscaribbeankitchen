import { NextResponse } from "next/server";
import { hasDatabaseConfig, query } from "../../../db";
import { isEmployeeId, normalizeEmployeeId } from "../../../employee-ids";
import { ensurePayrollSchema } from "../../../payroll-schema";
import { getStaffUserForRequest } from "../../admin/admin-auth";

export const dynamic = "force-dynamic";

function serializeEntry(row) {
  const clockIn = new Date(row.clock_in_at);
  const clockOut = row.clock_out_at ? new Date(row.clock_out_at) : null;
  const end = clockOut || new Date();

  return {
    clockInAt: row.clock_in_at,
    clockOutAt: row.clock_out_at,
    hours: Math.max(0, (end.getTime() - clockIn.getTime()) / 3600000),
    id: row.id,
    note: row.note
  };
}

export async function GET(request) {
  if (!hasDatabaseConfig()) {
    return NextResponse.json({ message: "Database is not configured." }, { status: 503 });
  }

  const user = await getStaffUserForRequest(request);

  if (!user || !["admin", "staff"].includes(user.role)) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  await ensurePayrollSchema();

  const result = await query(
    `select id, clock_in_at, clock_out_at, note
     from public.staff_time_entries
     where staff_user_id = $1
     order by clock_in_at desc
     limit 20`,
    [user.id]
  );

  const entries = result.rows.map(serializeEntry);

  return NextResponse.json({
    currentEntry: entries.find((entry) => !entry.clockOutAt) || null,
    entries
  });
}

export async function POST(request) {
  if (!hasDatabaseConfig()) {
    return NextResponse.json({ message: "Database is not configured." }, { status: 503 });
  }

  const user = await getStaffUserForRequest(request);

  if (!user || !["admin", "staff"].includes(user.role)) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  await ensurePayrollSchema();

  const body = await request.json();
  const action = String(body.action || "").trim().toLowerCase();
  const employeeId = normalizeEmployeeId(body.employeeId);
  const note = String(body.note || "").trim() || null;

  if (!isEmployeeId(employeeId)) {
    return NextResponse.json({ message: "Enter your 6-digit employee ID." }, { status: 400 });
  }

  if (employeeId !== user.employeeId) {
    return NextResponse.json({ message: "Employee ID does not match this staff account." }, { status: 403 });
  }

  if (action === "clock_in") {
    try {
      const result = await query(
        `insert into public.staff_time_entries (staff_user_id, note)
         values ($1, $2)
         returning id, clock_in_at, clock_out_at, note`,
        [user.id, note]
      );

      return NextResponse.json({ currentEntry: serializeEntry(result.rows[0]) }, { status: 201 });
    } catch (error) {
      if (error.code === "23505") {
        return NextResponse.json({ message: "You are already clocked in." }, { status: 409 });
      }

      console.error("Failed to clock in.", error);
      return NextResponse.json({ message: "Unable to clock in right now." }, { status: 500 });
    }
  }

  if (action === "clock_out") {
    const result = await query(
      `update public.staff_time_entries
       set clock_out_at = now(), updated_at = now()
       where staff_user_id = $1 and clock_out_at is null
       returning id, clock_in_at, clock_out_at, note`,
      [user.id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ message: "You are not clocked in." }, { status: 409 });
    }

    return NextResponse.json({ entry: serializeEntry(result.rows[0]) });
  }

  return NextResponse.json({ message: "Choose clock_in or clock_out." }, { status: 400 });
}
