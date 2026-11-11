import { withAemsPersistence } from "@/lib/db/persistence";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/session";
import {
  addEquipmentSpecItem,
  getAemsState,
  getEnrichedEquipment,
  getEquipmentBreadcrumb,
  promoteSpecItemToEquipment,
  softDeleteEquipment,
  updateEquipment,
} from "@/lib/db/store";
import { AemsError, formatErrorResponse } from "@/lib/utils/errors";
import { softDeleteSchema, updateEquipmentSchema } from "@/lib/utils/schemas";

async function handleGET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getCurrentProfile();
    const { id } = await context.params;
    const state = getAemsState();

    const allEq = getEnrichedEquipment(profile.role === "ADMIN");
    const eq = allEq.find((e) => e.id === id);
    if (!eq) {
      throw new AemsError("NOT_FOUND", "Data equipment tidak ditemukan.", 404);
    }

    const breadcrumb = getEquipmentBreadcrumb(eq.id, state);
    const activeChildIds = new Set(
      state.equipment_relationships
        .filter((r) => r.parent_equipment_id === eq.id && r.valid_to === null)
        .map((r) => r.child_equipment_id)
    );
    const children = allEq.filter((e) => activeChildIds.has(e.id));
    const specItems = state.equipment_spec_items.filter(
      (s) => s.equipment_id === eq.id
    );
    const movementHistory = state.mapping_history.filter(
      (h) => h.equipment_id === eq.id
    );
    const auditLogs = state.audit_logs.filter(
      (l) => l.entity_type === "EQUIPMENT" && l.entity_id === eq.id
    );
    const activeParentSlot =
      state.equipment_active_parent.find((p) => p.equipment_id === eq.id) || null;
    const rootAsset = eq.root_asset_id
      ? state.assets.find((a) => a.id === eq.root_asset_id) || null
      : null;

    return NextResponse.json({
      data: {
        ...eq,
        equipment: eq,
        active_parent: activeParentSlot,
        root_asset: rootAsset,
        direct_children: children,
        specs: specItems,
        history: movementHistory,
      },
      breadcrumb,
      children,
      spec_items: specItems,
      movement_history: movementHistory,
      audit_logs: auditLogs,
    });
  } catch (err) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}

async function handlePOST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getCurrentProfile();
    const { id } = await context.params;
    const body = await req.json();

    if (body.action === "ADD_SPEC") {
      const created = addEquipmentSpecItem(profile, {
        equipment_id: id,
        spec_name: String(body.spec_name || ""),
        spec_value: String(body.spec_value || ""),
        spec_group: body.spec_group ? String(body.spec_group) : "General",
      });
      return NextResponse.json({ data: created }, { status: 201 });
    }

    if (body.action === "PROMOTE_SPEC") {
      const promoted = promoteSpecItemToEquipment(profile, {
        spec_item_id: String(body.spec_item_id || ""),
        equipment_no: String(body.equipment_no || ""),
        reason: String(body.reason || "Promosi spesifikasi ke equipment resmi"),
      });
      return NextResponse.json({ data: promoted }, { status: 201 });
    }

    throw new AemsError("VALIDATION", "Tindakan pada equipment tidak dikenali.", 400);
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

    const parsed = updateEquipmentSchema.safeParse(body);
    if (!parsed.success) {
      throw new AemsError(
        "VALIDATION",
        parsed.error.issues.map((i) => i.message).join("; "),
        400
      );
    }

    const updated = updateEquipment(profile, id, parsed.data);
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
    if (body.cascade_subtree !== undefined && body.cascade_descendants === undefined) {
      body.cascade_descendants = Boolean(body.cascade_subtree);
    }
    const parsed = softDeleteSchema.safeParse(body);
    if (!parsed.success) {
      throw new AemsError(
        "VALIDATION",
        parsed.error.issues.map((i) => i.message).join("; "),
        400
      );
    }

    const deactivated = softDeleteEquipment(
      profile,
      id,
      parsed.data.reason,
      parsed.data.cascade_descendants
    );
    return NextResponse.json({ data: deactivated });
  } catch (err) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}

export const GET = withAemsPersistence(handleGET);

export const POST = withAemsPersistence(handlePOST);

export const PATCH = withAemsPersistence(handlePATCH);

export const DELETE = withAemsPersistence(handleDELETE);
