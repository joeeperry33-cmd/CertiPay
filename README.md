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
  - `tax/` 2026 federal (Pub 15-T), California (EDD Method B), Social Security, Medicare, SDI
  - `net.ts` gross to net with pre-tax and post-tax deductions
- `supabase/migrations/` database schema with row level security per company
- `src/app/` Next.js web app (works on phones and installs to the home screen)

Money is integer cents and hours are integer hundredths of an hour.

## Develop

```bash
npm install
npm test
npm run dev
```

## Accounts and database (Supabase)

Without settings the app runs as a browser-only preview (data stays in that browser).
To turn on sign-in and the shared database, copy `.env.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_SUPABASE_URL`: the project URL (Project Settings > Data API)
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: the publishable key (Project Settings > API Keys)

Both are safe to expose in the browser: every table has row level security, so a
signed-in user only sees companies they belong to. Set the same two variables on
the hosting provider when deploying, and add the site's URL under
Authentication > URL Configuration so confirmation emails link back to it.

Apply `supabase/migrations/*.sql` in order (SQL editor or `supabase db push`).
