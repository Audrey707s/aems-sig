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
    if (error) throw new AemsError("VALIDATION", error.status === 429 ? "Terlalu banyak percobaan. Coba kembali beberapa saat lagi." : error.code === "user_already_exists" || error.code === "email_exists" ? "Email sudah terdaftar. Silakan masuk atau gunakan Lupa kata sandi." : "Pendaftaran belum dapat diproses. Periksa email atau coba kembali.", error.status === 429 ? 429 : 400);
    if (data.user?.identities?.length === 0) throw new AemsError("VALIDATION", "Email sudah terdaftar dan terverifikasi. Silakan masuk atau gunakan Lupa kata sandi.", 400);
    if (data.session) { await client.auth.signOut({scope: "local"}); throw new AemsError("INTERNAL_ERROR", "Verifikasi email belum dikonfigurasi. Hubungi Administrator.", 503); }
    return NextResponse.json({message: "Periksa email Anda dan konfirmasikan pendaftaran. Setelah terverifikasi, akun akan tampil kepada Super Admin untuk penetapan role. Jika tautan kedaluwarsa, kirim ulang konfirmasi atau daftar kembali dengan email yang sama.", requires_confirmation: true}, {status: 201, headers: {"Cache-Control": "no-store"}});
  } catch (error) {
    const formatted = formatErrorResponse(error);
    return NextResponse.json(formatted.body, {status: formatted.status});
  }
}
