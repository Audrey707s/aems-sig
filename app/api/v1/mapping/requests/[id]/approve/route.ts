import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { decideMappingRequest } from "@/lib/db/store";
import { formatErrorResponse } from "@/lib/utils/errors";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getCurrentProfile();
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const note = String(body.review_note || "Disetujui dan diterapkan oleh Administrator").trim();

    const updated = decideMappingRequest(profile, id, "APPROVE", note);
    return NextResponse.json({ data: updated });
  } catch (err) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}
