"use client";

import { useState } from "react";
import { Button, Card, Checkbox, Empty, Field, Input, PageHeader } from "@/components/ui";
import { newId, updateStore, useStore } from "@/lib/store/store";
import type { Classification, Project } from "@/lib/store/types";
import { money, parseMoney } from "@/lib/dates";

const blankProject = (): Project => ({
  id: newId(),
  name: "",
  projectNumber: "",
  awardingBody: "",
  dirProjectId: "",
  county: "",
  location: "",
  isPrevailingWage: true,
  isFederal: false,
});

const blankClass = (projectId: string): Classification => ({
  id: newId(),
  projectId,
  name: "",
  basicHourly: 0,
  fringe: { healthWelfare: 0, pension: 0, vacationHoliday: 0, training: 0, other: 0 },
  overtimeMultiplier: 1.5,
  doubleTimeMultiplier: 2,
  fringeOnOvertimeHours: true,
});

const totalFringe = (c: Classification) =>
  c.fringe.healthWelfare + c.fringe.pension + c.fringe.vacationHoliday + c.fringe.training + c.fringe.other;

export default function ProjectsPage() {
  const data = useStore();
  const [editing, setEditing] = useState<{ project: Project; classes: Classification[] } | null>(null);

  const startEdit = (p: Project) =>
    setEditing({ project: p, classes: data.classifications.filter((c) => c.projectId === p.id) });

  const save = (project: Project, classes: Classification[]) => {
    updateStore((s) => ({
      ...s,
      projects: s.projects.some((x) => x.id === project.id)
        ? s.projects.map((x) => (x.id === project.id ? project : x))
        : [...s.projects, project],
      classifications: [
        ...s.classifications.filter((c) => c.projectId !== project.id),
        ...(project.isPrevailingWage ? classes : []),
      ],
    }));
    setEditing(null);
  };

  const remove = (id: string) => {
    if (!window.confirm("Delete this job, its wage rates and its time entries?")) return;
    updateStore((s) => ({
      ...s,
      projects: s.projects.filter((x) => x.id !== id),
      classifications: s.classifications.filter((c) => c.projectId !== id),
      entries: s.entries.filter((e) => e.projectId !== id),
    }));
    setEditing(null);
  };

  return (
    <main>
      <PageHeader title="Jobs">
        {!editing && <Button onClick={() => setEditing({ project: blankProject(), classes: [] })}>Add job</Button>}
      </PageHeader>

      {editing && (
        <ProjectForm
          key={editing.project.id}
          initial={editing}
          onSave={save}
          onCancel={() => setEditing(null)}
          onDelete={data.projects.some((x) => x.id === editing.project.id) ? () => remove(editing.project.id) : undefined}
        />
      )}

      {!editing &&
        (data.projects.length === 0 ? (
          <Empty>No jobs yet. Add a job and the wage rates for each trade on it.</Empty>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {data.projects.map((p) => {
              const classes = data.classifications.filter((c) => c.projectId === p.id);
              return (
                <Card key={p.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold text-slate-900">{p.name}</h2>
                      <p className="text-sm text-slate-500">
                        {[p.projectNumber, p.county && `${p.county} County`].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.isPrevailingWage ? "bg-blue-50 text-blue-800" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {p.isPrevailingWage ? (p.isFederal ? "Davis-Bacon" : "CA prevailing wage") : "Regular"}
                    </span>
                  </div>
                  {classes.length > 0 && (
                    <ul className="mt-3 space-y-1 text-sm text-slate-600">
                      {classes.map((c) => (
                        <li key={c.id} className="flex justify-between gap-2">
                          <span>{c.name}</span>
                          <span>
                            {money(c.basicHourly)} + {money(totalFringe(c))} fringe
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Button variant="secondary" className="mt-4" onClick={() => startEdit(p)}>
                    Edit
                  </Button>
                </Card>
              );
            })}
          </div>
        ))}
    </main>
  );
}

function MoneyCell({ value, onChange, label }: { value: number; onChange: (c: number) => void; label: string }) {
  return (
    <Input
      aria-label={label}
      inputMode="decimal"
      defaultValue={value ? (value / 100).toFixed(2) : ""}
      onChange={(x) => onChange(parseMoney(x.target.value))}
    />
  );
}

function ProjectForm({
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial: { project: Project; classes: Classification[] };
  onSave: (p: Project, c: Classification[]) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [p, setP] = useState(initial.project);
  const [classes, setClasses] = useState(initial.classes);
  const set = (patch: Partial<Project>) => setP({ ...p, ...patch });
  const setC = (id: string, patch: Partial<Classification>) =>
    setClasses(classes.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const setF = (c: Classification, patch: Partial<Classification["fringe"]>) =>
    setC(c.id, { fringe: { ...c.fringe, ...patch } });

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(p, classes);
      }}
    >
      <Card>
        <h2 className="mb-4 font-semibold text-slate-900">Job</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Job name">
            <Input required value={p.name} onChange={(x) => set({ name: x.target.value })} />
          </Field>
          <Field label="Job / contract number">
            <Input value={p.projectNumber} onChange={(x) => set({ projectNumber: x.target.value })} />
          </Field>
          <Field label="Location">
            <Input value={p.location} onChange={(x) => set({ location: x.target.value })} />
          </Field>
          <Field label="County">
            <Input value={p.county} onChange={(x) => set({ county: x.target.value })} />
          </Field>
          <div className="space-y-2 sm:col-span-2">
            <Checkbox
              label="Prevailing wage job"
              checked={p.isPrevailingWage}
              onChange={(x) => set({ isPrevailingWage: x.target.checked })}
            />
            {p.isPrevailingWage && (
              <Checkbox
                label="Federally funded (Davis-Bacon, needs WH-347)"
                checked={p.isFederal}
                onChange={(x) => set({ isFederal: x.target.checked })}
              />
            )}
          </div>
          {p.isPrevailingWage && (
            <>
              <Field label="Awarding body">
                <Input value={p.awardingBody} onChange={(x) => set({ awardingBody: x.target.value })} />
              </Field>
              <Field label="DIR project ID" hint="From the awarding body's PWC-100 filing.">
                <Input value={p.dirProjectId} onChange={(x) => set({ dirProjectId: x.target.value })} />
              </Field>
              <Field label="Wage determination number" hint="From the DIR determination or the federal WD in the contract.">
                <Input
                  value={p.wageDeterminationNumber ?? ""}
                  onChange={(x) => set({ wageDeterminationNumber: x.target.value })}
                />
              </Field>
            </>
          )}
        </div>
      </Card>

      {p.isPrevailingWage && (
        <Card>
          <div className="mb-1 flex items-center justify-between gap-3">
            <h2 className="font-semibold text-slate-900">Wage rates by trade</h2>
            <Button type="button" variant="secondary" onClick={() => setClasses([...classes, blankClass(p.id)])}>
              Add trade
            </Button>
          </div>
          <p className="mb-4 text-sm text-slate-500">
            Copy these from the DIR general prevailing wage determination for this county and craft. All amounts per hour.
          </p>
          {classes.length === 0 && <p className="text-sm text-slate-500">No trades yet.</p>}
          <div className="space-y-4">
            {classes.map((c) => (
              <div key={c.id} className="rounded-md border border-slate-200 p-3">
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="sm:col-span-2">
                    <Field label="Trade / classification">
                      <Input required value={c.name} onChange={(x) => setC(c.id, { name: x.target.value })} />
                    </Field>
                  </div>
                  <Field label="Basic hourly rate">
                    <MoneyCell label="Basic hourly rate" value={c.basicHourly} onChange={(v) => setC(c.id, { basicHourly: v })} />
                  </Field>
                  <Field label="Overtime multiplier">
                    <Input
                      type="number"
                      step="0.1"
                      min={1}
                      value={c.overtimeMultiplier}
                      onChange={(x) => setC(c.id, { overtimeMultiplier: Number(x.target.value) || 1.5 })}
                    />
                  </Field>
                  <Field label="Health & welfare">
                    <MoneyCell label="Health and welfare" value={c.fringe.healthWelfare} onChange={(v) => setF(c, { healthWelfare: v })} />
                  </Field>
                  <Field label="Pension">
                    <MoneyCell label="Pension" value={c.fringe.pension} onChange={(v) => setF(c, { pension: v })} />
                  </Field>
                  <Field label="Vacation / holiday">
                    <MoneyCell label="Vacation and holiday" value={c.fringe.vacationHoliday} onChange={(v) => setF(c, { vacationHoliday: v })} />
                  </Field>
                  <Field label="Training">
                    <MoneyCell label="Training" value={c.fringe.training} onChange={(v) => setF(c, { training: v })} />
                  </Field>
                  <Field label="Other">
                    <MoneyCell label="Other" value={c.fringe.other} onChange={(v) => setF(c, { other: v })} />
                  </Field>
                  <div className="flex items-end justify-between gap-2 sm:col-span-3">
                    <p className="pb-2 text-sm text-slate-600">
                      Total {money(c.basicHourly + totalFringe(c))}/hr
                    </p>
                    <Button type="button" variant="danger" onClick={() => setClasses(classes.filter((x) => x.id !== c.id))}>
                      Remove trade
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit">Save job</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        {onDelete && (
          <Button type="button" variant="danger" className="ml-auto" onClick={onDelete}>
            Delete job
          </Button>
        )}
      </div>
    </form>
  );
}
