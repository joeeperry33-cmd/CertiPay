import { describe, expect, it } from "vitest";
import { buildCertifiedPayroll, payrollNumber } from "./certified";
import { sampleData } from "../store/sample";
import { addDays } from "../dates";

const week = "2026-11-16";

describe("certified payroll report data", () => {
  const data = sampleData(week);
  const cpr = buildCertifiedPayroll(data, "p1", week);

  it("lists each worker on the job with a stable entry number", () => {
    expect(cpr.rows.map((r) => [r.entryNumber, r.employee.lastName, r.classification])).toEqual([
      [1, "Lopez", "Laborer Group 1"],
      [2, "Carter", "Operating Engineer Group 8"],
    ]);
    expect(cpr.weekEnding).toBe("2026-11-22");
  });

  it("splits daily hours into straight time and overtime", () => {
    const maria = cpr.rows[0];
    expect(maria.hours.straight).toEqual([800, 800, 800, 800, 800, 0, 0]);
    expect(maria.hours.overtime).toEqual([0, 0, 0, 0, 200, 0, 0]);
    expect(maria.totalHours).toEqual({ straight: 4000, overtime: 200, double: 0 });
    expect(maria.rate).toEqual({ straight: 3850, overtime: 5775, double: 7700 });
  });

  it("shows gross for this job and for all work separately", () => {
    const james = cpr.rows[1];
    // James also worked 8 regular hours on the shop job ($224)
    expect(james.check!.grossAllWork - james.grossThisJob).toBe(22400);
    expect(james.check!.netPay).toBe(james.check!.grossAllWork - james.check!.totalDeductions);
  });

  it("excludes jobs not on this report", () => {
    expect(buildCertifiedPayroll(data, "p2", week).rows.map((r) => r.employee.lastName)).toEqual(["Carter"]);
  });

  it("numbers payrolls by week of work on the job", () => {
    const twoWeeks = {
      ...data,
      entries: [
        ...data.entries,
        { id: "x", employeeId: "e1", projectId: "p1", classificationId: "c1", date: addDays(week, 14), hours: 800 },
      ],
    };
    expect(payrollNumber(twoWeeks, "p1", week)).toBe(1);
    expect(payrollNumber(twoWeeks, "p1", addDays(week, 7))).toBe(2); // no work: next number
    expect(payrollNumber(twoWeeks, "p1", addDays(week, 14))).toBe(3);
    expect(buildCertifiedPayroll(twoWeeks, "p1", addDays(week, 7)).noWork).toBe(true);
  });
});

describe("payroll number before any work", () => {
  it("is 0 so no report is due", () => {
    expect(payrollNumber(sampleData(week), "p1", addDays(week, -7))).toBe(0);
  });
});
