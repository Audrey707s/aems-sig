import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { registrationSchema } from "@/lib/auth/account-schemas";
import { AemsError, formatErrorResponse } from "@/lib/utils/errors";

export async function POST(request: NextRequest) {
  try {
    if (request.headers.get("origin") && request.headers.get("origin") !== request.nextUrl.origin) throw new AemsError("FORBIDDEN", "Permintaan tidak diizinkan.", 403);
    const parsed = registrationSchema.safeParse(await request.json());
    if (!parsed.success) throw new AemsError("VALIDATION", parsed.error.issues[0].message);
    const client = await createSupabaseServerClient();
    if (!client || process.env.AEMS_STORAGE_MODE !== "supabase") throw new AemsError("INTERNAL_ERROR", "Pendaftaran belum tersedia.", 503);
    const {full_name, email, password} = parsed.data;
    const {data, error} = await client.auth.signUp({email, password, options: {
      data: {full_name}, emailRedirectTo: new URL("/auth/callback", request.url).toString(),
    }});
    if (error) throw new AemsError("VALIDATION", error.status === 429 ? "Terlalu banyak percobaan. Coba kembali beberapa saat lagi." : "Pendaftaran belum dapat diproses. Periksa email atau coba kembali.", error.status === 429 ? 429 : 400);
    return NextResponse.json({message: data.session ? "Akun berhasil didaftarkan. Menunggu penetapan jenis akun oleh admin." : "Periksa email Anda untuk melanjutkan pendaftaran. Setelah email terverifikasi, admin akan menetapkan jenis akun.", redirect: data.session ? "/pending-approval" : null}, {status: 201, headers: {"Cache-Control": "no-store"}});
  } catch (error) {
    const formatted = formatErrorResponse(error);
    return NextResponse.json(formatted.body, {status: formatted.status});
  }
}
