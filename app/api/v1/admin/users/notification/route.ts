import {NextRequest, NextResponse} from "next/server";
import {z} from "zod";
import {getCurrentProfile} from "@/lib/auth/session";
import {hasPermission} from "@/lib/permissions/rbac";
import {AemsError,formatErrorResponse} from "@/lib/utils/errors";
import {deliverAccountNotification} from "@/lib/email/account-notification";
export async function POST(request: NextRequest) {
  try {
    if (request.headers.get("origin") !== request.nextUrl.origin) throw new AemsError("FORBIDDEN","Permintaan tidak diizinkan.",403);
    const actor = await getCurrentProfile();
    if (!hasPermission(actor,"users:manage")) throw new AemsError("FORBIDDEN","Hanya Administrator yang dapat mengirim ulang pemberitahuan.",403);
    const parsed = z.object({id:z.string().uuid()}).strict().safeParse(await request.json());
    if (!parsed.success) throw new AemsError("VALIDATION","Pengguna tidak valid.");
    const status = await deliverAccountNotification(parsed.data.id);
    return NextResponse.json({notification_status:status},{headers:{"Cache-Control":"no-store"}});
  } catch (error) {const result=formatErrorResponse(error);return NextResponse.json(result.body,{status:result.status});}
}
