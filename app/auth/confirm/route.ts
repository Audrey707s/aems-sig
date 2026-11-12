import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export async function GET(request: NextRequest) {
  const token_hash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const client = await createSupabaseServerClient();
  if (token_hash && (type === "email" || type === "signup") && client) {
    const {error} = await client.auth.verifyOtp({token_hash, type});
    if (!error) return NextResponse.redirect(new URL("/pending-approval", request.url));
  }
  return NextResponse.redirect(new URL("/login?confirmation=failed", request.url));
}
