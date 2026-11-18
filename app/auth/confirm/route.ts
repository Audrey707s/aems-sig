import {isSignupConfirmation} from "@/lib/auth/confirmation";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
const failed = (request: NextRequest, reason: "invalid" | "expired" | "unavailable" = "invalid") => {
  const url = new URL("/auth/confirmation-error",request.url);
  url.searchParams.set("reason",reason);
  const response=NextResponse.redirect(url,303);
  response.headers.set("Cache-Control","no-store");
  response.headers.set("Referrer-Policy","strict-origin");
  return response;
};
// GET never consumes one-time tokens: email security scanners can safely open this link.
export async function GET(request: NextRequest) {
  const url = new URL("/auth/verify",request.url);
  url.searchParams.set("token_hash",request.nextUrl.searchParams.get("token_hash") ?? "");
  url.searchParams.set("type",request.nextUrl.searchParams.get("type") ?? "");
  const response=NextResponse.redirect(url,303);
  response.headers.set("Cache-Control","no-store");
  response.headers.set("Referrer-Policy","strict-origin");
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
    if (!client) return failed(request,"unavailable");
    const {data,error} = await client.auth.verifyOtp({token_hash,type});
    if (error) return failed(request,error.code === "otp_expired" ? "expired" : (error.status && error.status >= 500) ? "unavailable" : "invalid");
    if (!data.user?.email_confirmed_at || !data.session || data.session.user.id !== data.user.id) return failed(request,"unavailable");
    return NextResponse.redirect(new URL("/pending-approval",request.url),303);
  } catch { return failed(request,"unavailable"); }
}
