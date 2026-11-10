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

export async function GET(
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
      data: asset,
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

export async function PATCH(
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

export async function DELETE(
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
