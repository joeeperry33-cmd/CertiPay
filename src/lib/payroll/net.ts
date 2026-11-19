import type { Cents } from "./types";
import { type CaDE4, californiaWithholding } from "./tax/california";
import { type FederalW4, federalWithholding } from "./tax/federal";
import { employeePayrollTaxes } from "./tax/fica";

export interface Deduction {
  label: string;
  amount: Cents;
  /** Pre-tax for income tax (e.g. 401(k), Section 125). */
  preTaxIncome: boolean;
  /** Pre-tax for Social Security, Medicare and SDI too (Section 125 health; not 401(k)). */
  preTaxFica: boolean;
}

export interface NetPayInput {
  grossPay: Cents;
  payPeriodsPerYear: number; // 52 weekly, 26 biweekly, 24 semimonthly, 12 monthly
  ytdFicaWages: Cents;
  w4: FederalW4;
  de4: CaDE4;
  deductions: Deduction[];
}

export interface NetPayResult {
  grossPay: Cents;
  federalIncomeTax: Cents;
  socialSecurity: Cents;
  medicare: Cents;
  caIncomeTax: Cents;
  caSdi: Cents;
  deductions: Deduction[];
  totalWithholding: Cents;
  netPay: Cents;
  /** Net pay could not cover everything; review before issuing the check. */
  warning?: string;
}

export function computeNetPay(input: NetPayInput): NetPayResult {
  const sum = (filter: (d: Deduction) => boolean) =>
    input.deductions.filter(filter).reduce((s, d) => s + d.amount, 0);

  const incomeWages = Math.max(0, input.grossPay - sum((d) => d.preTaxIncome));
  const ficaWages = Math.max(0, input.grossPay - sum((d) => d.preTaxFica));

  const federalIncomeTax = federalWithholding(incomeWages, input.payPeriodsPerYear, input.w4);
  const caIncomeTax = californiaWithholding(incomeWages, input.payPeriodsPerYear, input.de4);
  const { socialSecurity, medicare, caSdi } = employeePayrollTaxes(ficaWages, input.ytdFicaWages);

  const taxes = federalIncomeTax + caIncomeTax + socialSecurity + medicare + caSdi;
  const totalWithholding = taxes + sum(() => true);
  const netPay = input.grossPay - totalWithholding;

  return {
    grossPay: input.grossPay,
    federalIncomeTax,
    socialSecurity,
    medicare,
    caIncomeTax,
    caSdi,
    deductions: input.deductions,
    totalWithholding,
    netPay,
    warning: netPay < 0 ? "Deductions and taxes exceed gross pay" : undefined,
  };
}
