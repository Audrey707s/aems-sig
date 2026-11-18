import {authEmailFailure} from "@/lib/auth/email-delivery";
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
    if (error) {
      if (error.code === "user_already_exists" || error.code === "email_exists") throw new AemsError("VALIDATION", "Email sudah terdaftar. Silakan masuk atau gunakan Lupa kata sandi.");
      const failure = authEmailFailure(error);
      console.error("AEMS_SIGNUP_EMAIL_FAILED", {code: failure.code, status: failure.status});
      throw new AemsError("VALIDATION", failure.message, failure.status);
    }
    if (data.user?.identities?.length === 0) throw new AemsError("VALIDATION", "Email sudah terdaftar dan terverifikasi. Silakan masuk atau gunakan Lupa kata sandi.", 400);
    if (data.session) { await client.auth.signOut({scope: "local"}); throw new AemsError("INTERNAL_ERROR", "Verifikasi email belum dikonfigurasi. Hubungi Administrator.", 503); }
    if (!data.user?.id || !data.user.confirmation_sent_at) throw new AemsError("INTERNAL_ERROR", "Pengiriman konfirmasi belum dapat dipastikan. Gunakan Kirim ulang email konfirmasi setelah 60 detik.", 503);
    return NextResponse.json({retry_after: 60, message: "Permintaan pendaftaran diterima. Periksa email Anda dan konfirmasikan pendaftaran. Setelah terverifikasi, akun akan tampil kepada Super Admin untuk penetapan role. Jika tautan kedaluwarsa, kirim ulang konfirmasi atau daftar kembali dengan email yang sama.", requires_confirmation: true}, {status: 201, headers: {"Cache-Control": "no-store"}});
  } catch (error) {
    const formatted = formatErrorResponse(error);
    return NextResponse.json(formatted.body, {status: formatted.status, headers: {"Cache-Control":"no-store", ...(formatted.status === 429 ? {"Retry-After":"60"} : {})}});
  }
}
