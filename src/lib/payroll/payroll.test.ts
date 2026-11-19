import { describe, expect, it } from "vitest";
import { applyCaliforniaOvertime } from "./overtime/california";
import { computeGross } from "./gross";
import type { ClassificationRate, TimeEntry } from "./types";

const WEEK = [
  "2026-11-16",
  "2026-11-17",
  "2026-11-18",
  "2026-11-19",
  "2026-11-20",
  "2026-11-21",
  "2026-11-22",
];

const entry = (date: string, hours: number, cls = "lab1", projectId = "p1"): TimeEntry => ({
  date,
  projectId,
  classificationId: cls,
  hours: Math.round(hours * 100),
});

const totals = (entries: ReturnType<typeof applyCaliforniaOvertime>) =>
  entries.reduce(
    (acc, e) => ({ ...acc, [e.bucket]: (acc[e.bucket] ?? 0) + e.hours }),
    {} as Record<string, number>,
  );

describe("California overtime", () => {
  it("pays a normal 8x5 week as straight time", () => {
    const out = applyCaliforniaOvertime(WEEK.slice(0, 5).map((d) => entry(d, 8)), WEEK);
    expect(totals(out)).toEqual({ straight: 4000 });
  });

  it("splits a 13-hour day into 8 ST, 4 OT, 1 DT", () => {
    const out = applyCaliforniaOvertime([entry(WEEK[0], 13)], WEEK);
    expect(totals(out)).toEqual({ straight: 800, overtime: 400, double: 100 });
  });

  it("puts straight hours over 40 in the week into overtime", () => {
    // 6 days x 8 hours = 48 hours; Saturday's 8 go to OT.
    const out = applyCaliforniaOvertime(WEEK.slice(0, 6).map((d) => entry(d, 8)), WEEK);
    expect(totals(out)).toEqual({ straight: 4000, overtime: 800 });
  });

  it("applies 7th consecutive day rules", () => {
    const entries = WEEK.slice(0, 6).map((d) => entry(d, 6));
    entries.push(entry(WEEK[6], 10));
    const out = applyCaliforniaOvertime(entries, WEEK);
    // 36 ST from first six days, 7th day: 8 OT + 2 DT
    expect(totals(out)).toEqual({ straight: 3600, overtime: 800, double: 200 });
  });

  it("gives overtime to the last job worked that day", () => {
    const out = applyCaliforniaOvertime(
      [entry(WEEK[0], 6, "lab1", "p1"), entry(WEEK[0], 4, "op1", "p2")],
      WEEK,
    );
    expect(out).toEqual([
      expect.objectContaining({ projectId: "p1", bucket: "straight", hours: 600 }),
      expect.objectContaining({ projectId: "p2", bucket: "straight", hours: 200 }),
      expect.objectContaining({ projectId: "p2", bucket: "overtime", hours: 200 }),
    ]);
  });
});

describe("gross pay with fringe", () => {
  const laborer: ClassificationRate = {
    id: "lab1",
    name: "Laborer Group 1",
    basicHourly: 4000, // $40.00
    fringe: { healthWelfare: 900, pension: 800, vacationHoliday: 500, training: 100, other: 50 },
    overtimeMultiplier: 1.5,
    doubleTimeMultiplier: 2,
    fringeOnOvertimeHours: true,
  };
  const rates = new Map([[laborer.id, laborer]]);

  it("pays all fringe in cash when the employer has no plans", () => {
    const out = computeGross(applyCaliforniaOvertime([entry(WEEK[0], 10)], WEEK), rates);
    // ST 8h @ 40 = 320, OT 2h @ 60 = 120, cash fringe 22.50 x 10 = 225
    expect(out.grossPay).toBe(32000 + 12000 + 22500);
    expect(out.trainingContributions).toBe(1000);
    expect(out.planContributions).toBe(0);
  });

  it("credits plan contributions against required fringe, capped per component", () => {
    const out = computeGross(applyCaliforniaOvertime([entry(WEEK[0], 8)], WEEK), rates, {
      healthWelfare: 1200, // more than required 9.00, capped
      pension: 400,
      vacationHoliday: 0,
      training: 0,
      other: 0,
    });
    // credited 9.00 + 4.00 = 13.00; cash fringe 22.50 - 13.00 = 9.50
    expect(out.planContributions).toBe(1300 * 8);
    expect(out.grossPay).toBe(32000 + 950 * 8);
  });
});
