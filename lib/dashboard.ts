import type { AemsDatabaseState } from "@/lib/db/seed-data";
import type { Profile } from "@/lib/types/domain";
export const dashboardCards = [
  "assets",
  "equipment",
  "unmapped",
  "without-equipment",
  "condition",
  "pending",
] as const;
export type DashboardCard = (typeof dashboardCards)[number];
export type DashboardRow = {
  id: string;
  code: string;
  name: string;
  type: string;
  category: string;
  location: string;
  status: string;
  condition: string | null;
  href: string;
};
export type DashboardFilters = {
  card: DashboardCard;
  status: string;
  location: string;
  category: string;
  condition: string;
  q: string;
  page: number;
};
export function readDashboardFilters(
  params: URLSearchParams,
): DashboardFilters {
  return {
    card: dashboardCards.includes(params.get("card") as DashboardCard)
      ? (params.get("card") as DashboardCard)
      : "equipment",
    status: params.get("status") || "",
    location: params.get("location") || "",
    category: params.get("category") || "",
    condition: params.get("condition") || "",
    q: (params.get("q") || "").trim().slice(0, 120),
    page: Math.max(1, Number.parseInt(params.get("page") || "1", 10) || 1),
  };
}
export function buildDashboard(
  state: AemsDatabaseState,
  actor: Profile,
  filter: DashboardFilters,
) {
  const allAssets = state.assets.filter((a) => !a.deleted_at),
    allEquipment = state.equipment.filter((e) => !e.deleted_at);
  const locations = new Set<string>();
  if (filter.location) {
    locations.add(filter.location);
    let changed = true;
    while (changed) {
      changed = false;
      for (const l of state.locations)
        if (l.parent_id && locations.has(l.parent_id) && !locations.has(l.id)) {
          locations.add(l.id);
          changed = true;
        }
    }
  }
  const assetById = new Map(allAssets.map((a) => [a.id, a]));
  const categoryNames = new Map(
    state.asset_categories.map((c) => [c.id, c.name]),
  );
  const locationNames = new Map(state.locations.map((l) => [l.id, l.name]));
  const catName = (id: string | null) =>
    categoryNames.get(id || "") || "Tanpa kategori";
  const locName = (id: string | null) =>
    locationNames.get(id || "") || "Tanpa lokasi";
  const matches = (values: (string | null | undefined)[]) =>
    !filter.q ||
    values.some((v) =>
      v?.toLocaleLowerCase("id").includes(filter.q.toLocaleLowerCase("id")),
    );
  const equipment = allEquipment.filter((e) => {
    const root = e.root_asset_id ? assetById.get(e.root_asset_id) : undefined;
    return (
      (!filter.status || e.status === filter.status) &&
      (!filter.location || locations.has(e.location_id || "")) &&
      (!filter.category ||
        (filter.category === "none"
          ? !root?.asset_category_id
          : root?.asset_category_id === filter.category)) &&
      (!filter.condition || e.condition === filter.condition) &&
      matches([
        e.name,
        e.equipment_no,
        e.serial_no,
        e.specification,
        root?.sap_asset_no,
        root?.name,
      ])
    );
  });
  const equipmentIds = new Set(equipment.map((e) => e.id));
  const visibleRootIds = new Set(equipment.map((e) => e.root_asset_id));
  const assets = allAssets.filter(
    (a) =>
      (!filter.status || a.status === filter.status) &&
      (!filter.location || locations.has(a.location_id || "")) &&
      (!filter.category ||
        (filter.category === "none"
          ? !a.asset_category_id
          : a.asset_category_id === filter.category)) &&
      (!filter.condition || visibleRootIds.has(a.id)) &&
      matches([a.name, a.sap_asset_no, a.serial_no, a.cost_center]),
  );
  // Relationship existence is independent of display filters and child lifecycle status.
  const mappedAssetIds = new Set(
    allEquipment.map((e) => e.root_asset_id).filter(Boolean),
  );
  const unmapped = equipment.filter((e) => !e.root_asset_id),
    without = assets.filter((a) => !mappedAssetIds.has(a.id)),
    problem = equipment.filter((e) => e.condition !== "BAIK");
  const scoped = !!(
    filter.status ||
    filter.location ||
    filter.category ||
    filter.condition ||
    filter.q
  );
  const pending = state.mapping_change_requests.filter(
    (r) =>
      r.status === "SUBMITTED" &&
      (actor.role === "ADMIN" ||
        r.requested_by === actor.id ||
        (actor.account_level === "MANAGER" && r.approver_id === actor.id)) &&
      (!scoped || r.items.some((i) => equipmentIds.has(i.equipment_id))),
  );
  const assetRow = (a: (typeof assets)[number]): DashboardRow => ({
    id: a.id,
    code: a.sap_asset_no,
    name: a.name,
    type: "Aset",
    category: catName(a.asset_category_id),
    location: locName(a.location_id),
    status: a.status,
    condition:
      typeof a.attributes?.physical_condition === "string"
        ? a.attributes.physical_condition
        : null,
    href: `/assets/${a.id}`,
  });
  const equipmentRow = (e: (typeof equipment)[number]): DashboardRow => ({
    id: e.id,
    code: e.equipment_no,
    name: e.name,
    type: "Equipment",
    category: catName(
      e.root_asset_id
        ? assetById.get(e.root_asset_id)?.asset_category_id || null
        : null,
    ),
    location: locName(e.location_id),
    status: e.status,
    condition: e.condition,
    href: `/equipment/${e.id}`,
  });
  const rows: DashboardRow[] =
    filter.card === "assets"
      ? assets.map(assetRow)
      : filter.card === "without-equipment"
        ? without.map(assetRow)
        : filter.card === "pending"
          ? pending.map((r) => ({
              id: r.id,
              code: r.request_code,
              name: r.reason,
              type: "Pengajuan",
              category: r.requester_name,
              location: "—",
              status: r.status,
              condition: null,
              href: "/mapping?tab=inbox",
            }))
          : (filter.card === "unmapped"
              ? unmapped
              : filter.card === "condition"
                ? problem
                : equipment
            ).map(equipmentRow);
  rows.sort((a, b) => a.code.localeCompare(b.code, "id", { numeric: true }));
  const total = rows.length,
    pageSize = 10,
    totalPages = Math.max(1, Math.ceil(total / pageSize)),
    page = Math.min(filter.page, totalPages);
  return {
    kpis: {
      assets: assets.length,
      equipment: equipment.length,
      unmapped: unmapped.length,
      "without-equipment": without.length,
      condition: problem.length,
      pending: pending.length,
    },
    coverage: equipment.length
      ? Math.round(
          ((equipment.length - unmapped.length) / equipment.length) * 100,
        )
      : 0,
    charts: {
      categories: [
        ...state.asset_categories.map((c) => ({
          id: c.id,
          name: c.name,
          count: assets.filter((a) => a.asset_category_id === c.id).length,
        })),
        {
          id: "none",
          name: "Tanpa kategori",
          count: assets.filter((a) => !a.asset_category_id).length,
        },
      ].filter((c) => c.count > 0 || c.id === filter.category),
      conditions: [
        "BAIK",
        "RUSAK_RINGAN",
        "RUSAK_BERAT",
        "DALAM_PERBAIKAN",
      ].map((id) => ({
        id,
        name: id.replaceAll("_", " "),
        count: equipment.filter((e) => e.condition === id).length,
      })),
      locations: state.locations
        .map((l) => ({
          id: l.id,
          name: l.name,
          assets: assets.filter((a) => a.location_id === l.id).length,
          equipment: equipment.filter((e) => e.location_id === l.id).length,
        }))
        .filter((l) => l.assets + l.equipment > 0 || l.id === filter.location),
    },
    rows: rows.slice((page - 1) * pageSize, page * pageSize),
    pagination: { page, page_size: pageSize, total, total_pages: totalPages },
    references: {
      categories: state.asset_categories.filter((c) => c.is_active),
      locations: state.locations.filter((l) => l.is_active),
    },
    open_findings: state.reconciliation_findings.filter(
      (f) => f.status === "OPEN",
    ).length,
    activities: state.audit_logs
      .filter((a) => actor.role === "ADMIN" || a.actor_id === actor.id)
      .slice(0, 5)
      .map((a) => ({
        id: a.id,
        name: a.actor_name,
        action: a.action,
        code: a.entity_code,
        occurred_at: a.occurred_at,
      })),
    filters: filter,
  };
}
export type DashboardData = ReturnType<typeof buildDashboard>;
