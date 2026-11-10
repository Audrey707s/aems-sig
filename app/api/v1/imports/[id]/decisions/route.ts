import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { updateImportBatchDecisions } from "@/lib/db/store";
import { formatErrorResponse } from "@/lib/utils/errors";

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getCurrentProfile();
    const { id } = await context.params;
    const body = await req.json();
    const updated = updateImportBatchDecisions(profile, id, {
      global_duplicate_action: body.global_duplicate_action,
      row_decisions: body.row_decisions,
      commit_mode: body.commit_mode,
    });
    return NextResponse.json({ data: updated });
  } catch (err) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}
