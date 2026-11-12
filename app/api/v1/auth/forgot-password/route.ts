import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AemsError, formatErrorResponse } from "@/lib/utils/errors";
const schema = z.object({email: z.string().trim().email("Alamat email tidak valid.").max(254)}).strict();
export async function POST(request: NextRequest) {
  try {
    if (request.headers.get("origin") !== request.nextUrl.origin) throw new AemsError("FORBIDDEN", "Permintaan tidak diizinkan.", 403);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) throw new AemsError("VALIDATION", "Alamat email tidak valid.");
    const client = await createSupabaseServerClient();
    if (!client || process.env.AEMS_STORAGE_MODE !== "supabase") throw new AemsError("INTERNAL_ERROR", "Pemulihan password belum tersedia.", 503);
    const {error} = await client.auth.resetPasswordForEmail(parsed.data.email, {redirectTo: new URL("/auth/recovery", request.url).toString()});
    if (error) throw new AemsError("VALIDATION", error.status === 429 ? "Terlalu banyak percobaan. Coba kembali beberapa saat lagi." : "Email belum dapat dikirim. Silakan coba kembali atau hubungi admin.", error.status === 429 ? 429 : 503);
    // Supabase returns the same result for an absent account: do not enumerate emails.
    return NextResponse.json({message: "Jika email terdaftar, tautan pengaturan ulang akan dikirim. Periksa juga folder spam."}, {headers: {"Cache-Control": "no-store"}});
  } catch (error) {
    const formatted = formatErrorResponse(error);
    return NextResponse.json(formatted.body, {status: formatted.status, headers: {"Cache-Control": "no-store"}});
  }
}
