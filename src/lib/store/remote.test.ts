import { describe, expect, it } from "vitest";
import {
  classificationFromRow,
  classificationToRow,
  companyFromRow,
  companyToRow,
  diffById,
  employeeFromRow,
  employeeToRow,
  entryFromRow,
  entryToRow,
  projectFromRow,
  projectToRow,
  syncChanges,
} from "./remote";
import { sampleData, withFreshIds } from "./sample";
import type { SupabaseClient } from "@supabase/supabase-js";

const data = withFreshIds(sampleData("2026-11-16"));
const cid = "00000000-0000-4000-8000-000000000001";

describe("database mapping", () => {
  it("round-trips every record type", () => {
    for (const e of data.employees) expect(employeeFromRow(employeeToRow(e, cid))).toMatchObject(e);
    for (const p of data.projects) expect(projectFromRow(projectToRow(p, cid))).toMatchObject(p);
    for (const c of data.classifications) expect(classificationFromRow(classificationToRow(c, cid))).toEqual(c);
    for (const e of data.entries) expect(entryFromRow(entryToRow(e, cid))).toEqual({ ...e, sortOrder: e.sortOrder ?? 0 });
    expect(companyFromRow(companyToRow(data.company))).toMatchObject(data.company);
  });

  it("gives sample data real UUIDs that still link up", () => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    expect(data.employees.every((e) => uuid.test(e.id))).toBe(true);
    const ids = new Set([...data.employees, ...data.projects, ...data.classifications].map((x) => x.id));
    expect(data.entries.every((e) => ids.has(e.employeeId) && ids.has(e.projectId))).toBe(true);
  });
});

describe("change detection", () => {
  it("finds added, changed and removed records only", () => {
    const [a, b] = data.employees;
    const changed = { ...b, lastName: "Changed" };
    const added = { ...a, id: "new" };
    const d = diffById([a, b], [changed, added]);
    expect(d.upsert.map((x) => x.id)).toEqual([b.id, "new"]);
    expect(d.remove).toEqual([a.id]);
    expect(diffById([a], [{ ...a }]).upsert).toEqual([]);
  });

  it("writes parents before children and deletes children before parents", async () => {
    const calls: string[] = [];
    const table = (name: string) => {
      const q = {
        upsert: () => (calls.push(`upsert ${name}`), Promise.resolve({ error: null })),
        update: () => ({ eq: () => (calls.push(`update ${name}`), Promise.resolve({ error: null })) }),
        delete: () => ({
          in: () => (calls.push(`delete ${name}`), Promise.resolve({ error: null })),
          eq: () => q.delete(),
        }),
      };
      return q;
    };
    const sb = { from: table } as unknown as SupabaseClient;
    await syncChanges(sb, cid, { ...data, employees: [], projects: [], classifications: [], entries: [] }, data);
    expect(calls).toEqual([
      "upsert projects",
      "upsert employees",
      "upsert classification_rates",
      "upsert time_entries",
    ]);
    calls.length = 0;
    await syncChanges(sb, cid, data, { ...data, employees: [], projects: [], classifications: [], entries: [] });
    expect(calls).toEqual([
      "delete time_entries",
      "delete classification_rates",
      "delete employees",
      "delete projects",
    ]);
  });
});
