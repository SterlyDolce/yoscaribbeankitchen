import { NextResponse } from "next/server";
import { hasDatabaseConfig, query } from "../../../db";
import { ensurePayrollSchema } from "../../../payroll-schema";
import { getStaffUserForRequest, requireAdminKey } from "../admin-auth";

export const dynamic = "force-dynamic";

async function requireStaffManager(request) {
  const adminKeyResult = requireAdminKey(request);
  if (!adminKeyResult) return null;

  const user = await getStaffUserForRequest(request);
  if (user?.staffPosition === "manager") return null;

  return adminKeyResult;
}

function currentMonthRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  return {
    end: end.toISOString().slice(0, 10),
    start: start.toISOString().slice(0, 10)
  };
}

export async function GET(request) {
  const unauthorized = await requireStaffManager(request);
  if (unauthorized) return unauthorized;

  if (!hasDatabaseConfig()) {
    return NextResponse.json({ message: "Database is not configured." }, { status: 503 });
  }

  await ensurePayrollSchema();

  const params = new URL(request.url).searchParams;
  const fallbackRange = currentMonthRange();
  const start = params.get("start") || fallbackRange.start;
  const end = params.get("end") || fallbackRange.end;

  const result = await query(
    `with time_totals as (
       select
         staff_user_id,
         sum(extract(epoch from (coalesce(clock_out_at, now()) - clock_in_at)) / 3600) as hours
       from public.staff_time_entries
       where clock_in_at >= $1::date
         and clock_in_at < $2::date
       group by staff_user_id
     ),
     payment_totals as (
       select staff_user_id, sum(amount) as paid
       from public.staff_payments
       where created_at >= $1::date
         and created_at < $2::date
       group by staff_user_id
     )
     select
       u.id,
       u.full_name,
       u.email,
       u.employee_id,
       u.hourly_rate,
       u.role,
       u.staff_position,
       coalesce(t.hours, 0) as hours,
       coalesce(p.paid, 0) as paid
     from public.users u
     left join time_totals t on t.staff_user_id = u.id
     left join payment_totals p on p.staff_user_id = u.id
     where u.role in ('admin', 'staff')
     order by u.full_name asc`,
    [start, end]
  );

  return NextResponse.json({
    end,
    payroll: result.rows.map((row) => {
      const hours = Number(row.hours || 0);
      const hourlyRate = Number(row.hourly_rate || 0);
      const grossPay = hours * hourlyRate;
      const paidAmount = Number(row.paid || 0);

      return {
        balance: grossPay - paidAmount,
        email: row.email,
        employeeId: row.employee_id,
        fullName: row.full_name,
        grossPay,
        hourlyRate,
        hours,
        id: row.id,
        paidAmount,
        role: row.role,
        staffPosition: row.staff_position
      };
    }),
    start
  });
}

export async function POST(request) {
  const unauthorized = await requireStaffManager(request);
  if (unauthorized) return unauthorized;

  if (!hasDatabaseConfig()) {
    return NextResponse.json({ message: "Database is not configured." }, { status: 503 });
  }

  const user = await getStaffUserForRequest(request);
  await ensurePayrollSchema();

  const body = await request.json();
  const staffUserId = String(body.staffUserId || "").trim();
  const amount = Number(body.amount || 0);
  const paymentMethod = String(body.paymentMethod || "cash").trim().toLowerCase();
  const periodStart = body.periodStart || null;
  const periodEnd = body.periodEnd || null;
  const note = String(body.note || "").trim() || null;

  if (!staffUserId || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ message: "Choose a staff member and payment amount." }, { status: 400 });
  }

  const result = await query(
    `insert into public.staff_payments (
       staff_user_id,
       amount,
       payment_method,
       period_start,
       period_end,
       note,
       created_by
     )
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id, staff_user_id, amount, payment_method, period_start, period_end, note, created_at`,
    [staffUserId, amount, paymentMethod, periodStart, periodEnd, note, user?.id || null]
  );

  const payment = result.rows[0];

  return NextResponse.json({
    payment: {
      amount: Number(payment.amount),
      createdAt: payment.created_at,
      id: payment.id,
      note: payment.note,
      paymentMethod: payment.payment_method,
      periodEnd: payment.period_end,
      periodStart: payment.period_start,
      staffUserId: payment.staff_user_id
    }
  }, { status: 201 });
}
