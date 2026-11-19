"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/employees", label: "Employees" },
  { href: "/projects", label: "Jobs" },
  { href: "/timesheets", label: "Timesheets" },
  { href: "/payroll", label: "Payroll" },
  { href: "/reports", label: "Certified payroll" },
  { href: "/settings", label: "Company" },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="border-b border-slate-200 bg-white print:hidden">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="text-lg font-bold text-blue-800">
          CertiPay
        </Link>
        <nav className="flex flex-wrap gap-1 text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-md px-3 py-1.5 ${
                path.startsWith(l.href) ? "bg-blue-50 font-semibold text-blue-800" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
