import { beforeEach, describe, expect, it } from "vitest";
import { getAemsState, resetAemsState } from "@/lib/db/store";
import {
  buildDashboard,
  dashboardCards,
  readDashboardFilters,
} from "@/lib/dashboard";
import type { DashboardCard } from "@/lib/dashboard";
beforeEach(() => resetAemsState());
const run = (query = "", role = "ADMIN") => {
  const s = getAemsState();
  return buildDashboard(
    s,
    s.profiles.find((p) => p.role === role)!,
    readDashboardFilters(new URLSearchParams(query)),
  );
};
describe("Interactive dashboard data consistency", () => {
  it("keeps each selectable card equal to the full filtered list total", () => {
    for (const card of dashboardCards) {
      const data = run(`card=${card}`);
      expect(data.kpis[card]).toBe(data.pagination.total);
      expect(data.rows.length).toBe(Math.min(data.kpis[card], 10));
    }
  });
  it("preserves card/list parity when category, status and location filters combine", () => {
    const s = getAemsState(),
      a = s.assets[0];
    for (const card of dashboardCards) {
      const d = run(
        `card=${card}&status=ACTIVE&category=${a.asset_category_id}&location=${a.location_id}`,
      );
      expect(d.kpis[card]).toBe(d.pagination.total);
      expect(
        d.rows.every((r) => r.status === "ACTIVE" || r.status === "SUBMITTED"),
      ).toBe(true);
    }
  });
  it("filters condition chart, metric and table from the same equipment", () => {
    const d = run("card=equipment&condition=RUSAK_RINGAN");
    expect(d.rows.every((r) => r.condition === "RUSAK_RINGAN")).toBe(true);
    expect(d.charts.conditions.reduce((sum, c) => sum + c.count, 0)).toBe(
      d.kpis.equipment,
    );
    expect(d.kpis.condition).toBe(d.kpis.equipment);
  });
  it("does not misclassify an asset as unmapped just because its equipment is inactive", () => {
    const s = getAemsState(),
      e = s.equipment.find((e) => e.root_asset_id)!;
    e.status = "INACTIVE";
    const asset = s.assets.find((a) => a.id === e.root_asset_id)!;
    const d = run(
      `card=without-equipment&status=ACTIVE&q=${asset.sap_asset_no}`,
    );
    expect(d.rows.some((r) => r.id === asset.id)).toBe(false);
  });
  it("includes descendants of a chosen location, without recursive cycle hangs", () => {
    const s = getAemsState();
    const parent = {
      id: crypto.randomUUID(),
      code: "LOC-PARENT",
      name: "Pabrik",
      parent_id: null as string | null,
      is_active: true,
    };
    s.locations.push(parent);
    s.locations[0].parent_id = parent.id;
    s.locations[1].parent_id = parent.id;
    const expected = s.equipment.filter(
      (e) =>
        !e.deleted_at &&
        [s.locations[0].id, s.locations[1].id, parent.id].includes(
          e.location_id || "",
        ),
    ).length;
    expect(run(`location=${parent.id}`).kpis.equipment).toBe(expected);
    parent.parent_id = s.locations[0].id;
    expect(run(`location=${parent.id}`).kpis.equipment).toBe(expected);
  });
  it("limits manager inbox to assigned requests and staff inbox to their own", () => {
    const s = getAemsState(),
      staff = s.profiles.find((p) => p.role === "MAINTENANCE")!;
    const manager = {
      ...staff,
      id: crypto.randomUUID(),
      account_level: "MANAGER" as const,
    };
    s.profiles.push(manager);
    const req = s.mapping_change_requests[0];
    req.status = "SUBMITTED";
    req.requested_by = staff.id;
    req.approver_id = manager.id;
    const f = readDashboardFilters(new URLSearchParams("card=pending"));
    expect(
      buildDashboard(s, manager, f).rows.some((r) => r.id === req.id),
    ).toBe(true);
    expect(
      buildDashboard(s, { ...manager, id: crypto.randomUUID() }, f).rows,
    ).toHaveLength(0);
    expect(
      run("card=pending", "ACCOUNTING").rows.some((r) => r.id === req.id),
    ).toBe(false);
  });
  it("never exposes other users' audit entries to staff", () => {
    const s = getAemsState(),
      p = s.profiles.find((p) => p.role === "ACCOUNTING")!;
    expect(
      run("", "ACCOUNTING").activities.every(
        (a) => s.audit_logs.find((l) => l.id === a.id)?.actor_id === p.id,
      ),
    ).toBe(true);
  });
  it("paginates beyond ten rows, clamps invalid pages and excludes deleted rows", () => {
    const s = getAemsState(),
      original = s.equipment[0];
    for (let i = 0; i < 15; i++)
      s.equipment.push({
        ...original,
        id: crypto.randomUUID(),
        equipment_no: `PAGE-${i}`,
      });
    const page = run("card=equipment&page=2");
    expect(page.rows).toHaveLength(10);
    expect(page.pagination.total).toBe(
      s.equipment.filter((e) => !e.deleted_at).length,
    );
    const invalid = run("card=equipment&page=99999");
    expect(invalid.pagination.page).toBe(invalid.pagination.total_pages);
  });
  it("returns honest zero counts, no bars or rows for empty search", () => {
    const d = run("q=Nothing-Matches-This&card=equipment");
    expect(d.kpis.equipment).toBe(0);
    expect(d.rows).toEqual([]);
    expect(d.coverage).toBe(0);
    expect(d.charts.conditions.every((c) => c.count === 0)).toBe(true);
  });
  it("normalizes malformed URL selection and search length", () => {
    const f = readDashboardFilters(
      new URLSearchParams("card=not-a-card&page=NaN&q=" + "x".repeat(200)),
    );
    expect(f.card).toBe("equipment" satisfies DashboardCard);
    expect(f.page).toBe(1);
    expect(f.q).toHaveLength(120);
  });
});
