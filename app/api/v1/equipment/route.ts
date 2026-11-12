import { withAemsPersistence } from "@/lib/db/persistence";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { createEquipment, getAemsState, getEnrichedEquipment } from "@/lib/db/store";
import { AemsError, formatErrorResponse } from "@/lib/utils/errors";
import { createEquipmentSchema } from "@/lib/utils/schemas";

async function handleGET(req: NextRequest) {
  try {
    await getCurrentProfile();
    const state = getAemsState();
    const sp = req.nextUrl.searchParams;

    const q = (sp.get("q") || "").trim().toLowerCase();
    const kind = sp.get("kind") || "";
    const status = sp.get("status") || "";
    const condition = sp.get("condition") || "";
    const locationId = sp.get("location_id") || "";
    const mapping = sp.get("mapping") || (sp.get("unmapped_only") === "true" ? "UNMAPPED" : "");
    const sortBy = sp.get("sort_by") || "equipment_no";
    const sortDir = sp.get("sort_dir") === "desc" ? -1 : 1;
    const page = Math.max(Number(sp.get("page") || 1), 1);
    const pageSize = Math.min(Math.max(Number(sp.get("page_size") || 25), 1), 100);

    let items = getEnrichedEquipment(false).map((e) => ({
      ...e,
      is_unmapped: e.root_asset_id === null,
      parent_kind: e.active_parent_kind,
      parent_label: e.active_parent_no
        ? `${e.active_parent_kind}: ${e.active_parent_no}`
        : "Belum Termapping",
      child_count: state.equipment_relationships.filter(
        (r) => r.parent_equipment_id === e.id && r.valid_to === null
      ).length,
    }));

    if (q) {
      items = items.filter(
        (e) =>
          e.equipment_no.toLowerCase().includes(q) ||
          e.name.toLowerCase().includes(q) ||
          (e.specification || "").toLowerCase().includes(q) ||
          (e.serial_no && e.serial_no.toLowerCase().includes(q)) ||
          (e.root_asset_no && e.root_asset_no.toLowerCase().includes(q))
      );
    }
    if (kind) {
      items = items.filter((e) => e.kind === kind);
    }
    if (status) {
      items = items.filter((e) => e.status === status);
    }
    if (condition) {
      items = items.filter((e) => e.condition === condition);
    }
    if (locationId) {
      items = items.filter((e) => e.location_id === locationId);
    }
    if (mapping === "MAPPED") {
      items = items.filter((e) => e.root_asset_id !== null);
    } else if (mapping === "UNMAPPED") {
      items = items.filter((e) => e.root_asset_id === null);
    }

    items.sort((a, b) => {
      const av = String((a as unknown as Record<string, unknown>)[sortBy] ?? "");
      const bv = String((b as unknown as Record<string, unknown>)[sortBy] ?? "");
      return av.localeCompare(bv, undefined, { numeric: true }) * sortDir;
    });

    const total = items.length;
    const paged = items.slice((page - 1) * pageSize, page * pageSize);

    return NextResponse.json({
      data: paged,
      meta: {
        total,
        page,
        page_size: pageSize,
        total_pages: Math.max(Math.ceil(total / pageSize), 1),
      },
      references: {
        equipment_categories: state.equipment_categories,
        locations: state.locations,
      },
    });
  } catch (err) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    const body = await req.json();
    const parsed = createEquipmentSchema.safeParse(body);
    if (!parsed.success) {
      throw new AemsError(
        "VALIDATION",
        parsed.error.issues.map((i) => i.message).join("; "),
        400,
        { issues: parsed.error.issues }
      );
    }
    const created = createEquipment(profile, parsed.data);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}

export const GET = withAemsPersistence(handleGET);

export const POST = withAemsPersistence(handlePOST);
