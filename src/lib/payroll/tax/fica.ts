import type { Cents } from "../types";

/**
 * Employee-side Social Security, Medicare and California SDI for 2026.
 * Sources: SSA 2026 wage base $184,500; Medicare 1.45% plus 0.9% additional
 * over $200,000 of year-to-date wages; CA SDI 1.3% with no wage limit (EDD).
 */
export const FICA_2026 = {
  socialSecurityRate: 0.062,
  socialSecurityWageBase: 18_450_000, // cents
  medicareRate: 0.0145,
  additionalMedicareRate: 0.009,
  additionalMedicareThreshold: 20_000_000, // cents
  caSdiRate: 0.013,
};

export interface EmployeeTaxes {
  socialSecurity: Cents;
  medicare: Cents;
  caSdi: Cents;
}

/**
 * @param wages FICA wages this period
 * @param ytdWages FICA wages already paid this year, before this period
 * @param sdiWages SDI wages this period (usually the same as FICA wages)
 */
export function employeePayrollTaxes(wages: Cents, ytdWages: Cents, sdiWages: Cents = wages): EmployeeTaxes {
  const f = FICA_2026;
  const ssWages = Math.max(0, Math.min(wages, f.socialSecurityWageBase - ytdWages));
  const overThreshold =
    Math.max(0, ytdWages + wages - f.additionalMedicareThreshold) -
    Math.max(0, ytdWages - f.additionalMedicareThreshold);
  return {
    socialSecurity: Math.round(ssWages * f.socialSecurityRate),
    medicare: Math.round(wages * f.medicareRate + overThreshold * f.additionalMedicareRate),
    caSdi: Math.round(sdiWages * f.caSdiRate),
  };
}
