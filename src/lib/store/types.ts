import type { ClassificationRate, Cents, Hundredths } from "../payroll/types";
import type { FederalW4 } from "../payroll/tax/federal";
import type { CaDE4 } from "../payroll/tax/california";
import type { Deduction } from "../payroll/net";

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  ssnLast4: string;
  address: string;
  /** Hourly rate for regular (non-prevailing-wage) work. */
  regularRate: Cents;
  isApprentice: boolean;
  w4: FederalW4;
  de4: CaDE4;
  deductions: Deduction[];
}

export interface Project {
  id: string;
  name: string;
  projectNumber: string;
  awardingBody: string;
  dirProjectId: string;
  county: string;
  location: string;
  isPrevailingWage: boolean;
  isFederal: boolean;
}

export interface Classification extends ClassificationRate {
  projectId: string;
}

export interface StoredEntry {
  id: string;
  employeeId: string;
  projectId: string;
  /** null for regular work on a non-prevailing-wage job. */
  classificationId: string | null;
  date: string; // YYYY-MM-DD
  hours: Hundredths;
}

export interface Company {
  name: string;
  address: string;
  fein: string;
  dirRegistration: string;
  cslbLicense: string;
}

export interface StoreData {
  version: 1;
  company: Company;
  employees: Employee[];
  projects: Project[];
  classifications: Classification[];
  entries: StoredEntry[];
}

export const EMPTY_STORE: StoreData = {
  version: 1,
  company: { name: "", address: "", fein: "", dirRegistration: "", cslbLicense: "" },
  employees: [],
  projects: [],
  classifications: [],
  entries: [],
};
