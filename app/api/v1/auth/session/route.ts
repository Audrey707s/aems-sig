import { withAemsPersistence } from "@/lib/db/persistence";
import { NextRequest, NextResponse } from "next/server";
import { getAemsState, resetAemsState } from "@/lib/db/store";
import { AEMS_SESSION_COOKIE, getCurrentProfile } from "@/lib/auth/session";
import { AemsError, formatErrorResponse } from "@/lib/utils/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";

async function handleGET() {
  try {
    const profile = await getCurrentProfile();
    const state = getAemsState();
    return NextResponse.json({
      data: { user: profile },
      profile,
      available_profiles: state.profiles,
      app_settings: state.app_settings,
    });
  } catch (err) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.action === "RESET_DEMO") {
      if (process.env.NEXT_PUBLIC_AEMS_DEMO_MODE !== "true" || process.env.AEMS_STORAGE_MODE === "supabase") {
        throw new AemsError("FORBIDDEN", "Reset demo dinonaktifkan.", 403);
      }
      const freshState = resetAemsState();
      const adminProfile = freshState.profiles[2];
      const res = NextResponse.json({
        ok: true,
        data: { user: adminProfile },
        profile: adminProfile,
      });
      res.cookies.set(AEMS_SESSION_COOKIE, adminProfile.id, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 12,
      });
      return res;
    }

    if (body.action === "LOGOUT") {
      if (isSupabaseConfigured()) {
        const supabase = await createSupabaseServerClient();
        await supabase?.auth.signOut();
      }
      const res = NextResponse.json({ ok: true });
      res.cookies.set(AEMS_SESSION_COOKIE, "UNAUTHENTICATED", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 });
      return res;
    }

    if (process.env.AEMS_STORAGE_MODE === "supabase") {
      if (!isSupabaseConfigured() || !body.email || !body.password) {
        throw new AemsError("UNAUTHORIZED", "Email dan kata sandi wajib diisi.", 401);
      }
      const supabase = await createSupabaseServerClient();
      if (!supabase) throw new AemsError("UNAUTHORIZED", "Layanan login tidak tersedia.", 401);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: String(body.email).trim(), password: String(body.password),
      });
      if (error || !data.user) throw new AemsError("UNAUTHORIZED", "Email atau kata sandi tidak valid.", 401);
      const profile = await getCurrentProfile();
      return NextResponse.json({ data: { user: profile }, profile });
    }

    const state = getAemsState();
    const targetProfile = state.profiles.find(
      (p) =>
        p.id === body.user_id ||
        (body.role && p.role === body.role) ||
        (body.email &&
          p.email.toLowerCase() === String(body.email).trim().toLowerCase())
    );

    if (!targetProfile) {
      throw new AemsError(
        "UNAUTHORIZED",
        "Email atau akun pengguna tidak ditemukan.",
        401
      );
    }

    if (!targetProfile.is_active) {
      throw new AemsError(
        "FORBIDDEN",
        "Akun pengguna ini telah dinonaktifkan oleh Administrator.",
        403
      );
    }

    if (!targetProfile.role) {
      throw new AemsError(
        "FORBIDDEN",
        "Akun pengguna belum memiliki role. Hubungi Administrator.",
        403
      );
    }

    targetProfile.last_login_at = new Date().toISOString();

    const res = NextResponse.json({
      data: { user: targetProfile },
      profile: targetProfile,
    });
    res.cookies.set(AEMS_SESSION_COOKIE, targetProfile.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return res;
  } catch (err) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}

export const GET = withAemsPersistence(handleGET);
