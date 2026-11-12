import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const client = await createSupabaseServerClient();
  if (code && client) {
    const {error} = await client.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/pending-approval", request.url));
  }
  return NextResponse.redirect(new URL("/login?confirmation=failed", request.url));
}
