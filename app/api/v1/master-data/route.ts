import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAemsPersistence } from "@/lib/db/persistence";
import { getCurrentProfile } from "@/lib/auth/session";
import { getAemsState } from "@/lib/db/store";
import { referenceKinds, saveReference } from "@/lib/db/references";
import { AemsError, formatErrorResponse } from "@/lib/utils/errors";
async function handleGET() {
  await getCurrentProfile();
  const state = getAemsState();
  return NextResponse.json({
    data: Object.fromEntries(referenceKinds.map((k) => [k, state[k]])),
  });
}
async function handlePOST(req: NextRequest) {
  try {
    const actor = await getCurrentProfile();
    const row = z.object({
      id: z.string().uuid().optional(),
      code: z.string().trim().min(1).max(60),
      name: z.string().trim().min(2).max(150),
      parent_id: z.string().uuid().nullable(),
      is_active: z.boolean(),
    });
    const parsed = row
      .extend({
        kind: z.enum(referenceKinds),
        expected: row.required({ id: true }).optional(),
      })
      .strict()
      .safeParse(await req.json());
    if (!parsed.success)
      throw new AemsError("VALIDATION", parsed.error.issues[0].message);
    return NextResponse.json({
      data: saveReference(actor, parsed.data.kind, parsed.data),
    });
  } catch (e) {
    const f = formatErrorResponse(e);
    return NextResponse.json(f.body, { status: f.status });
  }
}
export const GET = withAemsPersistence(handleGET);
export const POST = withAemsPersistence(handlePOST);
