"use client";

import { useState } from "react";
import { Button, Card, Empty, Field, Input, PageHeader, Select } from "@/components/ui";
import { WeekPicker } from "@/components/WeekPicker";
import { newId, updateStore, useStore } from "@/lib/store/store";
import type { StoreData } from "@/lib/store/types";
import { hrs, mondayOf, parseHours, shortDay, weekDates } from "@/lib/dates";

interface Row {
  key: string;
  projectId: string;
  classificationId: string | null;
  hours: string[]; // one per day
}

function rowsFor(data: StoreData, employeeId: string, dates: string[]): Row[] {
  const rows: Row[] = [];
  const ordered = [...data.entries].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  for (const e of ordered) {
    if (e.employeeId !== employeeId || !dates.includes(e.date)) continue;
    let row = rows.find((r) => r.projectId === e.projectId && r.classificationId === e.classificationId);
    if (!row) {
      row = { key: newId(), projectId: e.projectId, classificationId: e.classificationId, hours: dates.map(() => "") };
      rows.push(row);
    }
    const i = dates.indexOf(e.date);
    const prev = parseHours(row.hours[i]);
    row.hours[i] = hrs(prev + e.hours).replace(/\.00$/, "");
  }
  return rows;
}

export default function TimesheetsPage() {
  const data = useStore();
  const [weekStart, setWeekStart] = useState(mondayOf());
  const [employeeId, setEmployeeId] = useState("");

  const selected = employeeId || data.employees[0]?.id || "";

  if (data.employees.length === 0 || data.projects.length === 0) {
    return (
      <main>
        <PageHeader title="Timesheets" />
        <Empty>Add at least one employee and one job before entering time.</Empty>
      </main>
    );
  }

  return (
    <main>
      <PageHeader title="Timesheets">
        <WeekPicker weekStart={weekStart} onChange={setWeekStart} />
      </PageHeader>
      <div className="mb-4 max-w-sm">
        <Field label="Employee">
          <Select value={selected} onChange={(e) => setEmployeeId(e.target.value)}>
            {data.employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.lastName}, {e.firstName}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <WeekGrid key={`${selected}:${weekStart}`} data={data} employeeId={selected} weekStart={weekStart} />
    </main>
  );
}

function WeekGrid({ data, employeeId, weekStart }: { data: StoreData; employeeId: string; weekStart: string }) {
  const dates = weekDates(weekStart);
  const [rows, setRows] = useState<Row[]>(() => rowsFor(data, employeeId, dates));
  const [saved, setSaved] = useState(false);
  const [newProject, setNewProject] = useState(data.projects[0]?.id ?? "");

  const project = data.projects.find((p) => p.id === newProject);
  const classes = data.classifications.filter((c) => c.projectId === newProject);
  const [newClass, setNewClass] = useState("");
  const chosenClass = project?.isPrevailingWage ? newClass || classes[0]?.id || "" : null;

  const label = (r: Row) => {
    const p = data.projects.find((x) => x.id === r.projectId);
    const c = data.classifications.find((x) => x.id === r.classificationId);
    return { job: p?.name ?? "Deleted job", trade: c?.name ?? "Regular" };
  };

  const dayTotal = (i: number) => rows.reduce((s, r) => s + parseHours(r.hours[i]), 0);
  const weekTotal = dates.reduce((s, _, i) => s + dayTotal(i), 0);

  const save = () => {
    const entries = rows.flatMap((r, rowIndex) =>
      dates
        .map((date, i) => ({
          sortOrder: rowIndex,
          id: newId(),
          employeeId,
          projectId: r.projectId,
          classificationId: r.classificationId,
          date,
          hours: parseHours(r.hours[i]),
        }))
        .filter((e) => e.hours > 0),
    );
    updateStore((s) => ({
      ...s,
      entries: [...s.entries.filter((e) => !(e.employeeId === employeeId && dates.includes(e.date))), ...entries],
    }));
    setSaved(true);
  };

  const edit = (key: string, i: number, v: string) => {
    setSaved(false);
    setRows(rows.map((r) => (r.key === key ? { ...r, hours: r.hours.map((h, j) => (j === i ? v : h)) } : r)));
  };

  return (
    <div className="space-y-4">
      <Card className="overflow-x-auto p-0 sm:p-0">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="px-3 py-3 text-left font-medium">Job / trade</th>
              {dates.map((d) => (
                <th key={d} className="px-1 py-3 text-center font-medium">
                  {shortDay(d)}
                </th>
              ))}
              <th className="px-3 py-3 text-right font-medium">Total</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-slate-500">
                  No time this week. Add a job below.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const l = label(r);
              return (
                <tr key={r.key} className="border-b border-slate-100">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">{l.job}</div>
                    <div className="text-xs text-slate-500">{l.trade}</div>
                  </td>
                  {dates.map((d, i) => (
                    <td key={d} className="px-1 py-2">
                      <input
                        aria-label={`${l.job} ${l.trade} ${d}`}
                        inputMode="decimal"
                        className="w-16 rounded-md border border-slate-300 px-2 py-1.5 text-center"
                        value={r.hours[i]}
                        onChange={(e) => edit(r.key, i, e.target.value.replace(/[^\d.]/g, ""))}
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-medium">
                    {hrs(r.hours.reduce((s, h) => s + parseHours(h), 0))}
                  </td>
                  <td className="px-2">
                    <button
                      className="text-xs text-red-700 hover:underline"
                      onClick={() => {
                        setSaved(false);
                        setRows(rows.filter((x) => x.key !== r.key));
                      }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="text-slate-600">
              <td className="px-3 py-3 font-medium">Day total</td>
              {dates.map((d, i) => (
                <td key={d} className={`px-1 py-3 text-center ${dayTotal(i) > 800 ? "font-semibold text-amber-700" : ""}`}>
                  {dayTotal(i) ? hrs(dayTotal(i)) : ""}
                </td>
              ))}
              <td className="px-3 py-3 text-right font-semibold">{hrs(weekTotal)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </Card>
      <p className="text-xs text-slate-500">
        When a day has more than one job, list them in the order worked. Overtime goes to the last job of the day.
      </p>

      <Card>
        <h2 className="mb-3 font-semibold text-slate-900">Add a job to this week</h2>
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Field label="Job">
            <Select
              value={newProject}
              onChange={(e) => {
                setNewProject(e.target.value);
                setNewClass("");
              }}
            >
              {data.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Trade">
            {project?.isPrevailingWage ? (
              <Select value={chosenClass ?? ""} onChange={(e) => setNewClass(e.target.value)}>
                {classes.length === 0 && <option value="">Add trades to this job first</option>}
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            ) : (
              <Input disabled value="Regular rate" />
            )}
          </Field>
          <Button
            type="button"
            variant="secondary"
            disabled={!project || (project.isPrevailingWage && !chosenClass)}
            onClick={() => {
              setSaved(false);
              setRows([
                ...rows,
                { key: newId(), projectId: newProject, classificationId: chosenClass, hours: dates.map(() => "") },
              ]);
            }}
          >
            Add row
          </Button>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save}>Save timesheet</Button>
        {saved && <span className="text-sm text-green-700">Saved</span>}
      </div>
    </div>
  );
}
