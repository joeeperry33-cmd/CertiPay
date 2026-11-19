import type { CertifiedPayroll, CprWorkerRow } from "@/lib/reports/certified";
import { hrs, money, parseDate } from "@/lib/dates";
import type { PayBucket } from "@/lib/payroll/types";

export type ReportFormat = "ca" | "wh347";

const longDate = (d: string) =>
  parseDate(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
const dayHead = (d: string) => {
  const x = parseDate(d);
  return { day: x.toLocaleDateString("en-US", { weekday: "short" }), date: `${x.getMonth() + 1}/${x.getDate()}` };
};
const blank = (v: number) => (v ? hrs(v).replace(/\.00$/, "") : "");
const BUCKET_CODE: Record<PayBucket, string> = { straight: "S", overtime: "O", double: "D" };

/** Printable certified payroll report (landscape). */
export function CertifiedPayrollReport({
  report: r,
  format,
  finalPayroll,
}: {
  report: CertifiedPayroll;
  format: ReportFormat;
  finalPayroll: boolean;
}) {
  const ca = format === "ca";
  const title = ca ? "Public Works Certified Payroll Report" : "Certified Payroll (WH-347 information)";

  return (
    <article className="cpr mx-auto bg-white p-6 text-[11px] leading-tight print:text-[8.5px] text-black shadow-sm print:p-0 print:shadow-none">
      <style>{`@media print { @page { size: letter landscape; margin: 0.35in; } body { background: white; } }`}</style>

      <header className="mb-3 flex flex-wrap items-start justify-between gap-4 border-b-2 border-black pb-2">
        <div>
          <h1 className="text-base font-bold uppercase">{title}</h1>
          <p className="text-[10px]">
            {ca
              ? "Information required by California Labor Code §1776 (DIR form A-1-131 format)"
              : "Davis-Bacon and Related Acts, 29 CFR 5.5(a)(3)"}
          </p>
        </div>
        <div className="text-right">
          <div>
            <b>Payroll no.</b> {r.payrollNumber || "–"}
            {finalPayroll && <b className="ml-2 uppercase">Final</b>}
          </div>
          <div>
            <b>Week ending</b> {longDate(r.weekEnding)}
          </div>
        </div>
      </header>

      <section className="mb-3 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
        <Info label={ca ? "Contractor" : "Prime / subcontractor"} value={r.company.name} />
        <Info label="Address" value={r.company.address} />
        <Info label="Federal EIN" value={r.company.fein} />
        {ca && <Info label="CSLB license no." value={r.company.cslbLicense} />}
        {ca && <Info label="DIR registration no." value={r.company.dirRegistration} />}
        <Info label="Project name" value={r.project.name} />
        <Info label="Project location" value={[r.project.location, r.project.county && `${r.project.county} County`].filter(Boolean).join(", ")} />
        <Info label="Project / contract no." value={r.project.projectNumber} />
        {ca && <Info label="DIR project ID" value={r.project.dirProjectId} />}
        <Info label="Awarding body" value={r.project.awardingBody} />
        <Info label="Wage determination no." value={r.project.wageDeterminationNumber ?? ""} />
      </section>

      {r.noWork && r.payrollNumber === 0 ? (
        <p className="my-6 text-[12px]">This job has no work recorded on or before this week, so no report is due yet.</p>
      ) : r.noWork ? (
        <NonPerformance r={r} />
      ) : (
        <WorkerTable r={r} ca={ca} />
      )}

      {!r.noWork && (
        <section className="mt-2 grid grid-cols-2 gap-6 sm:grid-cols-4">
          <Info label="Total hours on project" value={hrs(r.totals.hours)} />
          <Info label="Gross wages on project" value={money(r.totals.grossThisJob)} />
          <Info label="Fringe paid to plans" value={money(r.totals.fringeToPlans)} />
          <Info label="Training contributions" value={money(r.totals.training)} />
        </section>
      )}

      <div className="mt-4 break-inside-avoid">{ca ? <CaStatement r={r} /> : <FederalStatement r={r} />}</div>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[9px] font-semibold uppercase text-slate-600">{label}</span>
      <div className="min-h-[14px] border-b border-slate-300">{value}</div>
    </div>
  );
}

function WorkerTable({ r, ca }: { r: CertifiedPayroll; ca: boolean }) {
  const cell = "border border-slate-400 px-1 py-0.5";
  const num = `${cell} text-right tabular-nums`;
  return (
    <div className="overflow-x-auto print:overflow-visible">
      <table className="w-full min-w-[1000px] border-collapse print:min-w-0">
        <thead className="bg-slate-100 text-[9px] uppercase">
          <tr>
            <th className={cell} rowSpan={2}>
              No.
            </th>
            <th className={`${cell} w-[13%] text-left`} rowSpan={2}>
              Name, {ca ? "address, " : ""}SSN (last 4)
            </th>
            <th className={cell} rowSpan={2}>
              J / A
            </th>
            <th className={`${cell} w-[9%] text-left`} rowSpan={2}>
              Work classification
            </th>
            <th className={cell} rowSpan={2}>
              Pay
            </th>
            {r.dates.map((d) => (
              <th key={d} className={cell}>
                {dayHead(d).day}
              </th>
            ))}
            <th className={cell} rowSpan={2}>
              Total hrs
            </th>
            <th className={cell} rowSpan={2}>
              Hourly rate
            </th>
            <th className={cell} rowSpan={2}>
              {ca ? "Fringe in pay /hr" : "Payment in lieu of fringe /hr"}
            </th>
            <th className={cell} rowSpan={2}>
              {ca ? "Fringe to plans /hr" : "Fringe credit to plans /hr"}
            </th>
            <th className={cell} rowSpan={2}>
              Gross this project
            </th>
            <th className={cell} rowSpan={2}>
              Gross all work
            </th>
            <th className={cell} colSpan={ca ? 6 : 4}>
              Deductions
            </th>
            <th className={cell} rowSpan={2}>
              Net pay
            </th>
            <th className={cell} rowSpan={2}>
              Check no.
            </th>
          </tr>
          <tr>
            {r.dates.map((d) => (
              <th key={d} className={cell}>
                {dayHead(d).date}
              </th>
            ))}
            <th className={cell}>Fed tax</th>
            <th className={cell}>{ca ? "SS" : "FICA"}</th>
            {ca && <th className={cell}>Medi­care</th>}
            <th className={cell}>{ca ? "CA tax" : "State tax"}</th>
            {ca && <th className={cell}>SDI</th>}
            <th className={cell}>Other</th>
          </tr>
        </thead>
        <tbody>
          {r.rows.map((row, i) => (
            <WorkerRows key={i} row={row} dates={r.dates} ca={ca} cell={cell} num={num} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WorkerRows({
  row,
  dates,
  ca,
  cell,
  num,
}: {
  row: CprWorkerRow;
  dates: string[];
  ca: boolean;
  cell: string;
  num: string;
}) {
  const buckets: PayBucket[] = row.totalHours.double > 0 ? ["straight", "overtime", "double"] : ["straight", "overtime"];
  const span = buckets.length;
  const e = row.employee;
  const c = row.check;
  const otherTotal = c ? c.other.reduce((s, o) => s + o.amount, 0) : 0;
  const fica = c ? c.socialSecurity + c.medicare : 0;

  return (
    <>
      {buckets.map((b, i) => (
        <tr key={b} className={i === span - 1 ? "border-b-2 border-slate-500" : ""}>
          {i === 0 && (
            <>
              <td className={`${cell} text-center`} rowSpan={span}>
                {row.entryNumber}
              </td>
              <td className={cell} rowSpan={span}>
                <div className="font-semibold">
                  {e.lastName}, {e.firstName}
                </div>
                {ca && e.address && <div>{e.address}</div>}
                <div>xxx-xx-{e.ssnLast4 || "____"}</div>
              </td>
              <td className={`${cell} text-center`} rowSpan={span}>
                {row.isApprentice ? "A" : "J"}
              </td>
              <td className={cell} rowSpan={span}>
                {row.classification}
                {row.isApprentice && e.apprenticeProgram && <div className="text-[9px]">{e.apprenticeProgram}</div>}
              </td>
            </>
          )}
          <td className={`${cell} text-center font-semibold`}>{BUCKET_CODE[b]}</td>
          {dates.map((d, j) => (
            <td key={d} className={`${num} w-8`}>
              {blank(row.hours[b][j])}
            </td>
          ))}
          <td className={num}>{blank(row.totalHours[b])}</td>
          <td className={num}>{money(row.rate[b])}</td>
          {i === 0 && (
            <>
              <td className={num} rowSpan={span}>
                {money(row.cashFringeRate)}
              </td>
              <td className={num} rowSpan={span}>
                {money(row.planFringeRate)}
                {row.trainingRate > 0 && <div className="text-[9px]">+{money(row.trainingRate)} training</div>}
              </td>
              <td className={num} rowSpan={span}>
                {money(row.grossThisJob)}
              </td>
              <td className={num} rowSpan={span}>
                {c ? money(c.grossAllWork) : ""}
              </td>
              <td className={num} rowSpan={span}>
                {c ? money(c.federalIncomeTax) : ""}
              </td>
              {ca ? (
                <>
                  <td className={num} rowSpan={span}>
                    {c ? money(c.socialSecurity) : ""}
                  </td>
                  <td className={num} rowSpan={span}>
                    {c ? money(c.medicare) : ""}
                  </td>
                </>
              ) : (
                <td className={num} rowSpan={span}>
                  {c ? money(fica) : ""}
                </td>
              )}
              <td className={num} rowSpan={span}>
                {c ? money(c.stateIncomeTax + (ca ? 0 : c.sdi)) : ""}
              </td>
              {ca && (
                <td className={num} rowSpan={span}>
                  {c ? money(c.sdi) : ""}
                </td>
              )}
              <td className={num} rowSpan={span}>
                {c && (
                  <>
                    {money(otherTotal)}
                    {c.other.map((o) => (
                      <div key={o.label} className="text-[9px]">
                        {o.label}
                      </div>
                    ))}
                  </>
                )}
              </td>
              <td className={`${num} font-semibold`} rowSpan={span}>
                {c ? money(c.netPay) : ""}
              </td>
              <td className={cell} rowSpan={span} />
            </>
          )}
        </tr>
      ))}
    </>
  );
}

function NonPerformance({ r }: { r: CertifiedPayroll }) {
  return (
    <section className="my-6 border-2 border-black p-4 text-[12px]">
      <h2 className="mb-2 font-bold uppercase">Statement of non-performance</h2>
      <p>
        No work was performed on this project by {r.company.name || "the contractor"} during the week of{" "}
        {longDate(r.weekStart)} through {longDate(r.weekEnding)}.
      </p>
    </section>
  );
}

function Signature({ r }: { r: CertifiedPayroll }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-4">
      <Info label="Name" value={r.company.signerName ?? ""} />
      <Info label="Title" value={r.company.signerTitle ?? ""} />
      <Info label="Signature" value="" />
      <Info label="Date" value="" />
      {(r.company.phone || r.company.email) && (
        <Info label="Contact" value={[r.company.phone, r.company.email].filter(Boolean).join(" · ")} />
      )}
    </div>
  );
}

function CaStatement({ r }: { r: CertifiedPayroll }) {
  return (
    <section className="border border-black p-3">
      <h2 className="mb-2 font-bold uppercase">Statement of compliance</h2>
      <p>
        I, <u>{r.company.signerName || "________________"}</u>, the undersigned, am the{" "}
        <u>{r.company.signerTitle || "________________"}</u> with the authority to act for and on behalf of{" "}
        <u>{r.company.name || "________________"}</u>, and certify under penalty of perjury that the records or copies
        thereof submitted, consisting of payroll no. {r.payrollNumber} for the week ending {longDate(r.weekEnding)}, are
        the originals or true, full and correct copies of the originals, which depict the payroll record(s) of the
        actual disbursements by way of cash, check, or whatever form to the individual or individuals named.
      </p>
      <Signature r={r} />
    </section>
  );
}

function FederalStatement({ r }: { r: CertifiedPayroll }) {
  const apprentices = r.rows.filter((x) => x.isApprentice && x.check);
  return (
    <section className="border border-black p-3">
      <h2 className="mb-2 font-bold uppercase">Statement of compliance</h2>
      <p className="mb-2">
        I, <u>{r.company.signerName || "________________"}</u>, <u>{r.company.signerTitle || "________________"}</u>, pay
        or supervise the payment of the persons employed by <u>{r.company.name || "________________"}</u> on the{" "}
        <u>{r.project.name}</u>, and certify that during the payroll period from {longDate(r.weekStart)} to{" "}
        {longDate(r.weekEnding)}:
      </p>
      <ol className="ml-5 list-decimal space-y-1">
        <li>
          All persons employed on the project have been paid the full weekly wages earned, and no rebates have been or
          will be made, directly or indirectly, from those wages other than permissible deductions.
        </li>
        <li>
          This payroll is correct and complete; the wage rates are not less than those in the applicable wage
          determination; and each worker&apos;s classification matches the work performed.
        </li>
        <li>
          Any apprentices employed are registered in a bona fide apprenticeship program registered with the DOL Office
          of Apprenticeship or a recognized State Apprenticeship Agency
          {apprentices.length > 0 ? (
            <>
              : {apprentices.map((a) => `${a.employee.firstName} ${a.employee.lastName} (${a.classification}${a.employee.apprenticeProgram ? `, ${a.employee.apprenticeProgram}` : ""})`).join("; ")}.
            </>
          ) : (
            ". No apprentices were employed this period."
          )}
        </li>
        <li>
          Fringe benefits: amounts shown as &ldquo;fringe credit to plans&rdquo; have been or will be paid to approved
          plans, funds or programs; amounts shown as &ldquo;payment in lieu of fringe&rdquo; were paid in cash to the
          workers in addition to their basic hourly rate. Total fringe to plans this period:{" "}
          {money(r.totals.fringeToPlans + r.totals.training)}.
        </li>
      </ol>
      <div className="mt-2">
        <span className="text-[9px] font-semibold uppercase text-slate-600">Exceptions / remarks</span>
        <div className="min-h-[28px] border-b border-slate-300" />
      </div>
      <Signature r={r} />
      <p className="mt-3 text-[9px]">
        The willful falsification of any of the above statements may subject the contractor or subcontractor to civil
        or criminal prosecution. See 18 U.S.C. 1001 and 31 U.S.C. 3729.
      </p>
    </section>
  );
}
