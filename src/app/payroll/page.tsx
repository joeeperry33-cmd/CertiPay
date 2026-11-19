"use client";

import { useMemo, useState } from "react";
import { Button, Card, Empty, PageHeader } from "@/components/ui";
import { WeekPicker } from "@/components/WeekPicker";
import { useStore } from "@/lib/store/store";
import { runWeek, type EmployeePayroll } from "@/lib/payroll/run";
import { hrs, mondayOf, money, shortDay } from "@/lib/dates";
import type { StoreData } from "@/lib/store/types";

const bucketLabel = { straight: "Regular", overtime: "Overtime", double: "Double time" } as const;

export default function PayrollPage() {
  const data = useStore();
  const [weekStart, setWeekStart] = useState(mondayOf());
  const run = useMemo(() => runWeek(data, weekStart), [data, weekStart]);

  return (
    <main>
      <PageHeader title="Payroll">
        <WeekPicker weekStart={weekStart} onChange={setWeekStart} />
        {run.employees.length > 0 && (
          <Button variant="secondary" onClick={() => window.print()} className="print:hidden">
            Print pay stubs
          </Button>
        )}
      </PageHeader>

      {run.employees.length === 0 ? (
        <Empty>No time entered for this week. Enter hours on the Timesheets page.</Empty>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 print:hidden">
            <Stat label="Employees" value={String(run.employees.length)} />
            <Stat label="Hours" value={hrs(run.totals.hours)} />
            <Stat label="Gross pay" value={money(run.totals.gross)} />
            <Stat label="Net pay" value={money(run.totals.net)} />
          </div>
          <div className="space-y-6">
            {run.employees.map((r) => (
              <PayStub key={r.employee.id} r={r} data={data} dates={run.dates} />
            ))}
          </div>
          <p className="mt-6 text-xs text-slate-500 print:hidden">
            Preview: year-to-date totals and the Social Security wage limit are not tracked across weeks yet.
          </p>
        </>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4 sm:p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-slate-900">{value}</div>
    </Card>
  );
}

function PayStub({ r, data, dates }: { r: EmployeePayroll; data: StoreData; dates: string[] }) {
  const { employee: e, gross, net } = r;
  const project = (id: string) => data.projects.find((p) => p.id === id)?.name ?? "";
  const taxes: [string, number][] = [
    ["Federal income tax", net.federalIncomeTax],
    ["Social Security", net.socialSecurity],
    ["Medicare", net.medicare],
    ["California income tax", net.caIncomeTax],
    ["CA SDI", net.caSdi],
  ];

  return (
    <Card className="break-inside-avoid print:border-slate-400">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {e.firstName} {e.lastName}
          </h2>
          <p className="text-sm text-slate-500">
            {data.company.name && `${data.company.name} · `}Week of {shortDay(dates[0])} – {shortDay(dates[6])}
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wide text-slate-500">Net pay</div>
          <div className="text-2xl font-bold text-slate-900">{money(net.netPay)}</div>
        </div>
      </div>
      {net.warning && <p className="mt-2 rounded bg-red-50 p-2 text-sm text-red-800">{net.warning}</p>}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-b border-slate-200 text-left text-slate-500">
            <tr>
              <th className="py-2 font-medium">Job / trade</th>
              <th className="py-2 font-medium">Type</th>
              <th className="py-2 text-right font-medium">Hours</th>
              <th className="py-2 text-right font-medium">Rate</th>
              <th className="py-2 text-right font-medium">Cash fringe</th>
              <th className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {groupLines(gross.lines).map((l) => (
              <tr key={`${l.projectId}:${l.classificationId}:${l.bucket}`} className="border-b border-slate-100">
                <td className="py-2">
                  <div className="text-slate-900">{project(l.projectId)}</div>
                  <div className="text-xs text-slate-500">{l.classificationName}</div>
                </td>
                <td className="py-2 text-slate-600">{bucketLabel[l.bucket]}</td>
                <td className="py-2 text-right">{hrs(l.hours)}</td>
                <td className="py-2 text-right">{money(l.basicRate)}</td>
                <td className="py-2 text-right">{l.cashFringeRate ? money(l.cashFringeRate) : "–"}</td>
                <td className="py-2 text-right font-medium">{money(l.basicPay + l.cashFringePay)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        <dl className="space-y-1 text-sm">
          <Row label="Gross pay" value={money(net.grossPay)} strong />
          {taxes.map(([label, v]) => (
            <Row key={label} label={label} value={`−${money(v)}`} />
          ))}
          {net.deductions.map((d, i) => (
            <Row key={d.id ?? i} label={d.label} value={`−${money(d.amount)}`} />
          ))}
          <Row label="Net pay" value={money(net.netPay)} strong />
        </dl>
        {(gross.planContributions > 0 || gross.trainingContributions > 0) && (
          <dl className="space-y-1 text-sm text-slate-600">
            <dt className="font-medium text-slate-700">Employer contributions (not in gross)</dt>
            {gross.planContributions > 0 && <Row label="Benefit plans" value={money(gross.planContributions)} />}
            {gross.trainingContributions > 0 && <Row label="Training fund" value={money(gross.trainingContributions)} />}
          </dl>
        )}
      </div>
    </Card>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "border-t border-slate-200 pt-1 font-semibold text-slate-900" : ""}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

type Line = EmployeePayroll["gross"]["lines"][number];

/** Combine a week's daily lines into one line per job, trade and pay type. */
function groupLines(lines: Line[]): Line[] {
  const map = new Map<string, Line>();
  for (const l of lines) {
    const k = `${l.projectId}:${l.classificationId}:${l.bucket}`;
    const prev = map.get(k);
    map.set(
      k,
      prev
        ? {
            ...prev,
            hours: prev.hours + l.hours,
            basicPay: prev.basicPay + l.basicPay,
            cashFringePay: prev.cashFringePay + l.cashFringePay,
          }
        : { ...l },
    );
  }
  return [...map.values()];
}
