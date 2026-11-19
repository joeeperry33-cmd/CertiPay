import type {
  BucketedEntry,
  Cents,
  ClassificationRate,
  FringeCredits,
  Hundredths,
  PayBucket,
} from "./types";
import { NO_CREDITS } from "./types";

export interface PayLine {
  projectId: string;
  classificationId: string;
  classificationName: string;
  bucket: PayBucket;
  hours: Hundredths;
  /** Basic hourly rate for this bucket (with OT/DT multiplier). */
  basicRate: Cents;
  /** Cash fringe per hour paid to the worker (required fringe minus credits). */
  cashFringeRate: Cents;
  basicPay: Cents;
  cashFringePay: Cents;
  /** Employer contributions to approved plans for these hours (not in gross). */
  planContributions: Cents;
  /** Training fund contribution (CA: paid to the CAC or an approved fund). */
  trainingContribution: Cents;
}

export interface GrossResult {
  lines: PayLine[];
  totalHours: Hundredths;
  grossPay: Cents; // basic pay + cash fringe; what is subject to withholding
  planContributions: Cents;
  trainingContributions: Cents;
}

/** cents * hundredths-of-hours / 100, rounded half-up to the cent. */
function pay(rate: Cents, hours: Hundredths): Cents {
  return Math.round((rate * hours) / 100);
}

function sumFringe(f: Omit<FringeCredits, "training">): Cents {
  return f.healthWelfare + f.pension + f.vacationHoliday + f.other;
}

/**
 * Turn bucketed hours into pay. Required fringe (except training, which goes
 * to a training fund) can be satisfied by plan contributions; any shortfall is
 * paid to the worker in cash. Credits never exceed the required amount for
 * each fringe component.
 */
export function computeGross(
  entries: BucketedEntry[],
  rates: Map<string, ClassificationRate>,
  credits: FringeCredits = NO_CREDITS,
): GrossResult {
  const lines: PayLine[] = [];

  for (const e of entries) {
    const r = rates.get(e.classificationId);
    if (!r) throw new Error(`No rate for classification ${e.classificationId}`);

    const multiplier =
      e.bucket === "straight"
        ? 1
        : e.bucket === "overtime"
          ? r.overtimeMultiplier
          : r.doubleTimeMultiplier;
    const basicRate = Math.round(r.basicHourly * multiplier);

    const fringeApplies = e.bucket === "straight" || r.fringeOnOvertimeHours;
    const credited = {
      healthWelfare: Math.min(credits.healthWelfare, r.fringe.healthWelfare),
      pension: Math.min(credits.pension, r.fringe.pension),
      vacationHoliday: Math.min(credits.vacationHoliday, r.fringe.vacationHoliday),
      other: Math.min(credits.other, r.fringe.other),
    };
    const required = sumFringe(r.fringe);
    const creditedTotal = sumFringe(credited);
    const cashFringeRate = fringeApplies ? required - creditedTotal : 0;

    lines.push({
      projectId: e.projectId,
      classificationId: e.classificationId,
      classificationName: r.name,
      bucket: e.bucket,
      hours: e.hours,
      basicRate,
      cashFringeRate,
      basicPay: pay(basicRate, e.hours),
      cashFringePay: pay(cashFringeRate, e.hours),
      planContributions: fringeApplies ? pay(creditedTotal, e.hours) : 0,
      trainingContribution: fringeApplies ? pay(r.fringe.training, e.hours) : 0,
    });
  }

  return {
    lines,
    totalHours: lines.reduce((s, l) => s + l.hours, 0),
    grossPay: lines.reduce((s, l) => s + l.basicPay + l.cashFringePay, 0),
    planContributions: lines.reduce((s, l) => s + l.planContributions, 0),
    trainingContributions: lines.reduce((s, l) => s + l.trainingContribution, 0),
  };
}
