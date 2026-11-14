import { matchesSelected, sortTableRows, equipmentSortKeys } from "@/lib/table-query";
import { withAemsPersistence } from "@/lib/db/persistence";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/session";
import {
  createEquipment,
  getAemsState,
  getEnrichedEquipment,
} from "@/lib/db/store";
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
    const mapping =
      sp.get("mapping") ||
      (sp.get("unmapped_only") === "true" ? "UNMAPPED" : "");
    const sortBy = sp.get("sort_by") || "equipment_no";
    const sortDir = sp.get("sort_dir") === "desc" ? "desc" : "asc";
    const page = Math.max(Number(sp.get("page") || 1), 1);
    const pageSize = Math.min(
      Math.max(Number(sp.get("page_size") || 25), 1),
      100,
    );

    let items = getEnrichedEquipment(false).map((e) => ({
      ...e,
      is_unmapped: e.root_asset_id === null,
      parent_kind: e.active_parent_kind,
      parent_label: e.active_parent_no
        ? `${e.active_parent_kind}: ${e.active_parent_no}`
        : "Belum Termapping",
      child_count: state.equipment_relationships.filter(
        (r) => r.parent_equipment_id === e.id && r.valid_to === null,
      ).length,
    }));

    if (q) {
      items = items.filter(
        (e) =>
          e.equipment_no.toLowerCase().includes(q) ||
          e.name.toLowerCase().includes(q) ||
          (e.specification || "").toLowerCase().includes(q) ||
          (e.serial_no && e.serial_no.toLowerCase().includes(q)) ||
          (e.root_asset_no && e.root_asset_no.toLowerCase().includes(q)),
      );
    }
    items = items.filter(item => matchesSelected(item.kind, kind) && matchesSelected(item.status, status) && matchesSelected(item.condition, condition) && matchesSelected(item.location_id, locationId) && matchesSelected(item.equipment_category_id, sp.get("category_id")) && matchesSelected(item.root_asset_id, sp.get("root_asset_id")) && matchesSelected(item.is_unmapped ? "UNMAPPED" : "MAPPED", mapping) && matchesSelected(item.parent_kind, sp.get("parent_kind")) && matchesSelected(item.depth, sp.get("depth")));
    items = sortTableRows(items, sortBy, sortDir, equipmentSortKeys, "equipment_no");

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
        assets: state.assets.filter(a => !a.deleted_at).map(a => ({id: a.id, name: `${a.sap_asset_no} · ${a.name}`})),
        depths: [...new Set(getEnrichedEquipment(false).map(e => e.depth))].sort((a,b) => a-b),
        equipment_categories: state.equipment_categories.filter(
          (r) => r.is_active,
        ),
        locations: state.locations.filter((r) => r.is_active),
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
        { issues: parsed.error.issues },
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
