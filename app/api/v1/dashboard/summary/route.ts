import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { getDashboardSummary, getAemsState } from "@/lib/db/store";
import { formatErrorResponse } from "@/lib/utils/errors";

export async function GET() {
  try {
    await getCurrentProfile();
    const summary = getDashboardSummary();
    const state = getAemsState();
    return NextResponse.json({
      ...summary,
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
