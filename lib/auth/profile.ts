import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AemsError } from "@/lib/utils/errors";
export const profileSchema = z
  .object({
    full_name: z
      .string()
      .trim()
      .min(2, "Nama lengkap minimal 2 karakter.")
      .max(120),
    expected_updated_at: z.string().optional(),
  })
  .strict();
export const emailChangeSchema = z
  .object({
    email: z.string().trim().email("Alamat email tidak valid.").max(254),
  })
  .strict();
export async function requestEmailChange(
  client: SupabaseClient,
  email: string,
  origin: string,
) {
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user?.email)
    throw new AemsError("UNAUTHORIZED", "Silakan login kembali.", 401);
  if (user.email.toLowerCase() === email.toLowerCase())
    throw new AemsError("VALIDATION", "Email baru sama dengan email saat ini.");
  const result = await client.auth.updateUser(
    { email },
    { emailRedirectTo: new URL("/auth/email-change", origin).toString() },
  );
  if (result.error)
    throw new AemsError(
      "VALIDATION",
      result.error.status === 429
        ? "Terlalu banyak permintaan. Coba kembali beberapa saat lagi."
        : "Email verifikasi belum dapat dikirim. Periksa alamat email atau hubungi Admin.",
      result.error.status === 429 ? 429 : 400,
    );
  return {
    message:
      "Permintaan perubahan email dikirim. Selesaikan konfirmasi melalui pesan email yang diterima. Email login tetap berlaku sampai seluruh konfirmasi selesai.",
    pending_email: result.data.user?.new_email || email,
  };
}
