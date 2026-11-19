import type { StoreData } from "./types";
import { addDays } from "../dates";

/** Made-up sample data for trying the app. Rates are illustrative, not a real determination. */
export function sampleData(weekStart: string): StoreData {
  const d = (n: number) => addDays(weekStart, n);
  const w4 = {
    filingStatus: "single" as const,
    step2Checkbox: false,
    step3Credits: 0,
    step4aOtherIncome: 0,
    step4bDeductions: 0,
    step4cExtraWithholding: 0,
  };
  const de4 = { filingStatus: "single" as const, allowances: 1, additionalAllowances: 0, extraWithholding: 0 };
  const rate = {
    overtimeMultiplier: 1.5,
    doubleTimeMultiplier: 2,
    fringeOnOvertimeHours: true,
  };

  return {
    version: 1,
    company: {
      name: "Sample Construction Inc.",
      address: "100 Main St, Fresno, CA 93721",
      fein: "00-0000000",
      dirRegistration: "1000000000",
      cslbLicense: "000000",
      signerName: "Pat Sample",
      signerTitle: "President",
      phone: "(559) 555-0100",
    },
    employees: [
      {
        id: "e1",
        firstName: "Maria",
        lastName: "Lopez",
        ssnLast4: "1234",
        address: "12 Oak St",
        city: "Fresno",
        state: "CA",
        zip: "93701",
        regularRate: 3000,
        isApprentice: false,
        w4,
        de4,
        deductions: [{ label: "Union dues", amount: 2500, preTaxIncome: false, preTaxFica: false }],
      },
      {
        id: "e2",
        firstName: "James",
        lastName: "Carter",
        ssnLast4: "5678",
        address: "45 Pine Ave",
        city: "Clovis",
        state: "CA",
        zip: "93612",
        regularRate: 2800,
        isApprentice: false,
        w4: { ...w4, filingStatus: "married_jointly", step3Credits: 400_000 },
        de4: { ...de4, filingStatus: "married", allowances: 3 },
        deductions: [],
      },
    ],
    projects: [
      {
        id: "p1",
        name: "Elm Street School Modernization",
        projectNumber: "24-017",
        awardingBody: "Sample Unified School District",
        dirProjectId: "0000000",
        wageDeterminationNumber: "FRE-2025-1 (sample)",
        county: "Fresno",
        location: "500 Elm St, Fresno, CA",
        isPrevailingWage: true,
        isFederal: false,
      },
      {
        id: "p2",
        name: "Shop and yard",
        projectNumber: "",
        awardingBody: "",
        dirProjectId: "",
        county: "Fresno",
        location: "",
        isPrevailingWage: false,
        isFederal: false,
      },
    ],
    classifications: [
      {
        id: "c1",
        projectId: "p1",
        name: "Laborer Group 1",
        craft: "Laborer and Related Classifications",
        basicHourly: 3850,
        fringe: { healthWelfare: 865, pension: 835, vacationHoliday: 410, training: 98, other: 105 },
        ...rate,
      },
      {
        id: "c2",
        projectId: "p1",
        name: "Operating Engineer Group 8",
        craft: "Operating Engineer",
        basicHourly: 5525,
        fringe: { healthWelfare: 1290, pension: 1205, vacationHoliday: 450, training: 120, other: 85 },
        ...rate,
      },
    ],
    entries: [
      ...[0, 1, 2, 3].map((n) => ({ id: `m${n}`, employeeId: "e1", projectId: "p1", classificationId: "c1", date: d(n), hours: 800 })),
      { id: "m4", employeeId: "e1", projectId: "p1", classificationId: "c1", date: d(4), hours: 1000 },
      ...[0, 1, 2].map((n) => ({ id: `j${n}`, employeeId: "e2", projectId: "p1", classificationId: "c2", date: d(n), hours: 900 })),
      { id: "j3", employeeId: "e2", projectId: "p2", classificationId: null, date: d(3), hours: 800 },
      { id: "j4", employeeId: "e2", projectId: "p1", classificationId: "c2", date: d(4), hours: 600 },
    ],
  };
}
