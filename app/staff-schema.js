import { query } from "./db";

const globalForStaffSchema = globalThis;

export async function ensureStaffPositionSchema() {
  if (globalForStaffSchema.yosStaffPositionSchemaReady) return;

  await query(`
    alter table public.users add column if not exists employee_id text;
    alter table public.users add column if not exists staff_position text;

    with targets as (
      select id, row_number() over (order by created_at, id) as rn
      from public.users
      where role in ('admin', 'staff') and (employee_id is null or employee_id !~ '^[0-9]{6}$')
    ),
    candidates as (
      select
        lpad(n::text, 6, '0') as employee_id,
        row_number() over (order by n) as rn
      from generate_series(1, 999999) n
      where lpad(n::text, 6, '0') not in (
        select employee_id
        from public.users
        where employee_id ~ '^[0-9]{6}$'
      )
    )
    update public.users u
    set employee_id = c.employee_id
    from targets t
    join candidates c on c.rn = t.rn
    where u.id = t.id;

    update public.users
    set staff_position = 'manager'
    where role = 'admin' and staff_position is null;

    update public.users
    set staff_position = 'front'
    where role = 'staff' and staff_position is null;

    create unique index if not exists users_employee_id_lower_key
    on public.users (lower(employee_id))
    where employee_id is not null;

    alter table public.users drop constraint if exists users_employee_id_six_digits;
    alter table public.users
    add constraint users_employee_id_six_digits
    check (employee_id is null or employee_id ~ '^[0-9]{6}$');
  `);

  globalForStaffSchema.yosStaffPositionSchemaReady = true;
}
