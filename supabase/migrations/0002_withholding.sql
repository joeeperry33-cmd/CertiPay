-- Withholding elections (federal W-4 2020+, California DE 4) and tax columns.

alter table employees
  add column pay_frequency text not null default 'weekly'
    check (pay_frequency in ('weekly', 'biweekly', 'semimonthly', 'monthly')),
  add column w4_filing_status text not null default 'single'
    check (w4_filing_status in ('single', 'married_jointly', 'head_of_household')),
  add column w4_step2_checkbox boolean not null default false,
  add column w4_step3_credits integer not null default 0,         -- annual, cents
  add column w4_step4a_other_income integer not null default 0,   -- annual, cents
  add column w4_step4b_deductions integer not null default 0,     -- annual, cents
  add column w4_step4c_extra integer not null default 0,          -- per period, cents
  add column w4_exempt boolean not null default false,
  add column de4_filing_status text not null default 'single'
    check (de4_filing_status in ('single', 'married', 'head_of_household')),
  add column de4_allowances integer not null default 0,
  add column de4_additional_allowances integer not null default 0,
  add column de4_extra integer not null default 0,                -- per period, cents
  add column de4_exempt boolean not null default false;

-- Recurring deductions per employee (union dues, 401(k), garnishments, etc.)
create table employee_deductions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies on delete cascade,
  employee_id uuid not null references employees on delete cascade,
  label text not null,
  amount integer not null,           -- cents per pay period
  pre_tax_income boolean not null default false,
  pre_tax_fica boolean not null default false,
  active boolean not null default true
);
alter table employee_deductions enable row level security;
create policy member_all on employee_deductions for all
  using (is_member(company_id)) with check (is_member(company_id));
create index on employee_deductions (company_id);

alter table paychecks
  add column federal_income_tax integer not null default 0,
  add column social_security integer not null default 0,
  add column medicare integer not null default 0,
  add column ca_income_tax integer not null default 0,
  add column ca_sdi integer not null default 0;
