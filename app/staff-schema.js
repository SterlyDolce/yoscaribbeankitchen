import { query } from "./db";

const globalForStaffSchema = globalThis;

export async function ensureStaffPositionSchema() {
  if (globalForStaffSchema.yosStaffPositionSchemaReady) return;

  await query(`
    alter table public.users add column if not exists staff_position text;

    update public.users
    set staff_position = 'manager'
    where role = 'admin' and staff_position is null;

    update public.users
    set staff_position = 'front'
    where role = 'staff' and staff_position is null;
  `);

  globalForStaffSchema.yosStaffPositionSchemaReady = true;
}
