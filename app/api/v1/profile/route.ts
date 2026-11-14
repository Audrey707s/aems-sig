import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { withAemsPersistence } from "@/lib/db/persistence";
import { getCurrentProfile } from "@/lib/auth/session";
import { updateOwnProfile, syncOwnVerifiedEmail } from "@/lib/db/store";
import { profileSchema } from "@/lib/auth/profile";
import { AemsError, formatErrorResponse } from "@/lib/utils/errors";
export const PATCH = withAemsPersistence(async (request: NextRequest) => {
  try {
    if (request.headers.get("origin") !== request.nextUrl.origin)
      throw new AemsError("FORBIDDEN", "Permintaan tidak diizinkan.", 403);
    const actor = await getCurrentProfile();
    const parsed = profileSchema.safeParse(await request.json());
    if (!parsed.success)
      throw new AemsError("VALIDATION", parsed.error.issues[0].message);
    return NextResponse.json({ data: updateOwnProfile(actor, parsed.data) });
  } catch (e) {
    const f = formatErrorResponse(e);
    return NextResponse.json(f.body, { status: f.status });
  }
});

export const GET = withAemsPersistence(async () => {
  try {
    const actor = await getCurrentProfile();
    if (process.env.AEMS_STORAGE_MODE !== "supabase")
      return NextResponse.json({ data: actor, pending_email: null });
    const client = await createSupabaseServerClient();
    const result = await client?.auth.getUser();
    if (!result?.data.user || result.error)
      throw new AemsError("UNAUTHORIZED", "Silakan login kembali.", 401);
    const verified = result.data.user;
    const profile = syncOwnVerifiedEmail(actor, verified);
    return NextResponse.json({
      data: profile,
      pending_email: verified.new_email || null,
    });
  } catch (e) {
    const f = formatErrorResponse(e);
    return NextResponse.json(f.body, { status: f.status });
  }
});
