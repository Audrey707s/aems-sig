import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/session";
import {
  getAemsState,
  getEnrichedEquipment,
  getEquipmentBreadcrumb,
  softDeleteEquipment,
  updateEquipment,
} from "@/lib/db/store";
import { AemsError, formatErrorResponse } from "@/lib/utils/errors";
import { softDeleteSchema, updateEquipmentSchema } from "@/lib/utils/schemas";

export async function GET(
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

    return NextResponse.json({
      data: eq,
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
