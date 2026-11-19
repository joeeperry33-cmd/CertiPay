import type { SupabaseClient } from "@supabase/supabase-js";
import type { Classification, Company, Employee, Project, StoreData, StoredEntry } from "./types";
import { EMPTY_STORE } from "./types";
import type { Deduction } from "../payroll/net";

/**
 * Maps the app's data to the Supabase tables (supabase/migrations) and back,
 * and writes only what changed between two versions of the data.
 * Row level security limits every query to companies the user belongs to.
 */

type Row = Record<string, unknown>;

// ---------- app -> row ----------

export function companyToRow(c: Company): Row {
  return {
    name: c.name,
    address: c.address,
    fein: c.fein,
    dir_registration_number: c.dirRegistration,
    cslb_license: c.cslbLicense,
    signer_name: c.signerName ?? null,
    signer_title: c.signerTitle ?? null,
    phone: c.phone ?? null,
    email: c.email ?? null,
  };
}

export function employeeToRow(e: Employee, companyId: string): Row {
  return {
    id: e.id,
    company_id: companyId,
    first_name: e.firstName,
    last_name: e.lastName,
    ssn_last4: e.ssnLast4 || null,
    address: e.address || null,
    city: e.city || null,
    state: e.state || null,
    zip: e.zip || null,
    default_hourly_rate: e.regularRate,
    is_apprentice: e.isApprentice,
    apprentice_program: e.apprenticeProgram || null,
    apprentice_level: e.apprenticeLevel ?? null,
    w4_filing_status: e.w4.filingStatus,
    w4_step2_checkbox: e.w4.step2Checkbox,
    w4_step3_credits: e.w4.step3Credits,
    w4_step4a_other_income: e.w4.step4aOtherIncome,
    w4_step4b_deductions: e.w4.step4bDeductions,
    w4_step4c_extra: e.w4.step4cExtraWithholding,
    w4_exempt: !!e.w4.exempt,
    de4_filing_status: e.de4.filingStatus,
    de4_allowances: e.de4.allowances,
    de4_additional_allowances: e.de4.additionalAllowances,
    de4_extra: e.de4.extraWithholding,
    de4_exempt: !!e.de4.exempt,
    deductions: e.deductions,
  };
}

export function projectToRow(p: Project, companyId: string): Row {
  return {
    id: p.id,
    company_id: companyId,
    name: p.name,
    project_number: p.projectNumber || null,
    awarding_body: p.awardingBody || null,
    dir_project_id: p.dirProjectId || null,
    wage_determination_number: p.wageDeterminationNumber || null,
    county: p.county || null,
    location: p.location || null,
    is_prevailing_wage: p.isPrevailingWage,
    is_federal: p.isFederal,
  };
}

export function classificationToRow(c: Classification, companyId: string): Row {
  return {
    id: c.id,
    company_id: companyId,
    project_id: c.projectId,
    name: c.name,
    craft: c.craft || null,
    basic_hourly: c.basicHourly,
    fringe_health_welfare: c.fringe.healthWelfare,
    fringe_pension: c.fringe.pension,
    fringe_vacation_holiday: c.fringe.vacationHoliday,
    fringe_training: c.fringe.training,
    fringe_other: c.fringe.other,
    overtime_multiplier: c.overtimeMultiplier,
    double_time_multiplier: c.doubleTimeMultiplier,
    fringe_on_overtime_hours: c.fringeOnOvertimeHours,
  };
}

export function entryToRow(e: StoredEntry, companyId: string): Row {
  return {
    id: e.id,
    company_id: companyId,
    employee_id: e.employeeId,
    project_id: e.projectId,
    classification_id: e.classificationId,
    work_date: e.date,
    hours: e.hours,
    sort_order: e.sortOrder ?? 0,
  };
}

// ---------- row -> app ----------

const str = (v: unknown) => (v == null ? "" : String(v));
const num = (v: unknown) => (v == null ? 0 : Number(v));

export function companyFromRow(r: Row): Company {
  return {
    name: str(r.name),
    address: str(r.address),
    fein: str(r.fein),
    dirRegistration: str(r.dir_registration_number),
    cslbLicense: str(r.cslb_license),
    signerName: str(r.signer_name),
    signerTitle: str(r.signer_title),
    phone: str(r.phone),
    email: str(r.email),
  };
}

export function employeeFromRow(r: Row): Employee {
  return {
    id: str(r.id),
    firstName: str(r.first_name),
    lastName: str(r.last_name),
    ssnLast4: str(r.ssn_last4),
    address: str(r.address),
    city: str(r.city),
    state: str(r.state),
    zip: str(r.zip),
    regularRate: num(r.default_hourly_rate),
    isApprentice: !!r.is_apprentice,
    apprenticeProgram: str(r.apprentice_program),
    apprenticeLevel: r.apprentice_level == null ? undefined : num(r.apprentice_level),
    w4: {
      filingStatus: (str(r.w4_filing_status) || "single") as Employee["w4"]["filingStatus"],
      step2Checkbox: !!r.w4_step2_checkbox,
      step3Credits: num(r.w4_step3_credits),
      step4aOtherIncome: num(r.w4_step4a_other_income),
      step4bDeductions: num(r.w4_step4b_deductions),
      step4cExtraWithholding: num(r.w4_step4c_extra),
      exempt: !!r.w4_exempt,
    },
    de4: {
      filingStatus: (str(r.de4_filing_status) || "single") as Employee["de4"]["filingStatus"],
      allowances: num(r.de4_allowances),
      additionalAllowances: num(r.de4_additional_allowances),
      extraWithholding: num(r.de4_extra),
      exempt: !!r.de4_exempt,
    },
    deductions: (Array.isArray(r.deductions) ? r.deductions : []) as Deduction[],
  };
}

export function projectFromRow(r: Row): Project {
  return {
    id: str(r.id),
    name: str(r.name),
    projectNumber: str(r.project_number),
    awardingBody: str(r.awarding_body),
    dirProjectId: str(r.dir_project_id),
    wageDeterminationNumber: str(r.wage_determination_number),
    county: str(r.county),
    location: str(r.location),
    isPrevailingWage: !!r.is_prevailing_wage,
    isFederal: !!r.is_federal,
  };
}

export function classificationFromRow(r: Row): Classification {
  return {
    id: str(r.id),
    projectId: str(r.project_id),
    name: str(r.name),
    craft: str(r.craft),
    basicHourly: num(r.basic_hourly),
    fringe: {
      healthWelfare: num(r.fringe_health_welfare),
      pension: num(r.fringe_pension),
      vacationHoliday: num(r.fringe_vacation_holiday),
      training: num(r.fringe_training),
      other: num(r.fringe_other),
    },
    overtimeMultiplier: num(r.overtime_multiplier) || 1.5,
    doubleTimeMultiplier: num(r.double_time_multiplier) || 2,
    fringeOnOvertimeHours: r.fringe_on_overtime_hours !== false,
  };
}

export function entryFromRow(r: Row): StoredEntry {
  return {
    id: str(r.id),
    employeeId: str(r.employee_id),
    projectId: str(r.project_id),
    classificationId: r.classification_id == null ? null : str(r.classification_id),
    date: str(r.work_date),
    hours: num(r.hours),
    sortOrder: num(r.sort_order),
  };
}

// ---------- load and sync ----------

async function all(q: PromiseLike<{ data: Row[] | null; error: { message: string } | null }>) {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Load everything for one company. */
export async function loadCompany(sb: SupabaseClient, companyId: string): Promise<StoreData> {
  const [company, employees, projects, classes, entries, checks] = await Promise.all([
    all(sb.from("companies").select("*").eq("id", companyId)),
    all(sb.from("employees").select("*").eq("company_id", companyId).order("last_name")),
    all(sb.from("projects").select("*").eq("company_id", companyId).order("created_at")),
    all(sb.from("classification_rates").select("*").eq("company_id", companyId).not("project_id", "is", null).order("created_at")),
    all(sb.from("time_entries").select("*").eq("company_id", companyId).order("work_date").order("sort_order")),
    all(sb.from("check_numbers").select("*").eq("company_id", companyId)),
  ]);
  return {
    ...EMPTY_STORE,
    company: company[0] ? companyFromRow(company[0]) : EMPTY_STORE.company,
    employees: employees.map(employeeFromRow),
    projects: projects.map(projectFromRow),
    classifications: classes.map(classificationFromRow),
    entries: entries.map(entryFromRow),
    checkNumbers: Object.fromEntries(
      checks.map((c) => [`${str(c.week_start)}:${str(c.employee_id)}`, str(c.check_number)]),
    ),
  };
}

interface Diff<T> {
  upsert: T[];
  remove: string[];
}

/** Items added or changed (by id) and ids removed. Unchanged objects are skipped by reference or value. */
export function diffById<T extends { id: string }>(prev: T[], next: T[]): Diff<T> {
  const before = new Map(prev.map((x) => [x.id, x]));
  const after = new Set(next.map((x) => x.id));
  return {
    upsert: next.filter((x) => {
      const old = before.get(x.id);
      return !old || (old !== x && JSON.stringify(old) !== JSON.stringify(x));
    }),
    remove: prev.filter((x) => !after.has(x.id)).map((x) => x.id),
  };
}

async function run(q: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await q;
  if (error) throw new Error(error.message);
}

/** Write the changes between two versions of the data to Supabase. */
export async function syncChanges(sb: SupabaseClient, companyId: string, prev: StoreData, next: StoreData) {
  if (JSON.stringify(prev.company) !== JSON.stringify(next.company)) {
    await run(sb.from("companies").update(companyToRow(next.company)).eq("id", companyId));
  }

  const projects = diffById(prev.projects, next.projects);
  const employees = diffById(prev.employees, next.employees);
  const classes = diffById(prev.classifications, next.classifications);
  const entries = diffById(prev.entries, next.entries);

  // Parents first, then children.
  if (projects.upsert.length)
    await run(sb.from("projects").upsert(projects.upsert.map((p) => projectToRow(p, companyId))));
  if (employees.upsert.length)
    await run(sb.from("employees").upsert(employees.upsert.map((e) => employeeToRow(e, companyId))));
  if (classes.upsert.length)
    await run(sb.from("classification_rates").upsert(classes.upsert.map((c) => classificationToRow(c, companyId))));

  // Children removed before parents.
  if (entries.remove.length) await run(sb.from("time_entries").delete().in("id", entries.remove));
  if (entries.upsert.length)
    await run(sb.from("time_entries").upsert(entries.upsert.map((e) => entryToRow(e, companyId))));
  if (classes.remove.length) await run(sb.from("classification_rates").delete().in("id", classes.remove));
  if (employees.remove.length) await run(sb.from("employees").delete().in("id", employees.remove));
  if (projects.remove.length) await run(sb.from("projects").delete().in("id", projects.remove));

  const before = prev.checkNumbers ?? {};
  const after = next.checkNumbers ?? {};
  const changedChecks = Object.entries(after).filter(([k, v]) => before[k] !== v);
  const upserts = changedChecks.filter(([, v]) => v.trim() !== "");
  const clears = changedChecks.filter(([, v]) => v.trim() === "");
  if (upserts.length) {
    await run(
      sb.from("check_numbers").upsert(
        upserts.map(([k, v]) => {
          const [week_start, employee_id] = k.split(":");
          return { company_id: companyId, week_start, employee_id, check_number: v };
        }),
      ),
    );
  }
  for (const [k] of clears) {
    const [week_start, employee_id] = k.split(":");
    await run(
      sb.from("check_numbers").delete().eq("company_id", companyId).eq("week_start", week_start).eq("employee_id", employee_id),
    );
  }
}
