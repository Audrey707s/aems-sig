import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createRecoveryGrant, RECOVERY_COOKIE, RECOVERY_SECONDS } from "@/lib/auth/recovery";
export async function GET(request: NextRequest) {
  const failure = () => {
    const response = NextResponse.redirect(new URL("/reset-password?expired=1", request.url));
    response.cookies.delete(RECOVERY_COOKIE);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  };
  const client = await createSupabaseServerClient();
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!client || !secret) return failure();
  const code = request.nextUrl.searchParams.get("code");
  const token_hash = request.nextUrl.searchParams.get("token_hash");
  // Only exchange a one-use email proof; a pre-existing login session is insufficient.
  const result = code ? await client.auth.exchangeCodeForSession(code)
    : token_hash && request.nextUrl.searchParams.get("type") === "recovery" ? await client.auth.verifyOtp({token_hash, type: "recovery"}) : null;
  if (!result || result.error || !result.data.user?.updated_at) return failure();
  const response = NextResponse.redirect(new URL("/reset-password", request.url));
  response.cookies.set(RECOVERY_COOKIE, createRecoveryGrant(result.data.user, secret), {httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax", path: "/", maxAge: RECOVERY_SECONDS});
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
