import { withAemsPersistence } from "@/lib/db/persistence";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { getAemsState } from "@/lib/db/store";
import { buildDashboard, readDashboardFilters } from "@/lib/dashboard";
import { formatErrorResponse } from "@/lib/utils/errors";
export const GET = withAemsPersistence(async (req: NextRequest) => {
  try {
    const actor = await getCurrentProfile(),
      state = getAemsState(),
      filters = readDashboardFilters(req.nextUrl.searchParams);
    return NextResponse.json({ data: buildDashboard(state, actor, filters) });
  } catch (e) {
    const f = formatErrorResponse(e);
    return NextResponse.json(f.body, { status: f.status });
  }
});
