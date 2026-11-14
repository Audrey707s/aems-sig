import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "./client";
import { AEMS_SESSION_COOKIE } from "@/lib/auth/constants";

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/pending-approval",
  "/auth/callback",
  "/auth/confirm",
  "/auth/email-change",
  "/forgot-password",
  "/reset-password",
  "/auth/recovery",
  "/api/v1/auth/forgot-password",
  "/api/v1/auth/session",
  "/api/v1/auth/register",
];

export async function updateSessionAndProtectRoutes(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const { pathname } = request.nextUrl;
  const isPublicPath = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // If Supabase Auth is configured and AEMS_STORAGE_MODE=supabase, validate JWT via getUser()
  if (isSupabaseConfigured() && process.env.AEMS_STORAGE_MODE === "supabase") {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: Array<{
            name: string;
            value: string;
            options: CookieOptions;
          }>,
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user && !isPublicPath && !pathname.startsWith("/api/")) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("redirectedFrom", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (user && pathname === "/login") {
      const dashUrl = request.nextUrl.clone();
      dashUrl.pathname = "/dashboard";
      return NextResponse.redirect(dashUrl);
    }

    return supabaseResponse;
  }

  // Local / Hybrid mode: check AEMS session cookie if explicitly logged out
  const sessionCookie = request.cookies.get(AEMS_SESSION_COOKIE)?.value;
  if (
    sessionCookie === "UNAUTHENTICATED" &&
    !isPublicPath &&
    !pathname.startsWith("/api/")
  ) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}
