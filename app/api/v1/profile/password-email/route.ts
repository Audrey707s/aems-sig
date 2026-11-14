import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSignedInProfile } from "@/lib/auth/personal-account";
import { AemsError, formatErrorResponse } from "@/lib/utils/errors";
export async function POST(request: NextRequest) {
  try {
    if (request.headers.get("origin") !== request.nextUrl.origin)
      throw new AemsError("FORBIDDEN", "Permintaan tidak diizinkan.", 403);
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
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    if (error || !user?.email || user.id !== profile.id)
      throw new AemsError("UNAUTHORIZED", "Silakan login kembali.", 401);
    const result = await client.auth.resetPasswordForEmail(user.email, {
      redirectTo: new URL("/auth/recovery", request.nextUrl.origin).toString(),
    });
    if (result.error)
      throw new AemsError(
        "VALIDATION",
        result.error.status === 429
          ? "Terlalu banyak permintaan. Coba kembali beberapa saat lagi."
          : "Email verifikasi belum dapat dikirim. Hubungi Admin.",
        result.error.status === 429 ? 429 : 503,
      );
    return NextResponse.json(
      {
        message:
          "Tautan ubah password dikirim ke email akun Anda. Buka tautan tersebut untuk melanjutkan.",
      },
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
