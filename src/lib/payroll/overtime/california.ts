import type { BucketedEntry, Hundredths, PayBucket, TimeEntry } from "../types";

/**
 * California overtime (Labor Code 510), applied per employee per workweek:
 *  - Over 8 hours in a workday, up to 12: 1.5x
 *  - Over 12 hours in a workday: 2x
 *  - Over 40 straight-time hours in the workweek: 1.5x
 *  - 7th consecutive workday in the workweek: first 8 hours 1.5x, over 8 at 2x
 *
 * Hours are assigned in the order entries are given within a day, so the
 * last job worked that day is the one that picks up the overtime.
 *
 * Note: a specific prevailing wage determination can set stricter rules
 * (e.g. all Saturday hours at 1.5x). Those are layered on later via
 * determination-specific rules; this function is the state-law floor.
 */
export function applyCaliforniaOvertime(
  weekEntries: TimeEntry[],
  workweekDates: string[],
): BucketedEntry[] {
  const DAY = 800; // 8.00 hours
  const LONG_DAY = 1200; // 12.00 hours
  const WEEK = 4000; // 40.00 hours

  const byDate = new Map<string, TimeEntry[]>();
  for (const e of weekEntries) {
    if (!workweekDates.includes(e.date)) {
      throw new Error(`Entry dated ${e.date} is outside the workweek`);
    }
    const list = byDate.get(e.date) ?? [];
    list.push(e);
    byDate.set(e.date, list);
  }

  const workedAllSeven =
    workweekDates.length === 7 &&
    workweekDates.every((d) => (byDate.get(d) ?? []).some((e) => e.hours > 0));

  const out: BucketedEntry[] = [];
  let weeklyStraight: Hundredths = 0;

  workweekDates.forEach((date, dayIndex) => {
    const entries = byDate.get(date) ?? [];
    const seventhDay = workedAllSeven && dayIndex === 6;
    let dayHours: Hundredths = 0;

    for (const entry of entries) {
      let remaining = entry.hours;
      const pieces = new Map<PayBucket, Hundredths>();
      const add = (b: PayBucket, h: Hundredths) => {
        if (h > 0) pieces.set(b, (pieces.get(b) ?? 0) + h);
      };

      while (remaining > 0) {
        let bucket: PayBucket;
        let room: Hundredths;
        if (seventhDay) {
          bucket = dayHours < DAY ? "overtime" : "double";
          room = dayHours < DAY ? DAY - dayHours : remaining;
        } else if (dayHours < DAY) {
          bucket = "straight";
          room = DAY - dayHours;
          // Weekly 40-hour cap on straight time.
          const weeklyRoom = WEEK - weeklyStraight;
          if (weeklyRoom <= 0) {
            bucket = "overtime";
          } else {
            room = Math.min(room, weeklyRoom);
          }
        } else if (dayHours < LONG_DAY) {
          bucket = "overtime";
          room = LONG_DAY - dayHours;
        } else {
          bucket = "double";
          room = remaining;
        }

        const take = Math.min(room, remaining);
        add(bucket, take);
        if (bucket === "straight") weeklyStraight += take;
        dayHours += take;
        remaining -= take;
      }

      for (const [bucket, hours] of pieces) {
        out.push({ ...entry, hours, bucket });
      }
    }
  });

  return out;
}
