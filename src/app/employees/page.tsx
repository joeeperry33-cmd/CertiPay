"use client";

import { useState } from "react";
import { Button, Card, Checkbox, Empty, Field, Input, PageHeader, Select } from "@/components/ui";
import { newId, updateStore, useStore } from "@/lib/store/store";
import type { Employee } from "@/lib/store/types";
import { money, parseMoney } from "@/lib/dates";

const blank = (): Employee => ({
  id: newId(),
  firstName: "",
  lastName: "",
  ssnLast4: "",
  address: "",
  regularRate: 0,
  isApprentice: false,
  w4: {
    filingStatus: "single",
    step2Checkbox: false,
    step3Credits: 0,
    step4aOtherIncome: 0,
    step4bDeductions: 0,
    step4cExtraWithholding: 0,
  },
  de4: { filingStatus: "single", allowances: 0, additionalAllowances: 0, extraWithholding: 0 },
  deductions: [],
});

const cents = (c: number) => (c ? (c / 100).toFixed(2) : "");

export default function EmployeesPage() {
  const data = useStore();
  const [editing, setEditing] = useState<Employee | null>(null);

  const save = (e: Employee) => {
    updateStore((s) => ({
      ...s,
      employees: s.employees.some((x) => x.id === e.id)
        ? s.employees.map((x) => (x.id === e.id ? e : x))
        : [...s.employees, e],
    }));
    setEditing(null);
  };

  const remove = (id: string) => {
    if (!window.confirm("Delete this employee and their time entries?")) return;
    updateStore((s) => ({
      ...s,
      employees: s.employees.filter((x) => x.id !== id),
      entries: s.entries.filter((x) => x.employeeId !== id),
    }));
    setEditing(null);
  };

  return (
    <main>
      <PageHeader title="Employees">
        {!editing && <Button onClick={() => setEditing(blank())}>Add employee</Button>}
      </PageHeader>

      {editing && (
        <EmployeeForm
          key={editing.id}
          initial={editing}
          onSave={save}
          onCancel={() => setEditing(null)}
          onDelete={data.employees.some((x) => x.id === editing.id) ? () => remove(editing.id) : undefined}
        />
      )}

      {!editing &&
        (data.employees.length === 0 ? (
          <Empty>No employees yet. Add your first one to start entering time.</Empty>
        ) : (
          <Card className="overflow-x-auto p-0 sm:p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">SSN</th>
                  <th className="px-4 py-3 font-medium">Regular rate</th>
                  <th className="px-4 py-3 font-medium">Federal / CA</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {data.employees.map((e) => (
                  <tr key={e.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {e.lastName}, {e.firstName}
                      {e.isApprentice && <span className="ml-2 text-xs text-amber-700">Apprentice</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">xxx-xx-{e.ssnLast4 || "????"}</td>
                    <td className="px-4 py-3 text-slate-600">{money(e.regularRate)}/hr</td>
                    <td className="px-4 py-3 text-slate-600">
                      {e.w4.filingStatus.replace(/_/g, " ")} / {e.de4.filingStatus.replace(/_/g, " ")}, {e.de4.allowances}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="secondary" onClick={() => setEditing(e)}>
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ))}
    </main>
  );
}

function EmployeeForm({
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial: Employee;
  onSave: (e: Employee) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [e, setE] = useState(initial);
  const set = (patch: Partial<Employee>) => setE({ ...e, ...patch });
  const setW4 = (patch: Partial<Employee["w4"]>) => setE({ ...e, w4: { ...e.w4, ...patch } });
  const setDe4 = (patch: Partial<Employee["de4"]>) => setE({ ...e, de4: { ...e.de4, ...patch } });

  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        onSave(e);
      }}
      className="space-y-6"
    >
      <Card>
        <h2 className="mb-4 font-semibold text-slate-900">Employee</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name">
            <Input required value={e.firstName} onChange={(x) => set({ firstName: x.target.value })} />
          </Field>
          <Field label="Last name">
            <Input required value={e.lastName} onChange={(x) => set({ lastName: x.target.value })} />
          </Field>
          <Field label="Last 4 of SSN" hint="Certified payroll shows only the last 4 digits.">
            <Input
              inputMode="numeric"
              maxLength={4}
              pattern="\d{4}"
              value={e.ssnLast4}
              onChange={(x) => set({ ssnLast4: x.target.value.replace(/\D/g, "") })}
            />
          </Field>
          <Field label="Street address">
            <Input maxLength={40} value={e.address} onChange={(x) => set({ address: x.target.value })} />
          </Field>
          <div className="grid grid-cols-[2fr_1fr_1.5fr] gap-3">
            <Field label="City">
              <Input value={e.city ?? ""} onChange={(x) => set({ city: x.target.value })} />
            </Field>
            <Field label="State">
              <Input
                maxLength={2}
                value={e.state ?? ""}
                onChange={(x) => set({ state: x.target.value.toUpperCase().replace(/[^A-Z]/g, "") })}
              />
            </Field>
            <Field label="ZIP">
              <Input inputMode="numeric" maxLength={10} value={e.zip ?? ""} onChange={(x) => set({ zip: x.target.value })} />
            </Field>
          </div>
          <Field label="Regular hourly rate" hint="Used for work that is not prevailing wage.">
            <Input
              inputMode="decimal"
              defaultValue={cents(e.regularRate)}
              onChange={(x) => set({ regularRate: parseMoney(x.target.value) })}
            />
          </Field>
          <div className="flex items-end pb-2">
            <Checkbox
              label="Registered apprentice"
              checked={e.isApprentice}
              onChange={(x) => set({ isApprentice: x.target.checked })}
            />
          </div>
          {e.isApprentice && (
            <>
              <Field label="Apprenticeship program" hint="Shown on certified payroll.">
                <Input value={e.apprenticeProgram ?? ""} onChange={(x) => set({ apprenticeProgram: x.target.value })} />
              </Field>
              <Field label="Apprentice period / level (1-10)" hint="Required for DIR eCPR.">
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={e.apprenticeLevel ?? ""}
                  onChange={(x) => {
                    const n = Number(x.target.value);
                    set({ apprenticeLevel: Number.isInteger(n) && n >= 1 && n <= 10 ? n : undefined });
                  }}
                />
              </Field>
            </>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 font-semibold text-slate-900">Federal W-4</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Filing status (Step 1c)">
            <Select
              value={e.w4.filingStatus}
              onChange={(x) => setW4({ filingStatus: x.target.value as Employee["w4"]["filingStatus"] })}
            >
              <option value="single">Single or married filing separately</option>
              <option value="married_jointly">Married filing jointly</option>
              <option value="head_of_household">Head of household</option>
            </Select>
          </Field>
          <div className="flex items-end pb-2">
            <Checkbox
              label="Step 2 box checked (multiple jobs)"
              checked={e.w4.step2Checkbox}
              onChange={(x) => setW4({ step2Checkbox: x.target.checked })}
            />
          </div>
          <Field label="Step 3 dependents amount (yearly)">
            <Input
              inputMode="decimal"
              defaultValue={cents(e.w4.step3Credits)}
              onChange={(x) => setW4({ step3Credits: parseMoney(x.target.value) })}
            />
          </Field>
          <Field label="Step 4(a) other income (yearly)">
            <Input
              inputMode="decimal"
              defaultValue={cents(e.w4.step4aOtherIncome)}
              onChange={(x) => setW4({ step4aOtherIncome: parseMoney(x.target.value) })}
            />
          </Field>
          <Field label="Step 4(b) deductions (yearly)">
            <Input
              inputMode="decimal"
              defaultValue={cents(e.w4.step4bDeductions)}
              onChange={(x) => setW4({ step4bDeductions: parseMoney(x.target.value) })}
            />
          </Field>
          <Field label="Step 4(c) extra withholding (per check)">
            <Input
              inputMode="decimal"
              defaultValue={cents(e.w4.step4cExtraWithholding)}
              onChange={(x) => setW4({ step4cExtraWithholding: parseMoney(x.target.value) })}
            />
          </Field>
          <Checkbox label="Exempt" checked={!!e.w4.exempt} onChange={(x) => setW4({ exempt: x.target.checked })} />
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 font-semibold text-slate-900">California DE 4</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Filing status">
            <Select
              value={e.de4.filingStatus}
              onChange={(x) => setDe4({ filingStatus: x.target.value as Employee["de4"]["filingStatus"] })}
            >
              <option value="single">Single or married (with two or more incomes)</option>
              <option value="married">Married (one income)</option>
              <option value="head_of_household">Head of household</option>
            </Select>
          </Field>
          <Field label="Withholding allowances (line 1a)">
            <Input
              type="number"
              min={0}
              value={e.de4.allowances}
              onChange={(x) => setDe4({ allowances: Math.max(0, Number(x.target.value) || 0) })}
            />
          </Field>
          <Field label="Additional allowances for estimated deductions (line 1b)">
            <Input
              type="number"
              min={0}
              value={e.de4.additionalAllowances}
              onChange={(x) => setDe4({ additionalAllowances: Math.max(0, Number(x.target.value) || 0) })}
            />
          </Field>
          <Field label="Extra withholding (per check)">
            <Input
              inputMode="decimal"
              defaultValue={cents(e.de4.extraWithholding)}
              onChange={(x) => setDe4({ extraWithholding: parseMoney(x.target.value) })}
            />
          </Field>
          <Checkbox label="Exempt" checked={!!e.de4.exempt} onChange={(x) => setDe4({ exempt: x.target.checked })} />
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Deductions each check</h2>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              set({
                deductions: [...e.deductions, { id: newId(), label: "", amount: 0, preTaxIncome: false, preTaxFica: false }],
              })
            }
          >
            Add deduction
          </Button>
        </div>
        {e.deductions.length === 0 && <p className="text-sm text-slate-500">None, such as union dues or 401(k).</p>}
        <div className="space-y-4">
          {e.deductions.map((d, i) => {
            const setD = (patch: Partial<typeof d>) =>
              set({ deductions: e.deductions.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
            return (
              <div key={d.id ?? i} className="grid items-end gap-3 border-t border-slate-100 pt-4 sm:grid-cols-[2fr_1fr_auto_auto_auto]">
                <Field label="Name">
                  <Input required value={d.label} onChange={(x) => setD({ label: x.target.value })} />
                </Field>
                <Field label="Amount">
                  <Input
                    inputMode="decimal"
                    defaultValue={cents(d.amount)}
                    onChange={(x) => setD({ amount: parseMoney(x.target.value) })}
                  />
                </Field>
                <Checkbox
                  label="Before income tax"
                  checked={d.preTaxIncome}
                  onChange={(x) => setD({ preTaxIncome: x.target.checked })}
                />
                <Checkbox
                  label="Before Social Security"
                  checked={d.preTaxFica}
                  onChange={(x) => setD({ preTaxFica: x.target.checked })}
                />
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => set({ deductions: e.deductions.filter((_, j) => j !== i) })}
                >
                  Remove
                </Button>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button type="submit">Save employee</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        {onDelete && (
          <Button type="button" variant="danger" className="ml-auto" onClick={onDelete}>
            Delete employee
          </Button>
        )}
      </div>
    </form>
  );
}
