"use client";

import { useMemo, useState } from "react";
import { Button, Card, Input } from "./ui";
import { updateStore } from "@/lib/store/store";
import type { StoreData } from "@/lib/store/types";
import type { CertifiedPayroll } from "@/lib/reports/certified";
import { buildEcprXml } from "@/lib/reports/ecpr";

/**
 * Full SSNs/ITINs are kept in memory for this browser tab only and are never
 * saved, so they have to be re-entered after a reload.
 */
const taxIdMemory: Record<string, { ssn?: string; itin?: string }> = {};

export function checkNumbersFor(data: StoreData, weekStart: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data.checkNumbers ?? {})) {
    const [w, id] = k.split(":");
    if (w === weekStart) out[id] = v;
  }
  return out;
}

export function EcprPanel({ report, data, weekStart }: { report: CertifiedPayroll; data: StoreData; weekStart: string }) {
  const [taxIds, setTaxIds] = useState(() => ({ ...taxIdMemory }));
  const checkNumbers = checkNumbersFor(data, weekStart);
  const workers = useMemo(() => {
    const seen = new Map<string, CertifiedPayroll["rows"][number]["employee"]>();
    for (const r of report.rows) seen.set(r.employee.id, r.employee);
    return [...seen.values()];
  }, [report]);

  const { xml, errors } = buildEcprXml({ report, classifications: data.classifications, taxIds, checkNumbers });

  const setTaxId = (id: string, value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 9);
    // ITINs start with 9; everything else is treated as an SSN.
    const entry = digits.startsWith("9") ? { itin: digits } : { ssn: digits };
    taxIdMemory[id] = entry;
    setTaxIds({ ...taxIdMemory });
  };

  const setCheck = (id: string, value: string) =>
    updateStore((s) => ({ ...s, checkNumbers: { ...(s.checkNumbers ?? {}), [`${weekStart}:${id}`]: value.slice(0, 20) } }));

  const download = () => {
    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `eCPR_${report.project.dirProjectId || "project"}_${report.weekEnding}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="mb-6 print:hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900">DIR eCPR upload file</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Download this week&apos;s payroll as an XML file (DIR eCPR version 2.0), then upload it at{" "}
            <a className="text-blue-700 underline" href="https://services.dir.ca.gov/pw" target="_blank" rel="noreferrer">
              services.dir.ca.gov/pw
            </a>{" "}
            using Submit → XML. You can upload as a draft to review it before submitting.
          </p>
        </div>
        <Button onClick={download} disabled={errors.length > 0}>
          Download eCPR XML
        </Button>
      </div>

      {report.noWork ? (
        <p className="mt-4 text-sm text-slate-600">No work this week: the file will be a statement of non-performance.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-2 font-medium">Worker</th>
                <th className="py-2 font-medium">Full SSN or ITIN</th>
                <th className="py-2 font-medium">Check no.</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((e) => {
                const ids = taxIds[e.id] ?? {};
                return (
                  <tr key={e.id} className="border-t border-slate-100">
                    <td className="py-2 pr-3">
                      {e.firstName} {e.lastName}
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        aria-label={`SSN or ITIN for ${e.firstName} ${e.lastName}`}
                        type="password"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder={`•••-••-${e.ssnLast4 || "••••"}`}
                        value={ids.ssn ?? ids.itin ?? ""}
                        onChange={(x) => setTaxId(e.id, x.target.value)}
                      />
                    </td>
                    <td className="py-2">
                      <Input
                        aria-label={`Check number for ${e.firstName} ${e.lastName}`}
                        placeholder="e.g. 1042 or CASH"
                        value={checkNumbers[e.id] ?? ""}
                        onChange={(x) => setCheck(e.id, x.target.value)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-slate-500">
            Full SSNs are not saved anywhere. They stay in this browser tab only and must be entered again after a reload.
          </p>
        </div>
      )}

      {errors.length > 0 && (
        <div className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">Fix these before downloading:</p>
          <ul className="mt-1 list-disc pl-5">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
