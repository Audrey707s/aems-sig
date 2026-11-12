import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types/domain";
import { AemsError } from "@/lib/utils/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Identity lookup for account pages; no business-data permission is implied. */
export async function getSignedInProfile(): Promise<Profile | null> {
  const client = await createSupabaseServerClient();
  if (!client) return null;
  const {data: {user}, error} = await client.auth.getUser();
  if (error || !user) return null;
  const {data: profile, error: profileError} = await client.from("profiles").select("*").eq("id", user.id).single();
  if (profileError || !profile) throw new AemsError("FORBIDDEN", "Profil akun belum tersedia. Hubungi Administrator.", 403);
  return profile as Profile;
}

/** Credentials only enter Supabase Auth, never the AEMS database or audit payload. */
export async function changeOwnPassword(
  client: SupabaseClient,
  verifier: SupabaseClient,
  currentPassword: string,
  nextPassword: string,
): Promise<void> {
  const {data: {user}, error} = await client.auth.getUser();
  if (error || !user?.email) throw new AemsError("UNAUTHORIZED", "Silakan login kembali.", 401);
  const check = await verifier.auth.signInWithPassword({email: user.email, password: currentPassword});
  if (check.error || check.data.user?.id !== user.id) {
    if (check.error && check.error.code !== "invalid_credentials" && check.error.status !== 400) {
      throw new AemsError("INTERNAL_ERROR", "Verifikasi kata sandi tidak tersedia. Coba kembali.", 503);
    }
    throw new AemsError("VALIDATION", "Kata sandi lama salah.", 400);
  }
  try {
    const updated = await client.auth.updateUser({password: nextPassword});
    if (updated.error) throw new AemsError("VALIDATION", "Kata sandi belum dapat diubah. Periksa kebijakan kata sandi atau login kembali.", 400);
    await client.auth.signOut({scope: "others"});
  } finally {
    await verifier.auth.signOut({scope: "local"});
  }
}
