import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { decideMappingRequest } from "@/lib/db/store";
import { AemsError, formatErrorResponse } from "@/lib/utils/errors";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getCurrentProfile();
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const note = String(body.review_note || "").trim();
    if (!note) {
      throw new AemsError(
        "VALIDATION",
        "Catatan alasan penolakan wajib diisi (BR-MP-06).",
        400
      );
    }

    const updated = decideMappingRequest(profile, id, "REJECT", note);
    return NextResponse.json({ data: updated });
  } catch (err) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}
