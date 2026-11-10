import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { getAemsState } from "@/lib/db/store";
import { formatErrorResponse } from "@/lib/utils/errors";

export async function GET(req: NextRequest) {
  try {
    await getCurrentProfile();
    const state = getAemsState();
    const sp = req.nextUrl.searchParams;
    const equipmentId = sp.get("equipment_id") || "";
    const assetId = sp.get("asset_id") || "";
    const q = (sp.get("q") || "").trim().toLowerCase();

    let history = [...state.mapping_history];
    if (equipmentId) {
      history = history.filter((h) => h.equipment_id === equipmentId);
    }
    if (assetId) {
      history = history.filter(
        (h) => h.from_asset_id === assetId || h.to_asset_id === assetId
      );
    }
    if (q) {
      history = history.filter(
        (h) =>
          h.equipment_no.toLowerCase().includes(q) ||
          h.equipment_name.toLowerCase().includes(q) ||
          (h.from_parent_no && h.from_parent_no.toLowerCase().includes(q)) ||
          (h.to_parent_no && h.to_parent_no.toLowerCase().includes(q)) ||
          (h.reason && h.reason.toLowerCase().includes(q))
      );
    }

    return NextResponse.json({ data: history });
  } catch (err) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}
