-- CertiPay initial schema.
-- Multi-tenant: every row belongs to a company, and users only see companies
-- they are members of (row level security). Money is integer cents, hours are
-- integer hundredths of an hour.

create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  fein text,                         -- federal employer id
  ca_employer_account text,          -- CA EDD account number
  dir_registration_number text,      -- CA DIR public works contractor registration
  cslb_license text,                 -- CA contractor license
  address text,
  created_at timestamptz not null default now()
);

create table company_members (
  company_id uuid not null references companies on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'admin' check (role in ('owner', 'admin', 'viewer')),
  primary key (company_id, user_id)
);

create or replace function is_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from company_members where company_id = cid and user_id = auth.uid()
  );
$$;

create table employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies on delete cascade,
  first_name text not null,
  last_name text not null,
  ssn_last4 text,                    -- full SSN is not stored in the MVP
  address text,
  hire_date date,
  termination_date date,
  default_hourly_rate integer,       -- cents; for non-prevailing-wage work
  is_apprentice boolean not null default false,
  apprentice_program text,
  apprentice_level text,
  created_at timestamptz not null default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies on delete cascade,
  name text not null,
  project_number text,
  awarding_body text,
  dir_project_id text,               -- CA DIR project id (from PWC-100)
  location text,
  county text,
  is_prevailing_wage boolean not null default true,
  is_federal boolean not null default false, -- Davis-Bacon: needs WH-347
  bid_advertise_date date,           -- determines which wage determination applies
  start_date date,
  end_date date,
  created_at timestamptz not null default now()
);

-- A wage determination as published (CA DIR general determination or a
-- federal Davis-Bacon WD), tied to a county and an issue/expiration date.
create table wage_determinations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies on delete cascade,
  jurisdiction text not null default 'CA', -- 'CA', 'FED', later other states
  determination_number text not null,      -- e.g. "SC-23-102-2-2025-1"
  county text,
  issue_date date,
  expiration_date date,
  notes text,
  created_at timestamptz not null default now()
);

create table classification_rates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies on delete cascade,
  determination_id uuid not null references wage_determinations on delete cascade,
  name text not null,                      -- "Laborer Group 1", "Apprentice Period 3"
  basic_hourly integer not null,
  fringe_health_welfare integer not null default 0,
  fringe_pension integer not null default 0,
  fringe_vacation_holiday integer not null default 0,
  fringe_training integer not null default 0,
  fringe_other integer not null default 0,
  overtime_multiplier numeric(4,2) not null default 1.5,
  double_time_multiplier numeric(4,2) not null default 2.0,
  fringe_on_overtime_hours boolean not null default true,
  effective_date date,                     -- for predetermined increases
  created_at timestamptz not null default now()
);

create table project_classifications (
  project_id uuid not null references projects on delete cascade,
  classification_id uuid not null references classification_rates on delete cascade,
  company_id uuid not null references companies on delete cascade,
  primary key (project_id, classification_id)
);

-- Employer contributions per hour to approved benefit plans, credited
-- against required fringe. Per employee because plan enrollment varies.
create table fringe_credits (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies on delete cascade,
  employee_id uuid not null references employees on delete cascade,
  health_welfare integer not null default 0,
  pension integer not null default 0,
  vacation_holiday integer not null default 0,
  training integer not null default 0,
  other integer not null default 0,
  effective_date date not null default current_date
);

create table time_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies on delete cascade,
  employee_id uuid not null references employees on delete cascade,
  project_id uuid not null references projects on delete cascade,
  classification_id uuid references classification_rates, -- null = regular (non-PW) work
  work_date date not null,
  hours integer not null check (hours > 0 and hours <= 2400),
  sort_order integer not null default 0,   -- order worked within the day (for OT allocation)
  notes text,
  created_at timestamptz not null default now()
);

create table payroll_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies on delete cascade,
  week_start date not null,
  week_end date not null,
  pay_date date,
  payroll_number integer,                  -- certified payroll sequence number
  status text not null default 'draft' check (status in ('draft', 'final')),
  created_at timestamptz not null default now()
);

create table paychecks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies on delete cascade,
  payroll_run_id uuid not null references payroll_runs on delete cascade,
  employee_id uuid not null references employees,
  gross_pay integer not null,
  plan_contributions integer not null default 0,
  training_contributions integer not null default 0,
  deductions jsonb not null default '[]',  -- [{label, amount}]
  net_pay integer not null,
  check_number text
);

create table paycheck_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies on delete cascade,
  paycheck_id uuid not null references paychecks on delete cascade,
  project_id uuid not null references projects,
  classification_id uuid references classification_rates,
  work_date date not null,
  bucket text not null check (bucket in ('straight', 'overtime', 'double')),
  hours integer not null,
  basic_rate integer not null,
  cash_fringe_rate integer not null,
  basic_pay integer not null,
  cash_fringe_pay integer not null
);

-- Row level security: members of a company can read and write its rows.
do $$
declare t text;
begin
  foreach t in array array[
    'employees', 'projects', 'wage_determinations', 'classification_rates',
    'project_classifications', 'fringe_credits', 'time_entries',
    'payroll_runs', 'paychecks', 'paycheck_lines'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy member_all on %I for all using (is_member(company_id)) with check (is_member(company_id))',
      t
    );
    execute format('create index on %I (company_id)', t);
  end loop;
end $$;

alter table companies enable row level security;
create policy member_read on companies for select using (is_member(id));
create policy member_update on companies for update using (is_member(id));

alter table company_members enable row level security;
create policy self_read on company_members for select using (user_id = auth.uid());

create index on time_entries (employee_id, work_date);
