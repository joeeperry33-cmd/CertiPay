import { runWeek } from "../payroll/run";
import type { PayBucket } from "../payroll/types";
import type { Company, Employee, Project, StoreData } from "../store/types";
import { addDays, parseDate, weekDates } from "../dates";

/**
 * Data for one certified payroll report: one job, one workweek.
 * Covers what CA Labor Code 1776 / DIR form A-1-131 and the federal WH-347
 * ask for. Hours, rates and gross are for this job; deductions and net are for
 * the whole check, with gross from all work shown alongside (standard CPR practice).
 */

export interface CprWorkerRow {
  entryNumber: number; // same number for a worker across classifications
  employee: Employee;
  classification: string;
  isApprentice: boolean;
  /** Hours on this job per day, by pay type. Index matches `dates`. */
  hours: Record<PayBucket, number[]>;
  totalHours: Record<PayBucket, number>;
  rate: Record<PayBucket, number>; // basic hourly rate per pay type (cents)
  cashFringeRate: number; // per hour, paid in the check
  planFringeRate: number; // per hour, paid to approved plans
  trainingRate: number; // per hour, paid to a training fund
  grossThisJob: number;
  /** Only on a worker's first row; later rows for the same worker leave these empty. */
  check?: {
    grossAllWork: number;
    federalIncomeTax: number;
    socialSecurity: number;
    medicare: number;
    stateIncomeTax: number;
    sdi: number;
    other: { label: string; amount: number }[];
    totalDeductions: number;
    netPay: number;
  };
}

export interface CertifiedPayroll {
  company: Company;
  project: Project;
  weekStart: string;
  weekEnding: string;
  dates: string[];
  payrollNumber: number;
  rows: CprWorkerRow[];
  totals: { hours: number; grossThisJob: number; fringeToPlans: number; training: number };
  /** True when nobody worked on the job this week (file a statement of non-performance). */
  noWork: boolean;
}

const BUCKETS: PayBucket[] = ["straight", "overtime", "double"];

/**
 * Payroll number: weeks are numbered in order from the first week with work
 * on this job (week 1), counting weeks with no work too, since those need a
 * statement of non-performance under the same sequence. Returns 0 when no
 * work has been recorded on or before this week.
 */
export function payrollNumber(data: StoreData, projectId: string, weekStart: string): number {
  const start = parseDate(weekStart).getTime();
  let earliest = 1;
  for (const e of data.entries) {
    if (e.projectId !== projectId || e.hours <= 0) continue;
    const idx = Math.floor(Math.round((parseDate(e.date).getTime() - start) / 86_400_000) / 7);
    earliest = Math.min(earliest, idx);
  }
  return earliest > 0 ? 0 : 1 - earliest;
}

export function buildCertifiedPayroll(data: StoreData, projectId: string, weekStart: string): CertifiedPayroll {
  const project = data.projects.find((p) => p.id === projectId);
  if (!project) throw new Error("Job not found");
  const dates = weekDates(weekStart);
  const run = runWeek(data, weekStart);
  const rows: CprWorkerRow[] = [];
  let entryNumber = 0;

  for (const r of run.employees) {
    const lines = r.gross.lines.filter((l) => l.projectId === projectId);
    if (lines.length === 0) continue;
    entryNumber += 1;

    const byClass = new Map<string, typeof lines>();
    for (const l of lines) byClass.set(l.classificationId, [...(byClass.get(l.classificationId) ?? []), l]);

    let first = true;
    for (const [, cls] of byClass) {
      const hours = Object.fromEntries(BUCKETS.map((b) => [b, dates.map(() => 0)])) as CprWorkerRow["hours"];
      const rate = { straight: 0, overtime: 0, double: 0 };
      for (const l of cls) {
        hours[l.bucket][dates.indexOf(l.date)] += l.hours;
        rate[l.bucket] = l.basicRate;
      }
      const c = cls[0];
      const classification = data.classifications.find((x) => x.id === c.classificationId);
      // Show rates even for pay types not worked this week.
      if (classification) {
        rate.straight ||= classification.basicHourly;
        rate.overtime ||= Math.round(classification.basicHourly * classification.overtimeMultiplier);
        rate.double ||= Math.round(classification.basicHourly * classification.doubleTimeMultiplier);
      }
      const n = r.net;
      const other = n.deductions.map((d) => ({ label: d.label, amount: d.amount }));
      rows.push({
        entryNumber,
        employee: r.employee,
        classification: c.classificationName,
        isApprentice: r.employee.isApprentice,
        hours,
        totalHours: Object.fromEntries(
          BUCKETS.map((b) => [b, hours[b].reduce((s, h) => s + h, 0)]),
        ) as CprWorkerRow["totalHours"],
        rate,
        cashFringeRate: Math.max(...cls.map((l) => l.cashFringeRate)),
        planFringeRate: Math.max(...cls.map((l) => l.planRate)),
        trainingRate: classification?.fringe.training ?? 0,
        grossThisJob: cls.reduce((s, l) => s + l.basicPay + l.cashFringePay, 0),
        check: first
          ? {
              grossAllWork: n.grossPay,
              federalIncomeTax: n.federalIncomeTax,
              socialSecurity: n.socialSecurity,
              medicare: n.medicare,
              stateIncomeTax: n.caIncomeTax,
              sdi: n.caSdi,
              other,
              totalDeductions: n.totalWithholding,
              netPay: n.netPay,
            }
          : undefined,
      });
      first = false;
    }
  }

  const projectLines = run.employees.flatMap((r) => r.gross.lines.filter((l) => l.projectId === projectId));
  return {
    company: data.company,
    project,
    weekStart,
    weekEnding: addDays(weekStart, 6),
    dates,
    payrollNumber: payrollNumber(data, projectId, weekStart),
    rows,
    totals: {
      hours: projectLines.reduce((s, l) => s + l.hours, 0),
      grossThisJob: rows.reduce((s, r) => s + r.grossThisJob, 0),
      fringeToPlans: projectLines.reduce((s, l) => s + l.planContributions, 0),
      training: projectLines.reduce((s, l) => s + l.trainingContribution, 0),
    },
    noWork: rows.length === 0,
  };
}
