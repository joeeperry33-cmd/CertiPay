"use client";

import { useState } from "react";
import { Button, Card, Field, Input, PageHeader } from "@/components/ui";
import { updateStore, useStore } from "@/lib/store/store";
import { EMPTY_STORE, type Company } from "@/lib/store/types";

export default function SettingsPage() {
  const data = useStore();
  return (
    <main>
      <PageHeader title="Company" />
      <CompanyForm key={data === EMPTY_STORE ? "empty" : "loaded"} initial={data.company} />
    </main>
  );
}

function CompanyForm({ initial }: { initial: Company }) {
  const [c, setC] = useState(initial);
  const [saved, setSaved] = useState(false);
  const set = (patch: Partial<Company>) => {
    setSaved(false);
    setC({ ...c, ...patch });
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        updateStore((s) => ({ ...s, company: c }));
        setSaved(true);
      }}
    >
      <Card>
        <p className="mb-4 text-sm text-slate-500">These appear on pay stubs and certified payroll reports.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company name">
            <Input required value={c.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label="Address">
            <Input value={c.address} onChange={(e) => set({ address: e.target.value })} />
          </Field>
          <Field label="Federal EIN">
            <Input value={c.fein} onChange={(e) => set({ fein: e.target.value })} />
          </Field>
          <Field label="CSLB license number">
            <Input value={c.cslbLicense} onChange={(e) => set({ cslbLicense: e.target.value })} />
          </Field>
          <Field label="DIR public works registration number">
            <Input value={c.dirRegistration} onChange={(e) => set({ dirRegistration: e.target.value })} />
          </Field>
        </div>
        <div className="mt-6 flex items-center gap-3">
          <Button type="submit">Save</Button>
          {saved && <span className="text-sm text-green-700">Saved</span>}
        </div>
      </Card>
    </form>
  );
}
