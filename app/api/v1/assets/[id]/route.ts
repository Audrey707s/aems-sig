import { withAemsPersistence } from "@/lib/db/persistence";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/session";
import {
  getAemsState,
  getAssetEquipmentTree,
  getEnrichedAssets,
  softDeleteAsset,
  updateAsset,
} from "@/lib/db/store";
import { AemsError, formatErrorResponse } from "@/lib/utils/errors";
import { softDeleteSchema, updateAssetSchema } from "@/lib/utils/schemas";

async function handleGET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getCurrentProfile();
    const { id } = await context.params;
    const asOf = req.nextUrl.searchParams.get("as_of");

    const assets = getEnrichedAssets(profile.role === "ADMIN", profile.role);
    const asset = assets.find((a) => a.id === id);
    if (!asset) {
      throw new AemsError("NOT_FOUND", "Data aset tidak ditemukan.", 404);
    }

    const state = getAemsState();
    const tree = getAssetEquipmentTree(asset.id, asOf, state);
    const directEquipment = state.equipment.filter(
      (e) =>
        e.deleted_at === null &&
        state.equipment_active_parent.some(p => p.equipment_id === e.id && p.parent_kind === "ASSET" && p.parent_id === asset.id)
    );
    const specItems = state.equipment_spec_items.filter(
      (s) => s.asset_id === asset.id
    );
    const mappingHistory = state.mapping_history.filter(
      (h) => h.from_asset_id === asset.id || h.to_asset_id === asset.id
    );
    const auditLogs = state.audit_logs.filter(
      (l) => l.entity_type === "ASSET" && l.entity_id === asset.id
    );

    return NextResponse.json({
      data: {
        ...asset,
        asset,
        references: {categories: state.asset_categories, locations: state.locations},
        category_name: asset.category_name,
        location_name: asset.location_name,
        direct_equipment: directEquipment,
        history: mappingHistory,
        audit_logs: auditLogs,
      },
      tree,
      spec_items: specItems,
      mapping_history: mappingHistory,
      audit_logs: auditLogs,
    });
  } catch (err) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}

async function handlePATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getCurrentProfile();
    const { id } = await context.params;
    const body = await req.json();

    const ifMatchHeader = req.headers.get("If-Match");
    if (ifMatchHeader && body.row_version === undefined) {
      body.row_version = Number(ifMatchHeader);
    }

    const parsed = updateAssetSchema.safeParse(body);
    if (!parsed.success) {
      throw new AemsError(
        "VALIDATION",
        parsed.error.issues.map((i) => i.message).join("; "),
        400
      );
    }

    const updated = updateAsset(profile, id, parsed.data);
    return NextResponse.json({ data: updated });
  } catch (err) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}

async function handleDELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getCurrentProfile();
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const parsed = softDeleteSchema.safeParse(body);
    if (!parsed.success) {
      throw new AemsError(
        "VALIDATION",
        parsed.error.issues.map((i) => i.message).join("; "),
        400
      );
    }

    const deactivated = softDeleteAsset(profile, id, parsed.data.reason);
    return NextResponse.json({ data: deactivated });
  } catch (err) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}

export const GET = withAemsPersistence(handleGET);

export const PATCH = withAemsPersistence(handlePATCH);

export const DELETE = withAemsPersistence(handleDELETE);
