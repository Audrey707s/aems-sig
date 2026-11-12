import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RECOVERY_COOKIE, verifyRecoveryGrant } from "@/lib/auth/recovery";
import { AemsError, formatErrorResponse } from "@/lib/utils/errors";
const schema = z.object({password: z.string().min(8, "Kata sandi minimal 8 karakter.").max(128), confirmation: z.string()}).strict().refine(d => d.password === d.confirmation, {message: "Konfirmasi kata sandi tidak sama."});
export async function POST(request: NextRequest) {
  try {
    if (request.headers.get("origin") !== request.nextUrl.origin) throw new AemsError("FORBIDDEN", "Permintaan tidak diizinkan.", 403);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) throw new AemsError("VALIDATION", parsed.error.issues[0].message);
    const client = await createSupabaseServerClient();
    if (!client) throw new AemsError("UNAUTHORIZED", "Buka tautan pemulihan dari email terlebih dahulu.", 401);
    const {data: {user}, error} = await client.auth.getUser();
    if (error || !user || !verifyRecoveryGrant(request.cookies.get(RECOVERY_COOKIE)?.value, user, process.env.SUPABASE_SERVICE_ROLE_KEY || "")) throw new AemsError("UNAUTHORIZED", "Tautan pemulihan kedaluwarsa. Minta tautan baru.", 401);
    const updated = await client.auth.updateUser({password: parsed.data.password});
    if (updated.error) throw new AemsError("VALIDATION", "Password belum dapat diubah. Gunakan password baru yang memenuhi ketentuan.");
    await client.auth.signOut({scope: "global"});
    const response = NextResponse.json({message: "Password berhasil diperbarui. Silakan login kembali."}, {headers: {"Cache-Control": "no-store"}});
    response.cookies.delete(RECOVERY_COOKIE);
    return response;
  } catch (error) {
    const formatted = formatErrorResponse(error);
    return NextResponse.json(formatted.body, {status: formatted.status, headers: {"Cache-Control": "no-store"}});
  }
}
