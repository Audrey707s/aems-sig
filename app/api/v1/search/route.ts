import { withAemsPersistence } from "@/lib/db/persistence";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { searchBidirectional } from "@/lib/db/store";
import { formatErrorResponse } from "@/lib/utils/errors";

async function handleGET(req: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    const q = req.nextUrl.searchParams.get("q") || "";
    const results = searchBidirectional(q, profile.role);
    return NextResponse.json(results);
  } catch (err) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}

export const GET = withAemsPersistence(handleGET);
