import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { resolveReconciliationFinding } from "@/lib/db/store";
import { AemsError, formatErrorResponse } from "@/lib/utils/errors";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getCurrentProfile();
    const { id } = await context.params;
    const body = await req.json();
    const status = String(body.status || "RESOLVED").toUpperCase();
    const note = String(body.resolution_note || "").trim();

    if (!["RESOLVED", "IGNORED"].includes(status)) {
      throw new AemsError("VALIDATION", "Status penyelesaian tidak valid.", 400);
    }
    if (!note) {
      throw new AemsError(
        "VALIDATION",
        "Catatan penyelesaian atau alasan wajib diisi.",
        400
      );
    }

    const updated = resolveReconciliationFinding(
      profile,
      id,
      status as "RESOLVED" | "IGNORED",
      note
    );
    return NextResponse.json({ data: updated });
  } catch (err) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}
