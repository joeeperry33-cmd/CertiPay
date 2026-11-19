import { computeGross, type GrossResult } from "./gross";
import { computeNetPay, type NetPayResult } from "./net";
import { applyCaliforniaOvertime } from "./overtime/california";
import type { ClassificationRate, TimeEntry } from "./types";
import type { Employee, StoreData } from "../store/types";
import { weekDates } from "../dates";

export interface EmployeePayroll {
  employee: Employee;
  gross: GrossResult;
  net: NetPayResult;
}

export interface WeekPayroll {
  weekStart: string;
  dates: string[];
  employees: EmployeePayroll[];
  totals: { gross: number; net: number; taxes: number; hours: number };
}

const regularId = (employeeId: string) => `regular:${employeeId}`;

/** Run one weekly payroll from stored data. Entries keep the order they were entered within a day. */
export function runWeek(data: StoreData, weekStart: string): WeekPayroll {
  const dates = weekDates(weekStart);
  const rates = new Map<string, ClassificationRate>(data.classifications.map((c) => [c.id, c]));
  const results: EmployeePayroll[] = [];

  for (const employee of data.employees) {
    const entries: TimeEntry[] = data.entries
      .filter((e) => e.employeeId === employee.id && dates.includes(e.date) && e.hours > 0)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((e) => ({
        date: e.date,
        projectId: e.projectId,
        classificationId: e.classificationId ?? regularId(employee.id),
        hours: e.hours,
      }));
    if (entries.length === 0) continue;

    rates.set(regularId(employee.id), {
      id: regularId(employee.id),
      name: "Regular",
      basicHourly: employee.regularRate,
      fringe: { healthWelfare: 0, pension: 0, vacationHoliday: 0, training: 0, other: 0 },
      overtimeMultiplier: 1.5,
      doubleTimeMultiplier: 2,
      fringeOnOvertimeHours: false,
    });

    const gross = computeGross(applyCaliforniaOvertime(entries, dates), rates);
    const net = computeNetPay({
      grossPay: gross.grossPay,
      payPeriodsPerYear: 52,
      ytdFicaWages: 0, // TODO: year-to-date from prior finalized payrolls
      w4: employee.w4,
      de4: employee.de4,
      deductions: employee.deductions,
    });
    results.push({ employee, gross, net });
  }

  return {
    weekStart,
    dates,
    employees: results,
    totals: {
      gross: results.reduce((s, r) => s + r.net.grossPay, 0),
      net: results.reduce((s, r) => s + r.net.netPay, 0),
      taxes: results.reduce(
        (s, r) => s + r.net.federalIncomeTax + r.net.caIncomeTax + r.net.socialSecurity + r.net.medicare + r.net.caSdi,
        0,
      ),
      hours: results.reduce((s, r) => s + r.gross.totalHours, 0),
    },
  };
}
