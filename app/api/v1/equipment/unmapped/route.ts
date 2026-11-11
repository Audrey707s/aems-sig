import { withAemsPersistence } from "@/lib/db/persistence";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { getAemsState, getEnrichedEquipment } from "@/lib/db/store";
import { formatErrorResponse } from "@/lib/utils/errors";

async function handleGET(req: NextRequest) {
  try {
    await getCurrentProfile();
    const state = getAemsState();
    const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
    const kind = req.nextUrl.searchParams.get("kind") || "";
    const locationId = req.nextUrl.searchParams.get("location_id") || "";

    const activeAssets = state.assets.filter(
      (a) => a.deleted_at === null && a.status === "ACTIVE"
    );

    let unmapped = getEnrichedEquipment(false)
      .filter((e) => e.root_asset_id === null)
      .map((e) => {
        // Suggest candidate asset or equipment based on matching location or name keywords
        const suggestedAsset = activeAssets.find(
          (a) => a.location_id && a.location_id === e.location_id
        );
        const pendingReq = state.mapping_change_requests.find(
          (r) =>
            r.status === "SUBMITTED" &&
            r.items.some((i) => i.equipment_id === e.id && i.status === "OPEN")
        );
        return {
          ...e,
          unmapped_reason: e.active_parent_id
            ? "Rantai parent belum terhubung ke aset SAP"
            : "Equipment mandiri (belum memiliki parent)",
          suggested_target: suggestedAsset
            ? {
                kind: "ASSET" as const,
                id: suggestedAsset.id,
                code: suggestedAsset.sap_asset_no,
                name: suggestedAsset.name,
              }
            : null,
          pending_request_code: pendingReq?.request_code || null,
        };
      });

    if (q) {
      unmapped = unmapped.filter(
        (e) =>
          e.equipment_no.toLowerCase().includes(q) ||
          e.name.toLowerCase().includes(q)
      );
    }
    if (kind) {
      unmapped = unmapped.filter((e) => e.kind === kind);
    }
    if (locationId) {
      unmapped = unmapped.filter((e) => e.location_id === locationId);
    }

    return NextResponse.json({
      data: unmapped,
      total: unmapped.length,
    });
  } catch (err) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}

export const GET = withAemsPersistence(handleGET);
