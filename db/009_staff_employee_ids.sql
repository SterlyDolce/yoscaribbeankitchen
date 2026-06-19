alter table public.users add column if not exists employee_id text;

update public.users
set employee_id = 'staff-' || left(id::text, 8)
where role in ('admin', 'staff') and employee_id is null;

create unique index if not exists users_employee_id_lower_key
on public.users (lower(employee_id))
where employee_id is not null;
