import { type Bracket, fromBrackets, toCents, toDollars } from "./brackets";
import type { Cents } from "../types";

/**
 * California personal income tax withholding, EDD Method B (exact
 * calculation), 2026 annual tables, applied to annualized wages.
 * Source: https://edd.ca.gov/siteassets/files/pdf_pub_ctr/26methb.pdf
 *
 * Annualizing and dividing back can differ from the weekly table by a few
 * cents; EDD's annual tables are part of Method B for this purpose.
 */

export type CaFilingStatus = "single" | "married" | "head_of_household";

export interface CaDE4 {
  filingStatus: CaFilingStatus;
  allowances: number; // regular withholding allowances (DE 4 line 1a)
  additionalAllowances: number; // estimated deductions (DE 4 line 1b)
  extraWithholding: Cents; // per pay period
  exempt?: boolean;
}

const row = (over: number, base: number, rate: number): Bracket => ({ over, base, rate });

const SINGLE_2026: Bracket[] = [
  row(0, 0, 0.011),
  row(11_079, 121.87, 0.022),
  row(26_264, 455.94, 0.044),
  row(41_452, 1_124.21, 0.066),
  row(57_542, 2_186.15, 0.088),
  row(72_724, 3_522.17, 0.1023),
  row(371_479, 34_084.81, 0.1133),
  row(445_771, 42_502.09, 0.1243),
  row(742_953, 79_441.81, 0.1353),
  row(1_000_000, 114_220.27, 0.1463),
];

const MARRIED_2026: Bracket[] = [
  row(0, 0, 0.011),
  row(22_158, 243.74, 0.022),
  row(52_528, 911.88, 0.044),
  row(82_904, 2_248.42, 0.066),
  row(115_084, 4_372.3, 0.088),
  row(145_448, 7_044.33, 0.1023),
  row(742_958, 68_169.6, 0.1133),
  row(891_542, 85_004.17, 0.1243),
  row(1_000_000, 98_485.5, 0.1353),
  row(1_485_906, 164_228.58, 0.1463),
];

const HOH_2026: Bracket[] = [
  row(0, 0, 0.011),
  row(22_173, 243.9, 0.022),
  row(52_530, 911.75, 0.044),
  row(67_716, 1_579.93, 0.066),
  row(83_805, 2_641.8, 0.088),
  row(98_990, 3_978.08, 0.1023),
  row(505_208, 45_534.18, 0.1133),
  row(606_251, 56_982.35, 0.1243),
  row(1_000_000, 105_925.35, 0.1353),
  row(1_010_417, 107_334.77, 0.1463),
];

const ANNUAL_2026 = {
  lowIncomeExemption: { low: 18_896, high: 37_791 },
  standardDeduction: { low: 5_706, high: 11_412 },
  estimatedDeductionPerAllowance: 1_000,
  exemptionCreditPerAllowance: 168.3,
};

/** Married with 2+ allowances and head of household use the higher amounts. */
function usesHighAmounts(de4: CaDE4) {
  return (
    de4.filingStatus === "head_of_household" ||
    (de4.filingStatus === "married" && de4.allowances >= 2)
  );
}

/** California PIT to withhold this pay period, in cents. */
export function californiaWithholding(
  taxableWages: Cents,
  payPeriodsPerYear: number,
  de4: CaDE4,
): Cents {
  if (de4.exempt) return 0;
  const t = ANNUAL_2026;
  const high = usesHighAmounts(de4);
  const annual = toDollars(taxableWages) * payPeriodsPerYear;

  // Step 1: low income exemption
  if (annual <= (high ? t.lowIncomeExemption.high : t.lowIncomeExemption.low)) {
    return de4.extraWithholding;
  }
  // Step 2: estimated deduction; Step 3: standard deduction
  const taxable = Math.max(
    0,
    annual -
      de4.additionalAllowances * t.estimatedDeductionPerAllowance -
      (high ? t.standardDeduction.high : t.standardDeduction.low),
  );
  // Step 4: tax from rate table
  const table =
    de4.filingStatus === "married"
      ? MARRIED_2026
      : de4.filingStatus === "head_of_household"
        ? HOH_2026
        : SINGLE_2026;
  const tax = fromBrackets(table, taxable);
  // Step 5: exemption allowance credit
  const annualWithholding = Math.max(0, tax - de4.allowances * t.exemptionCreditPerAllowance);
  return toCents(annualWithholding / payPeriodsPerYear) + de4.extraWithholding;
}
