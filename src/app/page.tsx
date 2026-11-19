import { SampleButton } from "@/components/SampleButton";

const features = [
  {
    title: "California prevailing wage",
    body: "Load DIR wage determinations by county and craft, with base rate and every fringe component.",
  },
  {
    title: "Timesheets by job and classification",
    body: "Split a worker's day across jobs and trades. Daily and weekly overtime is applied automatically.",
  },
  {
    title: "Fringe credit, done right",
    body: "Credit what you pay into approved plans and pay the rest as cash fringe, per component.",
  },
  {
    title: "Certified payroll reports",
    body: "Print CA DIR certified payroll and federal WH-347 with the statement of compliance.",
  },
];

export default function Home() {
  return (
    <main className="py-8">
      <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">CertiPay</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">
        Certified payroll for small contractors
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-slate-600">
        Run regular and prevailing wage payroll and print compliant certified payroll reports,
        without enterprise pricing.
      </p>
      <div className="mt-6">
        <SampleButton />
      </div>
      <p className="mt-3 text-sm text-slate-500">
        Preview: data is saved in this browser only until accounts are set up.
      </p>
      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        {features.map((f) => (
          <div key={f.title} className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="font-semibold text-slate-900">{f.title}</h2>
            <p className="mt-2 text-slate-600">{f.body}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
