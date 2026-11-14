import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSignedInProfile } from "@/lib/auth/personal-account";
import { emailChangeSchema, requestEmailChange } from "@/lib/auth/profile";
import { AemsError, formatErrorResponse } from "@/lib/utils/errors";
export async function POST(request: NextRequest) {
  try {
    if (request.headers.get("origin") !== request.nextUrl.origin)
      throw new AemsError("FORBIDDEN", "Permintaan tidak diizinkan.", 403);
    const parsed = emailChangeSchema.safeParse(await request.json());
    if (!parsed.success)
      throw new AemsError("VALIDATION", "Alamat email tidak valid.");
    const profile = await getSignedInProfile();
    if (!profile?.is_active)
      throw new AemsError("UNAUTHORIZED", "Silakan login kembali.", 401);
    const client = await createSupabaseServerClient();
    if (!client || process.env.AEMS_STORAGE_MODE !== "supabase")
      throw new AemsError(
        "INTERNAL_ERROR",
        "Layanan email belum tersedia.",
        503,
      );
    return NextResponse.json(
      await requestEmailChange(
        client,
        parsed.data.email,
        request.nextUrl.origin,
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const f = formatErrorResponse(e);
    return NextResponse.json(f.body, {
      status: f.status,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
