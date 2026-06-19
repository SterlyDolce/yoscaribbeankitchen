import { query } from "./db";

const globalForStaffSchema = globalThis;

export async function ensureStaffPositionSchema() {
  if (globalForStaffSchema.yosStaffPositionSchemaReady) return;

  await query(`
    alter table public.users add column if not exists employee_id text;
    alter table public.users add column if not exists staff_position text;

    update public.users
    set employee_id = 'staff-' || left(id::text, 8)
    where role in ('admin', 'staff') and employee_id is null;

    update public.users
    set staff_position = 'manager'
    where role = 'admin' and staff_position is null;

    update public.users
    set staff_position = 'front'
    where role = 'staff' and staff_position is null;

    create unique index if not exists users_employee_id_lower_key
    on public.users (lower(employee_id))
    where employee_id is not null;
  `);

  globalForStaffSchema.yosStaffPositionSchemaReady = true;
}
