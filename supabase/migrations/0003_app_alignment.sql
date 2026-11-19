-- Align the schema with what the app stores, and add company sign-up.

-- Companies: who signs certified payroll, contact info.
alter table companies
  add column signer_name text,
  add column signer_title text,
  add column phone text,
  add column email text;

-- Employees: split address for DIR eCPR, numeric apprentice level, deductions inline.
alter table employees
  add column city text,
  add column state text,
  add column zip text,
  add column deductions jsonb not null default '[]';
alter table employees
  alter column apprentice_level type integer using nullif(apprentice_level, '')::integer;
alter table employees
  add constraint employees_apprentice_level_range check (apprentice_level between 1 and 10);

-- Deductions now live on the employee row.
drop table employee_deductions;

-- Projects: wage determination number shown on certified payroll.
alter table projects add column wage_determination_number text;

-- Wage rates belong to a job; a stored determination record is optional.
alter table classification_rates
  alter column determination_id drop not null,
  add column project_id uuid references projects on delete cascade,
  add column craft text;
create index on classification_rates (project_id);

-- Check numbers per week and employee.
create table check_numbers (
  company_id uuid not null references companies on delete cascade,
  week_start date not null,
  employee_id uuid not null references employees on delete cascade,
  check_number text not null check (char_length(check_number) <= 20),
  primary key (company_id, week_start, employee_id)
);
alter table check_numbers enable row level security;
create policy member_all on check_numbers for all
  using (is_member(company_id)) with check (is_member(company_id));

-- A signed-in user creates their company and becomes its owner in one step.
create or replace function create_company(company_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  cid uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  insert into companies (name) values (company_name) returning id into cid;
  insert into company_members (company_id, user_id, role) values (cid, auth.uid(), 'owner');
  return cid;
end;
$$;
revoke execute on function create_company(text) from public, anon;
grant execute on function create_company(text) to authenticated;

revoke execute on function is_member(uuid) from public, anon;
grant execute on function is_member(uuid) to authenticated;
