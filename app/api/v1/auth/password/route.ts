import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { passwordChangeSchema } from "@/lib/auth/account-schemas";
import { changeOwnPassword } from "@/lib/auth/personal-account";
import { AemsError, formatErrorResponse } from "@/lib/utils/errors";

export async function POST(request: NextRequest) {
  try {
    if (request.headers.get("origin") && request.headers.get("origin") !== request.nextUrl.origin) throw new AemsError("FORBIDDEN", "Permintaan tidak diizinkan.", 403);
    const parsed = passwordChangeSchema.safeParse(await request.json());
    if (!parsed.success) throw new AemsError("VALIDATION", parsed.error.issues[0].message);
    const client = await createSupabaseServerClient();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!client || !url || !key || process.env.AEMS_STORAGE_MODE !== "supabase") throw new AemsError("INTERNAL_ERROR", "Layanan kata sandi belum tersedia.", 503);
    const verifier = createClient(url, key, {auth: {persistSession: false, autoRefreshToken: false}});
    await changeOwnPassword(client, verifier, parsed.data.current_password, parsed.data.new_password);
    return NextResponse.json({message: "Kata sandi berhasil diubah."}, {headers: {"Cache-Control": "no-store"}});
  } catch (error) {
    const formatted = formatErrorResponse(error);
    return NextResponse.json(formatted.body, {status: formatted.status});
  }
}
