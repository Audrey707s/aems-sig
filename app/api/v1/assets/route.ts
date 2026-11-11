import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { createAsset, getAemsState, getEnrichedAssets } from "@/lib/db/store";
import { AemsError, formatErrorResponse } from "@/lib/utils/errors";
import { createAssetSchema } from "@/lib/utils/schemas";

export async function GET(req: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    const state = getAemsState();
    const sp = req.nextUrl.searchParams;

    const q = (sp.get("q") || "").trim().toLowerCase();
    const status = sp.get("status") || "";
    const categoryId = sp.get("category_id") || "";
    const locationId = sp.get("location_id") || "";
    const mappingFilter = sp.get("mapping") || ""; // "MAPPED" | "UNMAPPED" | ""
    const sortBy = sp.get("sort_by") || "sap_asset_no";
    const sortDir = sp.get("sort_dir") === "desc" ? -1 : 1;
    const page = Math.max(Number(sp.get("page") || 1), 1);
    const pageSize = Math.min(Math.max(Number(sp.get("page_size") || 25), 1), 100);

    const activeEquipment = state.equipment.filter((e) => e.deleted_at === null);
    const mappedAssetIds = new Set<string>();
    for (const eq of activeEquipment) {
      if (eq.root_asset_id) mappedAssetIds.add(eq.root_asset_id);
    }

    let items = getEnrichedAssets(false, profile.role).map((a) => {
      const totalEqCount = activeEquipment.filter((e) => e.root_asset_id === a.id).length;
      const directEqCount = activeEquipment.filter(
        (e) => state.equipment_active_parent.some(p => p.equipment_id === e.id && p.parent_kind === "ASSET" && p.parent_id === a.id)
      ).length;
      return {
        ...a,
        equipment_count: totalEqCount,
        direct_equipment_count: directEqCount,
        total_equipment_count: totalEqCount,
        mapping_status: mappedAssetIds.has(a.id) ? "MAPPED" : "UNMAPPED",
      };
    });

    if (q) {
      items = items.filter(
        (a) =>
          a.sap_asset_no.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q) ||
          (a.category_name || "").toLowerCase().includes(q) ||
          (a.location_name || "").toLowerCase().includes(q) ||
          (a.cost_center && a.cost_center.toLowerCase().includes(q)) ||
          (a.serial_no && a.serial_no.toLowerCase().includes(q))
      );
    }
    if (status) {
      items = items.filter((a) => a.status === status);
    }
    if (categoryId) {
      items = items.filter((a) => a.asset_category_id === categoryId);
    }
    if (locationId) {
      items = items.filter((a) => a.location_id === locationId);
    }
    if (mappingFilter === "MAPPED") {
      items = items.filter((a) => a.mapping_status === "MAPPED");
    } else if (mappingFilter === "UNMAPPED") {
      items = items.filter((a) => a.mapping_status === "UNMAPPED");
    }

    items.sort((a, b) => {
      const av = String((a as Record<string, unknown>)[sortBy] ?? "");
      const bv = String((b as Record<string, unknown>)[sortBy] ?? "");
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
        asset_categories: state.asset_categories,
        locations: state.locations,
      },
    });
  } catch (err) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    const body = await req.json();
    const parsed = createAssetSchema.safeParse(body);
    if (!parsed.success) {
      throw new AemsError(
        "VALIDATION",
        parsed.error.issues.map((i) => i.message).join("; "),
        400,
        { issues: parsed.error.issues }
      );
    }
    const created = createAsset(profile, parsed.data);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}
