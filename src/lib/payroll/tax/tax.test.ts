import { describe, expect, it } from "vitest";
import { federalWithholding, type FederalW4 } from "./federal";
import { californiaWithholding, type CaDE4 } from "./california";
import { employeePayrollTaxes } from "./fica";
import { computeNetPay } from "../net";

const w4 = (over: Partial<FederalW4> = {}): FederalW4 => ({
  filingStatus: "single",
  step2Checkbox: false,
  step3Credits: 0,
  step4aOtherIncome: 0,
  step4bDeductions: 0,
  step4cExtraWithholding: 0,
  ...over,
});

const de4 = (over: Partial<CaDE4> = {}): CaDE4 => ({
  filingStatus: "single",
  allowances: 1,
  additionalAllowances: 0,
  extraWithholding: 0,
  ...over,
});

describe("federal withholding (Pub 15-T 2026, Worksheet 1A)", () => {
  it("single, weekly $1,000", () => {
    // 52,000 - 8,600 = 43,400; 1,240 + 12% x 23,500 = 4,060 / 52 = 78.08
    expect(federalWithholding(100_000, 52, w4())).toBe(7808);
  });

  it("married jointly, weekly $2,000, with $4,000 dependent credit", () => {
    // 104,000 - 12,900 = 91,100; 2,480 + 12% x 47,000 = 8,120 / 52 = 156.154
    // minus 4,000 / 52 = 76.923 -> 79.23
    expect(
      federalWithholding(200_000, 52, w4({ filingStatus: "married_jointly", step3Credits: 400_000 })),
    ).toBe(7923);
  });

  it("adds extra withholding and honors exempt", () => {
    expect(federalWithholding(100_000, 52, w4({ step4cExtraWithholding: 2000 }))).toBe(9808);
    expect(federalWithholding(100_000, 52, w4({ exempt: true }))).toBe(0);
  });
});

describe("California withholding (EDD Method B 2026)", () => {
  it("single, 1 allowance, weekly $1,000", () => {
    // 52,000 - 5,706 = 46,294; 1,124.21 + 6.6% x 4,842 = 1,443.78; - 168.30 = 1,275.48 / 52
    expect(californiaWithholding(100_000, 52, de4())).toBe(2453);
  });

  it("withholds nothing under the low income exemption", () => {
    expect(californiaWithholding(30_000, 52, de4())).toBe(0);
  });

  it("married with 2 allowances uses the higher deduction", () => {
    // 104,000 - 11,412 = 92,588; 2,248.42 + 6.6% x 9,684 = 2,887.56; - 336.60 = 2,550.96 / 52
    expect(
      californiaWithholding(200_000, 52, de4({ filingStatus: "married", allowances: 2 })),
    ).toBe(4906);
  });
});

describe("Social Security, Medicare, SDI", () => {
  it("applies 2026 rates", () => {
    expect(employeePayrollTaxes(100_000, 0)).toEqual({ socialSecurity: 6200, medicare: 1450, caSdi: 1300 });
  });

  it("stops Social Security at the $184,500 wage base", () => {
    expect(employeePayrollTaxes(100_000, 18_400_000).socialSecurity).toBe(3100);
  });

  it("adds 0.9% Medicare over $200,000", () => {
    // 500 of the 1,000 is over the threshold
    expect(employeePayrollTaxes(100_000, 19_950_000).medicare).toBe(1450 + 450);
  });
});

describe("net pay", () => {
  it("takes taxes and deductions from gross", () => {
    const r = computeNetPay({
      grossPay: 100_000,
      payPeriodsPerYear: 52,
      ytdFicaWages: 0,
      w4: w4(),
      de4: de4(),
      deductions: [],
    });
    expect(r.totalWithholding).toBe(7808 + 2453 + 6200 + 1450 + 1300);
    expect(r.netPay).toBe(100_000 - r.totalWithholding);
  });

  it("401(k) lowers income tax wages but not FICA wages", () => {
    const r = computeNetPay({
      grossPay: 100_000,
      payPeriodsPerYear: 52,
      ytdFicaWages: 0,
      w4: w4(),
      de4: de4(),
      deductions: [{ label: "401(k)", amount: 10_000, preTaxIncome: true, preTaxFica: false }],
    });
    expect(r.federalIncomeTax).toBe(federalWithholding(90_000, 52, w4()));
    expect(r.socialSecurity).toBe(6200);
  });
});
