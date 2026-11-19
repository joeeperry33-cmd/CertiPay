"use client";

import { useMemo, useState } from "react";
import { Button, Card, Checkbox, Empty, Field, PageHeader, Select } from "@/components/ui";
import { WeekPicker } from "@/components/WeekPicker";
import { CertifiedPayrollReport, type ReportFormat } from "@/components/CertifiedPayrollReport";
import { useStore } from "@/lib/store/store";
import { buildCertifiedPayroll } from "@/lib/reports/certified";
import { mondayOf } from "@/lib/dates";

export default function ReportsPage() {
  const data = useStore();
  const pwJobs = data.projects.filter((p) => p.isPrevailingWage);
  const [projectId, setProjectId] = useState("");
  const [weekStart, setWeekStart] = useState(mondayOf());
  const [format, setFormat] = useState<ReportFormat | "">("");
  const [finalPayroll, setFinalPayroll] = useState(false);

  const project = pwJobs.find((p) => p.id === projectId) ?? pwJobs[0];
  const chosenFormat: ReportFormat = format || (project?.isFederal ? "wh347" : "ca");
  const report = useMemo(
    () => (project ? buildCertifiedPayroll(data, project.id, weekStart) : null),
    [data, project, weekStart],
  );

  if (!project || !report) {
    return (
      <main>
        <PageHeader title="Certified payroll" />
        <Empty>Add a prevailing wage job on the Jobs page to create certified payroll reports.</Empty>
      </main>
    );
  }

  const missing = [
    !data.company.name && "company name",
    !data.company.signerName && "who signs the reports",
    chosenFormat === "ca" && !project.dirProjectId && "DIR project ID for this job",
    !data.company.dirRegistration && chosenFormat === "ca" && "DIR registration number",
  ].filter(Boolean);

  return (
    <main>
      <div className="print:hidden">
        <PageHeader title="Certified payroll">
          <WeekPicker weekStart={weekStart} onChange={setWeekStart} />
          <Button onClick={() => window.print()}>Print / save PDF</Button>
        </PageHeader>
        <Card className="mb-6">
          <div className="grid items-end gap-4 sm:grid-cols-3">
            <Field label="Job">
              <Select value={project.id} onChange={(e) => setProjectId(e.target.value)}>
                {pwJobs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Form">
              <Select value={chosenFormat} onChange={(e) => setFormat(e.target.value as ReportFormat)}>
                <option value="ca">California (DIR certified payroll)</option>
                <option value="wh347">Federal WH-347 (Davis-Bacon)</option>
              </Select>
            </Field>
            <div className="pb-2">
              <Checkbox label="Final payroll for this job" checked={finalPayroll} onChange={(e) => setFinalPayroll(e.target.checked)} />
            </div>
          </div>
          {missing.length > 0 && (
            <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
              Missing on the report: {missing.join(", ")}. Add these on the Company and Jobs pages.
            </p>
          )}
          <p className="mt-4 text-xs text-slate-500">
            California payrolls must also be submitted to DIR through eCPR. Print this report for the awarding body
            and your records. Some federal agencies require the official DOL WH-347 PDF; this report carries the same
            information.
          </p>
        </Card>
      </div>
      <CertifiedPayrollReport report={report} format={chosenFormat} finalPayroll={finalPayroll} />
    </main>
  );
}
