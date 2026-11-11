import { withAemsPersistence } from "@/lib/db/persistence";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { commitImportBatch } from "@/lib/db/store";
import { formatErrorResponse } from "@/lib/utils/errors";

async function handlePOST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getCurrentProfile();
    const { id } = await context.params;
    const idempotencyKey =
      req.headers.get("Idempotency-Key") || undefined;
    const committed = commitImportBatch(profile, id, idempotencyKey);
    return NextResponse.json({ data: committed });
  } catch (err) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}

export const POST = withAemsPersistence(handlePOST);
