import { withAemsPersistence } from "@/lib/db/persistence";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { buildStandardReport } from "@/lib/db/reports";
import { formatErrorResponse } from "@/lib/utils/errors";

async function handleGET(
  req: NextRequest,
  context: { params: Promise<{ name: string }> }
) {
  try {
    const profile = await getCurrentProfile();
    const { name } = await context.params;
    const filters: Record<string, string> = {};
    req.nextUrl.searchParams.forEach((v, k) => {
      filters[k] = v;
    });

    const report = buildStandardReport(profile, name, filters);
    return NextResponse.json({ data: report });
  } catch (err) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}

export const GET = withAemsPersistence(handleGET);
