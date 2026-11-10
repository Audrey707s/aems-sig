import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { getDashboardSummary, getAemsState } from "@/lib/db/store";
import { formatErrorResponse } from "@/lib/utils/errors";

export async function GET(req: NextRequest) {
  try {
    await getCurrentProfile();
    const summary = getDashboardSummary();
    const state = getAemsState();
    const statusFilter = req.nextUrl.searchParams.get("status") || "";

    const activeAssets = state.assets.filter(
      (a) => a.deleted_at === null && (!statusFilter || a.status === statusFilter)
    );
    const activeEquipment = state.equipment.filter(
      (e) => e.deleted_at === null && (!statusFilter || e.status === statusFilter)
    );

    const mappedAssetIds = new Set<string>();
    for (const eq of activeEquipment) {
      if (eq.root_asset_id) mappedAssetIds.add(eq.root_asset_id);
    }

    const unmappedEquipmentCount = activeEquipment.filter(
      (e) => e.root_asset_id === null
    ).length;
    const assetsWithoutEquipment = activeAssets.filter(
      (a) => !mappedAssetIds.has(a.id)
    ).length;

    const conditions = ["BAIK", "RUSAK_RINGAN", "RUSAK_BERAT", "DALAM_PERBAIKAN"] as const;
    const equipmentByCondition = conditions.map((condition) => ({
      condition,
      count: activeEquipment.filter((e) => e.condition === condition).length,
    }));

    const assetsByCategory = state.asset_categories.map((cat) => ({
      category: cat.name,
      count: activeAssets.filter((a) => a.asset_category_id === cat.id).length,
    }));

    const assetsByLocation = state.locations.map((loc) => ({
      location: loc.name,
      assets: activeAssets.filter((a) => a.location_id === loc.id).length,
      equipment: activeEquipment.filter((e) => e.location_id === loc.id).length,
    }));

    return NextResponse.json({
      ...summary,
      data: {
        kpis: {
          total_assets: activeAssets.length,
          total_equipment: activeEquipment.length,
          unmapped_equipment: unmappedEquipmentCount,
          assets_without_equipment: assetsWithoutEquipment,
          pending_mapping_requests: summary.pending_approvals,
          open_reconciliation_findings: summary.open_findings,
        },
        assets_by_category: assetsByCategory,
        equipment_by_condition: equipmentByCondition,
        assets_by_location: assetsByLocation,
        recent_activities: state.audit_logs.slice(0, 8),
      },
      references: {
        asset_categories: state.asset_categories,
        equipment_categories: state.equipment_categories,
        locations: state.locations,
      },
    });
  } catch (err) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}
