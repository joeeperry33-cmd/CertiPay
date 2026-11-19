"use client";

import { addDays, parseDate } from "@/lib/dates";
import { Button } from "./ui";

export function WeekPicker({ weekStart, onChange }: { weekStart: string; onChange: (d: string) => void }) {
  const fmt = (d: string) => parseDate(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" aria-label="Previous week" onClick={() => onChange(addDays(weekStart, -7))}>
        ←
      </Button>
      <span className="min-w-[13rem] text-center text-sm font-medium text-slate-700">
        {fmt(weekStart)} – {fmt(addDays(weekStart, 6))}
      </span>
      <Button variant="secondary" aria-label="Next week" onClick={() => onChange(addDays(weekStart, 7))}>
        →
      </Button>
    </div>
  );
}
