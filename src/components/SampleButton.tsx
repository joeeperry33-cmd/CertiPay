"use client";

import { useRouter } from "next/navigation";
import { updateStore, useStore } from "@/lib/store/store";
import { sampleData, withFreshIds } from "@/lib/store/sample";
import { cloudEnabled } from "@/lib/supabase";
import { EMPTY_STORE } from "@/lib/store/types";
import { mondayOf } from "@/lib/dates";
import { Button } from "./ui";

export function SampleButton() {
  const router = useRouter();
  const data = useStore();
  const hasData = data.employees.length > 0 || data.projects.length > 0;

  return (
    <div className="flex flex-wrap gap-2">
      {!(cloudEnabled && hasData) && (
      <Button
        onClick={() => {
          if (hasData && !window.confirm("Replace your current data with sample data?")) return;
          updateStore((s) => {
            const sample = withFreshIds(sampleData(mondayOf()));
            // Signed in: keep the real company details, add sample people and jobs.
            return cloudEnabled ? { ...sample, company: s.company } : sample;
          });
          router.push("/payroll");
        }}
      >
        Try it with sample data
      </Button>
      )}
      <Button variant="secondary" onClick={() => router.push(hasData ? "/timesheets" : "/settings")}>
        {hasData ? "Go to timesheets" : "Set up my company"}
      </Button>
      {hasData && !cloudEnabled && (
        <Button
          variant="danger"
          onClick={() => {
            if (window.confirm("Erase all CertiPay data in this browser?")) updateStore(() => EMPTY_STORE);
          }}
        >
          Erase all data
        </Button>
      )}
    </div>
  );
}
