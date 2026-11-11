// =============================================================================
// Server Session & Active Profile Resolution (Supabase Auth + Local Store)
// =============================================================================

import { cookies, headers } from "next/headers";
import { getAemsState } from "@/lib/db/store";
import { Profile } from "@/lib/types/domain";
import { AemsError } from "@/lib/utils/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export const AEMS_SESSION_COOKIE = "aems_session_user_id";

/**
 * Resolves the currently authenticated user profile:
 * 1. `x-aems-user-id` request header (for integration tests)
 * 2. Supabase Auth (`supabase.auth.getUser()`) + `public.profiles` lookup when `AEMS_STORAGE_MODE=supabase`
 * 3. HttpOnly session cookie (`aems_session_user_id`) for local/hybrid store
 *
 * Security invariants enforced:
 * - Never trusts `user_metadata` for role authorization; only `public.profiles.role` or `app_metadata.role`
 * - Inactive accounts (`is_active = false`) are immediately rejected (403)
 * - Accounts without an assigned role (`role = null`) are immediately rejected (403)
 */
export async function getCurrentProfile(): Promise<Profile> {
  const state = getAemsState();
  let userId: string | undefined;

  try {
    const hdrs = await headers();
    const headerUserId = hdrs.get("x-aems-user-id");
    if (process.env.NODE_ENV === "test" && headerUserId) {
      userId = headerUserId;
    }
  } catch {
    // Fallback outside request context
  }

  // If no test header is present and Supabase Auth mode is enabled, verify JWT via getUser()
  if (process.env.AEMS_STORAGE_MODE === "supabase") {
    if (!isSupabaseConfigured()) throw new AemsError("UNAUTHORIZED", "Layanan login belum dikonfigurasi.", 401);
    try {
      const supabase = await createSupabaseServerClient();
      if (supabase) {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error || !user) {
          throw new AemsError(
            "UNAUTHORIZED",
            "Sesi belum login atau telah berakhir. Silakan login kembali.",
            401
          );
        }

        const { data: dbProfile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (dbProfile) {
          if (!dbProfile.is_active) {
            throw new AemsError(
              "FORBIDDEN",
              "Akun Anda telah dinonaktifkan oleh Administrator.",
              403
            );
          }
          if (!dbProfile.role || !["ADMIN", "ACCOUNTING", "MAINTENANCE"].includes(dbProfile.role)) {
            throw new AemsError(
              "FORBIDDEN",
              "Akun Anda belum memiliki role yang ditetapkan oleh Administrator.",
              403
            );
          }
          return dbProfile as Profile;
        }

        throw new AemsError("FORBIDDEN", "Profil akun belum tersedia. Hubungi Administrator.", 403);
      }
    } catch (err) {
      if (err instanceof AemsError) throw err;
      throw new AemsError("UNAUTHORIZED", "Sesi tidak dapat diverifikasi. Silakan login kembali.", 401);
    }
  }

  if (!userId) {
    try {
      const cookieStore = await cookies();
      userId = cookieStore.get(AEMS_SESSION_COOKIE)?.value;
    } catch {
      // Fallback outside request context
    }
  }

  if (!userId) {
    return state.profiles[2]; // Default to Admin profile for initial seamless preview
  }

  if (userId === "UNAUTHENTICATED") {
    throw new AemsError(
      "UNAUTHORIZED",
      "Sesi belum login atau telah berakhir. Silakan login kembali.",
      401
    );
  }

  const profile = state.profiles.find((p) => p.id === userId);
  if (!profile) {
    throw new AemsError("UNAUTHORIZED", "Akun pengguna tidak ditemukan.", 401);
  }

  if (!profile.is_active) {
    throw new AemsError(
      "FORBIDDEN",
      "Akun Anda telah dinonaktifkan oleh Administrator.",
      403
    );
  }

  if (!profile.role) {
    throw new AemsError(
      "FORBIDDEN",
      "Akun Anda belum memiliki role yang ditetapkan oleh Administrator.",
      403
    );
  }

  return profile;
}
