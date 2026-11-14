import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export async function GET(request: NextRequest) {
  const client = await createSupabaseServerClient();
  const code = request.nextUrl.searchParams.get("code"),
    token_hash = request.nextUrl.searchParams.get("token_hash");
  const result =
    client &&
    (code
      ? await client.auth.exchangeCodeForSession(code)
      : token_hash &&
          request.nextUrl.searchParams.get("type") === "email_change"
        ? await client.auth.verifyOtp({ token_hash, type: "email_change" })
        : null);
  const response = NextResponse.redirect(
    new URL(
      result && !result.error
        ? "/profile?email=confirmed"
        : "/profile?email=failed",
      request.url,
    ),
  );
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
