import type { CertifiedPayroll, CprWorkerRow } from "./certified";
import type { Classification, Employee } from "../store/types";

/**
 * California DIR eCPR XML, schema version 2.0 (October 2026).
 * Element names and order follow DIR's V2 blank template and eCPR-v2.xsd:
 * https://www.dir.ca.gov/Public-Works/CPR/eCPR-XML-Guidelines-V2.pdf
 * https://www.dir.ca.gov/Public-Works/CPR/eCPR-v2.xsd
 *
 * Interpretations where DIR's documents are silent (confirm on first upload):
 *  - Fringe amounts are per-hour rates from the wage determination.
 *  - totalHrlyPayRate* = basic rate for that pay type + all fringe per hour
 *    (fringe is paid on overtime hours under most CA determinations).
 *  - Deductions are weekly dollar totals; FICA = Social Security + Medicare.
 *  - Deductions labeled "dues"/"union" go in <dues>; 401(k)/savings in <savings>;
 *    everything else in <other>.
 */

export const ECPR_NAMESPACE = "https://www.dir.ca.gov/Public-Works/CPR/eCPR-v2.xsd";

export interface EcprInput {
  report: CertifiedPayroll;
  classifications: Classification[];
  /** Full 9-digit SSN or ITIN per employee id. Never stored; entered at export. */
  taxIds: Record<string, { ssn?: string; itin?: string }>;
  checkNumbers: Record<string, string>; // by employee id
}

export interface EcprResult {
  xml: string;
  errors: string[];
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** Cents -> "12.34". */
const dollars = (cents: number) => (cents / 100).toFixed(2);
/** Hundredths of an hour -> "8.00". */
const hours = (h: number) => (h / 100).toFixed(2);

class Xml {
  private out: string[] = [];
  private depth = 0;
  open(tag: string, attrs: Record<string, string> = {}) {
    const a = Object.entries(attrs)
      .map(([k, v]) => ` ${k}="${esc(v)}"`)
      .join("");
    this.out.push(`${"  ".repeat(this.depth)}<CPR:${tag}${a}>`);
    this.depth++;
  }
  close(tag: string) {
    this.depth--;
    this.out.push(`${"  ".repeat(this.depth)}</CPR:${tag}>`);
  }
  leaf(tag: string, value: string, attrs: Record<string, string> = {}) {
    const a = Object.entries(attrs)
      .map(([k, v]) => ` ${k}="${esc(v)}"`)
      .join("");
    this.out.push(
      value === ""
        ? `${"  ".repeat(this.depth)}<CPR:${tag}${a}/>`
        : `${"  ".repeat(this.depth)}<CPR:${tag}${a}>${esc(value)}</CPR:${tag}>`,
    );
  }
  raw(line: string) {
    this.out.push(line);
  }
  toString() {
    return this.out.join("\n") + "\n";
  }
}

function deductionBuckets(other: { label: string; amount: number }[]) {
  let dues = 0;
  let savings = 0;
  let rest = 0;
  for (const d of other) {
    if (/dues|union/i.test(d.label)) dues += d.amount;
    else if (/401|403|savings|ira\b|retire/i.test(d.label)) savings += d.amount;
    else rest += d.amount;
  }
  return { dues, savings, other: rest };
}

/** Build the eCPR XML and list every problem that would make DIR reject it. */
export function buildEcprXml(input: EcprInput): EcprResult {
  const { report: r, classifications, taxIds, checkNumbers } = input;
  const errors: string[] = [];

  const pwcr = r.company.dirRegistration.replace(/\D/g, "");
  if (!/^\d{10}$/.test(pwcr)) errors.push("Company DIR registration number must be 10 digits (Company page).");
  const projectID = r.project.dirProjectId.replace(/\D/g, "");
  if (!/^\d{1,18}$/.test(projectID)) errors.push(`DIR project ID for "${r.project.name}" must be a number (Jobs page).`);
  const contractorName = r.company.name.trim();
  if (contractorName.length < 1 || contractorName.length > 56)
    errors.push("Company name is required and must be 56 characters or fewer (Company page).");

  const w = new Xml();
  w.raw('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
  w.raw(`<CPR:eCPR xmlns:CPR="${ECPR_NAMESPACE}">`);
  const inner = new Xml();
  inner.open("__root__");
  inner.leaf("version", "2.0");
  inner.open("contractorInfo");
  inner.leaf("contractorName", contractorName.slice(0, 56));
  inner.leaf("contractorPWCR", pwcr);
  inner.close("contractorInfo");
  inner.open("projectInfo");
  if (r.project.awardingBody) inner.leaf("awardingBody", r.project.awardingBody.slice(0, 56));
  inner.leaf("projectID", projectID);
  inner.close("projectInfo");
  inner.open("payrollInfo");
  inner.leaf("statementOfNP", r.noWork ? "true" : "false");
  inner.leaf("forWeekEnding", r.weekEnding);
  inner.leaf("payrollNum", "");
  inner.leaf("amendmentNum", "");
  inner.open("employees");

  if (!r.noWork) {
    const byEmployee = new Map<string, CprWorkerRow[]>();
    for (const row of r.rows) byEmployee.set(row.employee.id, [...(byEmployee.get(row.employee.id) ?? []), row]);
    if (byEmployee.size > 500) errors.push("DIR accepts at most 500 employees per file.");

    const seenIds = new Set<string>();
    const dailyTotals = r.dates.map(() => new Map<string, number>());

    for (const [employeeId, rows] of byEmployee) {
      const e = rows[0].employee;
      const who = `${e.firstName} ${e.lastName}`;
      const check = rows.find((row) => row.check)?.check;
      const ids = taxIds[employeeId] ?? {};
      const ssn = (ids.ssn ?? "").replace(/\D/g, "");
      const itin = (ids.itin ?? "").replace(/\D/g, "");
      if (!/^\d{9}$/.test(ssn) && !/^\d{9}$/.test(itin)) errors.push(`${who}: enter the full 9-digit SSN or ITIN.`);
      const key = ssn || itin;
      if (key && seenIds.has(key)) errors.push(`${who}: SSN/ITIN is the same as another employee's.`);
      seenIds.add(key);
      employeeErrors(e, who, errors);
      const checkNum = (checkNumbers[employeeId] ?? "").trim();
      if (checkNum.length < 1 || checkNum.length > 20) errors.push(`${who}: enter a check number (or CASH), up to 20 characters.`);

      inner.open("employee");
      inner.leaf("firstName", e.firstName.trim().slice(0, 56));
      inner.leaf("lastName", e.lastName.trim().slice(0, 56));
      inner.leaf("middleName", "");
      inner.open("address");
      inner.leaf("street", (e.address ?? "").trim().slice(0, 40));
      inner.leaf("city", (e.city ?? "").trim().slice(0, 250));
      inner.leaf("state", (e.state ?? "").trim().toUpperCase());
      inner.leaf("zip", (e.zip ?? "").trim());
      inner.close("address");
      inner.leaf("ssn", /^\d{9}$/.test(ssn) ? ssn : "");
      inner.leaf("itin", /^\d{9}$/.test(itin) ? itin : "");
      inner.leaf("notes", "");
      inner.open("classifications");

      for (const row of rows) {
        const cls = classifications.find((c) => c.name === row.classification && c.projectId === r.project.id);
        const fringe = cls?.fringe ?? { healthWelfare: 0, vacationHoliday: 0, pension: 0, training: 0, other: 0 };
        const totalFringe = fringe.healthWelfare + fringe.vacationHoliday + fringe.pension + fringe.training + fringe.other;
        const fringeOnOT = cls?.fringeOnOvertimeHours ?? true;
        const craft = (cls?.craft || row.classification).trim();

        inner.open("classification", { name: row.classification });
        inner.leaf("craft", craft.slice(0, 100));
        inner.leaf("employeeLevel", row.isApprentice ? "apprentice" : "journeyman");
        inner.leaf("apprenticeLevel", row.isApprentice && e.apprenticeLevel ? String(e.apprenticeLevel) : "");
        inner.open("hrsWorkedEachDay");
        r.dates.forEach((date, i) => {
          const st = row.hours.straight[i];
          const ot = row.hours.overtime[i];
          const dt = row.hours.double[i];
          const day = dailyTotals[i];
          day.set(employeeId, (day.get(employeeId) ?? 0) + st + ot + dt);
          inner.open("day", { id: String(i + 1) });
          inner.leaf("date", date);
          inner.leaf("straightTime", hours(st));
          inner.leaf("overtime", hours(ot));
          inner.leaf("doubletime", hours(dt));
          inner.close("day");
        });
        inner.close("hrsWorkedEachDay");
        inner.open("fringePaid");
        const toEmployee = row.cashFringeRate > 0;
        const toPlan = row.planFringeRate > 0 || row.trainingRate > 0;
        inner.leaf("paidToEmployee", String(toEmployee || !toPlan));
        inner.leaf("paidToBenefitPlan", String(toPlan));
        inner.close("fringePaid");
        inner.open("fringe");
        inner.leaf("healthWelfare", dollars(fringe.healthWelfare));
        inner.leaf("vacationHoliday", dollars(fringe.vacationHoliday));
        inner.leaf("pension", dollars(fringe.pension));
        inner.leaf("training", dollars(fringe.training));
        inner.leaf("other", dollars(fringe.other));
        inner.close("fringe");
        inner.open("totHrs");
        inner.leaf("totHrsStraightTime", hours(row.totalHours.straight));
        inner.leaf("totHrsOvertime", hours(row.totalHours.overtime));
        inner.leaf("totHrsDoubletime", hours(row.totalHours.double));
        inner.close("totHrs");
        inner.open("hrlyPayRate");
        if (row.rate.straight <= 0) errors.push(`${who} (${row.classification}): straight-time rate must be above $0.`);
        inner.leaf("hrlyPayRateStraightTime", dollars(row.rate.straight));
        inner.leaf("hrlyPayRateOvertime", dollars(row.rate.overtime));
        inner.leaf("hrlyPayRateDoubletime", dollars(row.rate.double));
        inner.leaf("totalHrlyPayRateStraightTime", dollars(row.rate.straight + totalFringe));
        inner.leaf("totalHrlyPayRateOvertime", dollars(row.rate.overtime + (fringeOnOT ? totalFringe : 0)));
        inner.leaf("totalHrlyPayRateDoubletime", dollars(row.rate.double + (fringeOnOT ? totalFringe : 0)));
        inner.close("hrlyPayRate");
        inner.close("classification");
      }
      inner.close("classifications");

      inner.open("payments");
      inner.leaf("travelSubs", "0.00");
      inner.close("payments");

      const c = check ?? {
        grossAllWork: 0,
        federalIncomeTax: 0,
        socialSecurity: 0,
        medicare: 0,
        stateIncomeTax: 0,
        sdi: 0,
        other: [],
        totalDeductions: 0,
        netPay: 0,
      };
      const b = deductionBuckets(c.other);
      const parts = [c.federalIncomeTax, c.socialSecurity + c.medicare, c.stateIncomeTax, c.sdi, 0, b.savings, b.dues, b.other];
      inner.open("deductions");
      inner.leaf("fedTax", dollars(c.federalIncomeTax));
      inner.leaf("FICA", dollars(c.socialSecurity + c.medicare));
      inner.leaf("stateTax", dollars(c.stateIncomeTax));
      inner.leaf("SDI", dollars(c.sdi));
      inner.leaf("fundAdmin", "0.00");
      inner.leaf("savings", dollars(b.savings));
      inner.leaf("dues", dollars(b.dues));
      inner.leaf("other", dollars(b.other));
      inner.leaf("totalDeductions", dollars(parts.reduce((s, v) => s + v, 0)));
      inner.close("deductions");

      inner.open("earnings");
      inner.leaf("grossThisProject", dollars(rows.reduce((s, row) => s + row.grossThisJob, 0)));
      inner.leaf("grossAllWork", dollars(c.grossAllWork));
      inner.leaf("netWagePaidWeek", dollars(Math.max(0, c.netPay)));
      inner.leaf("checkNum", checkNum.slice(0, 20));
      inner.close("earnings");
      if (c.netPay < 0) errors.push(`${who}: deductions are more than gross pay.`);

      inner.close("employee");
    }

    dailyTotals.forEach((m, i) => {
      for (const [id, h] of m) {
        if (h > 2400) {
          const e = r.rows.find((row) => row.employee.id === id)!.employee;
          errors.push(`${e.firstName} ${e.lastName}: more than 24 hours on ${r.dates[i]}.`);
        }
      }
    });
  }

  inner.close("employees");
  inner.close("payrollInfo");
  inner.close("__root__");

  // Drop the synthetic root wrapper lines and keep the indentation of its children.
  const innerLines = inner.toString().trimEnd().split("\n").slice(1, -1);
  const xml = [w.toString().trimEnd(), ...innerLines, "</CPR:eCPR>"].join("\n") + "\n";
  return { xml, errors };
}

function employeeErrors(e: Employee, who: string, errors: string[]) {
  if (!e.firstName.trim() || !e.lastName.trim()) errors.push(`${who}: first and last name are required.`);
  if (!e.address?.trim()) errors.push(`${who}: street address is required.`);
  else if (e.address.trim().length > 40) errors.push(`${who}: street address must be 40 characters or fewer.`);
  if (!e.city?.trim()) errors.push(`${who}: city is required.`);
  if (!/^[A-Za-z]{2}$/.test(e.state?.trim() ?? "")) errors.push(`${who}: state must be a 2-letter code.`);
  if (!/^\d{5}(-\d{4})?$/.test(e.zip?.trim() ?? "")) errors.push(`${who}: ZIP must be 12345 or 12345-6789.`);
  if (e.isApprentice && !(e.apprenticeLevel && e.apprenticeLevel >= 1 && e.apprenticeLevel <= 10))
    errors.push(`${who}: apprentice level (1-10) is required for apprentices.`);
}
