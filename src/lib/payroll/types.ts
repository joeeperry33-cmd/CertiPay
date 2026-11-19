/**
 * Core payroll types. All money is in integer cents and all hours are in
 * hundredths of an hour (e.g. 8.25 h = 825) so the math never drifts.
 */

export type Cents = number;
export type Hundredths = number; // hours * 100

export type DayKind = "weekday" | "saturday" | "sunday" | "holiday";

/** One line of a timesheet: hours worked by one employee on one day, on one job, in one classification. */
export interface TimeEntry {
  date: string; // YYYY-MM-DD
  projectId: string;
  classificationId: string;
  hours: Hundredths;
  dayKind?: DayKind;
}

export type PayBucket = "straight" | "overtime" | "double";

/** A time entry after overtime rules have split it into pay buckets. */
export interface BucketedEntry extends TimeEntry {
  bucket: PayBucket;
}

/**
 * Rates for one craft/classification from a prevailing wage determination
 * (California DIR general determination, or a federal Davis-Bacon WD).
 * Fringe components are per straight-time hour.
 */
export interface ClassificationRate {
  id: string;
  name: string; // e.g. "Laborer Group 1"
  basicHourly: Cents;
  fringe: {
    healthWelfare: Cents;
    pension: Cents;
    vacationHoliday: Cents;
    training: Cents;
    other: Cents;
  };
  /** Multiplier applied to the basic hourly rate for overtime / double time. */
  overtimeMultiplier: number; // usually 1.5
  doubleTimeMultiplier: number; // usually 2
  /**
   * Whether fringe is also paid on overtime hours. Most CA determinations pay
   * fringe at straight time on every hour worked (true). Leave true unless the
   * determination says otherwise.
   */
  fringeOnOvertimeHours: boolean;
}

/**
 * What the employer actually contributes to approved plans per hour, which
 * is credited against the required fringe. Anything not covered is paid to
 * the worker in cash.
 */
export interface FringeCredits {
  healthWelfare: Cents;
  pension: Cents;
  vacationHoliday: Cents;
  training: Cents;
  other: Cents;
}

export const NO_CREDITS: FringeCredits = {
  healthWelfare: 0,
  pension: 0,
  vacationHoliday: 0,
  training: 0,
  other: 0,
};
