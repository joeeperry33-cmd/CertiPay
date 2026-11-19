# CertiPay

Payroll and prevailing wage payroll for small contractors: timesheets by job
and classification, gross pay with fringe, and certified payroll reports.
California first; other states plug in later.

## Scope

In: employees, projects, wage determinations and fringe rates, timesheets,
pay calculation, pay stubs, CA DIR certified payroll and federal WH-347.

Not yet: tax filing and direct deposit. Those carry legal and money-movement
risk and will go through an established payroll provider when added.

## Layout

- `src/lib/payroll/` pay engine (pure TypeScript, unit tested)
  - `overtime/california.ts` CA daily, weekly and 7th-day overtime
  - `gross.ts` basic pay, cash fringe, plan credits, training contributions
- `supabase/migrations/` database schema with row level security per company
- `src/app/` Next.js web app (works on phones and installs to the home screen)

Money is integer cents and hours are integer hundredths of an hour.

## Develop

```bash
npm install
npm test
npm run dev
```
