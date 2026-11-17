import {isSignupConfirmation} from "@/lib/auth/confirmation";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
const failed = (request: NextRequest) => NextResponse.redirect(new URL("/login?confirmation=failed",request.url),303);
// GET never consumes one-time tokens: email security scanners can safely open this link.
export async function GET(request: NextRequest) {
  const url = new URL("/auth/verify",request.url);
  url.searchParams.set("token_hash",request.nextUrl.searchParams.get("token_hash") ?? "");
  url.searchParams.set("type",request.nextUrl.searchParams.get("type") ?? "");
  const response=NextResponse.redirect(url,303);
  response.headers.set("Cache-Control","no-store");
  response.headers.set("Referrer-Policy","no-referrer");
  return response;
}
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return failed(request);
  try {
    const form = await request.formData();
    const token_hash = String(form.get("token_hash") ?? "");
    const type = String(form.get("type") ?? "");
    if (!isSignupConfirmation(token_hash, type) || (type !== "signup" && type !== "email")) return failed(request);
    const client = await createSupabaseServerClient();
    if (!client) return failed(request);
    const {error} = await client.auth.verifyOtp({token_hash,type});
    if (error) return failed(request);
    return NextResponse.redirect(new URL("/pending-approval",request.url),303);
  } catch { return failed(request); }
}
