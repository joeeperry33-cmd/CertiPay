import { type Bracket, fromBrackets, toCents, toDollars } from "./brackets";
import type { Cents } from "../types";

/**
 * Federal income tax withholding, IRS Pub 15-T (2026), Worksheet 1A
 * (percentage method for automated payroll systems), Form W-4 2020 or later.
 *
 * Source: https://www.irs.gov/pub/irs-pdf/p15t.pdf
 * Married filing jointly rows were read from the publication. Single/MFS and
 * Head of Household rows were taken from a mirror of the publication and
 * cross-checked against the 2026 brackets and standard deductions
 * (single $16,100, HoH $24,150, minus the $8,600 line 1g amount). Recheck
 * every row against the PDF when a new year's Pub 15-T is published.
 */

export type FederalFilingStatus = "single" | "married_jointly" | "head_of_household";

export interface FederalW4 {
  filingStatus: FederalFilingStatus;
  step2Checkbox: boolean; // multiple jobs / spouse works
  step3Credits: Cents; // annual dependent credits
  step4aOtherIncome: Cents; // annual
  step4bDeductions: Cents; // annual
  step4cExtraWithholding: Cents; // per pay period
  exempt?: boolean;
}

const row = (over: number, base: number, rate: number): Bracket => ({ over, base, rate });

const TABLES_2026: Record<FederalFilingStatus, { standard: Bracket[]; checkbox: Bracket[] }> = {
  married_jointly: {
    standard: [
      row(0, 0, 0),
      row(19_300, 0, 0.1),
      row(44_100, 2_480, 0.12),
      row(120_100, 11_600, 0.22),
      row(230_700, 35_932, 0.24),
      row(422_850, 82_048, 0.32),
      row(531_750, 116_896, 0.35),
      row(788_000, 206_583.5, 0.37),
    ],
    checkbox: [
      row(0, 0, 0),
      row(16_100, 0, 0.1),
      row(28_500, 1_240, 0.12),
      row(66_500, 5_800, 0.22),
      row(121_800, 17_966, 0.24),
      row(217_875, 41_024, 0.32),
      row(272_325, 58_448, 0.35),
      row(400_450, 103_291.75, 0.37),
    ],
  },
  single: {
    standard: [
      row(0, 0, 0),
      row(7_500, 0, 0.1),
      row(19_900, 1_240, 0.12),
      row(57_900, 5_800, 0.22),
      row(113_200, 17_966, 0.24),
      row(209_275, 41_024, 0.32),
      row(263_725, 58_448, 0.35),
      row(648_100, 192_979.25, 0.37),
    ],
    checkbox: [
      row(0, 0, 0),
      row(8_050, 0, 0.1),
      row(14_250, 620, 0.12),
      row(33_250, 2_900, 0.22),
      row(60_900, 8_983, 0.24),
      row(108_938, 20_512, 0.32),
      row(136_163, 29_224, 0.35),
      row(328_350, 96_489.63, 0.37),
    ],
  },
  head_of_household: {
    standard: [
      row(0, 0, 0),
      row(15_550, 0, 0.1),
      row(33_250, 1_770, 0.12),
      row(83_000, 7_740, 0.22),
      row(121_250, 16_155, 0.24),
      row(217_300, 39_207, 0.32),
      row(271_750, 56_631, 0.35),
      row(656_150, 191_171, 0.37),
    ],
    checkbox: [
      row(0, 0, 0),
      row(12_075, 0, 0.1),
      row(20_925, 885, 0.12),
      row(45_800, 3_870, 0.22),
      row(64_925, 8_077.5, 0.24),
      row(112_950, 19_603.5, 0.32),
      row(140_175, 28_315.5, 0.35),
      row(332_375, 95_585.5, 0.37),
    ],
  },
};

const LINE_1G_2026 = { married_jointly: 12_900, other: 8_600 };

/** Federal income tax to withhold this pay period, in cents. */
export function federalWithholding(
  taxableWages: Cents,
  payPeriodsPerYear: number,
  w4: FederalW4,
): Cents {
  if (w4.exempt) return 0;
  // Step 1: adjusted annual wage amount
  const annualWages = toDollars(taxableWages) * payPeriodsPerYear; // 1c
  const line1e = annualWages + toDollars(w4.step4aOtherIncome);
  const line1g = w4.step2Checkbox
    ? 0
    : w4.filingStatus === "married_jointly"
      ? LINE_1G_2026.married_jointly
      : LINE_1G_2026.other;
  const adjusted = Math.max(0, line1e - (toDollars(w4.step4bDeductions) + line1g)); // 1i

  // Step 2: tentative withholding
  const tables = TABLES_2026[w4.filingStatus];
  const annualTax = fromBrackets(w4.step2Checkbox ? tables.checkbox : tables.standard, adjusted);
  const perPeriod = annualTax / payPeriodsPerYear; // 2h

  // Step 3: credits
  const afterCredits = Math.max(0, perPeriod - toDollars(w4.step3Credits) / payPeriodsPerYear);

  // Step 4: extra withholding
  return toCents(afterCredits) + w4.step4cExtraWithholding;
}
