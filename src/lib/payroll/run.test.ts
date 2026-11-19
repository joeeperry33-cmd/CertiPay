import { describe, expect, it } from "vitest";
import { runWeek } from "./run";
import { sampleData } from "../store/sample";

describe("weekly payroll run", () => {
  const week = "2026-11-16";
  const run = runWeek(sampleData(week), week);

  it("pays everyone with time", () => {
    expect(run.employees.map((r) => r.employee.lastName)).toEqual(["Lopez", "Carter"]);
  });

  it("pays prevailing wage with cash fringe and daily overtime", () => {
    const maria = run.employees[0];
    // 42 hours: 40 straight + 2 overtime on the 10-hour Friday
    expect(maria.gross.totalHours).toBe(4200);
    // basic 38.50 x 40 + 57.75 x 2, plus cash fringe 22.15 x 42 (all fringe except
    // the 0.98 training contribution, paid on every hour)
    expect(maria.gross.grossPay).toBe(154000 + 11550 + 2215 * 42);
    expect(maria.gross.trainingContributions).toBe(98 * 42);
    expect(maria.net.netPay).toBe(maria.net.grossPay - maria.net.totalWithholding);
  });

  it("pays regular work at the employee's own rate with no fringe", () => {
    const james = run.employees[1];
    const regular = james.gross.lines.filter((l) => l.classificationName === "Regular");
    // Thursday regular day comes after 27 hours, 3 of which were daily OT; 8 hours straight
    expect(regular).toEqual([expect.objectContaining({ bucket: "straight", hours: 800, basicPay: 22400, cashFringePay: 0 })]);
  });

  it("ignores time outside the week", () => {
    expect(runWeek(sampleData(week), "2026-11-23").employees).toEqual([]);
  });
});
