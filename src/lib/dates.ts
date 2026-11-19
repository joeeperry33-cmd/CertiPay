/** Date helpers that work on YYYY-MM-DD strings in local time, avoiding UTC shifts. */

export function parseDate(d: string): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
}

export function formatDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(d: string, n: number): string {
  const x = parseDate(d);
  x.setDate(x.getDate() + n);
  return formatDate(x);
}

export function weekDates(start: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Most recent Monday on or before the given date. */
export function mondayOf(d: Date = new Date()): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const offset = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - offset);
  return formatDate(x);
}

export function shortDay(d: string): string {
  return parseDate(d).toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" });
}

export const money = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

export const hrs = (h: number) => (h / 100).toFixed(2);

/** "$12.34" or "12.34" -> 1234 cents; NaN-safe. */
export function parseMoney(s: string): number {
  const n = Number(s.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function parseHours(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}
