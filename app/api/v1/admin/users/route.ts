import {deliverAccountNotification, listAccountNotifications, isAccountEmailConfigured} from "@/lib/email/account-notification";
import { z } from "zod";
import { withAemsPersistence } from "@/lib/db/persistence";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { getAemsState, manageUserProfile } from "@/lib/db/store";
import { AemsError, formatErrorResponse } from "@/lib/utils/errors";
import { hasPermission } from "@/lib/permissions/rbac";

async function handleGET() {
  try {
    const profile = await getCurrentProfile();
    if (!hasPermission(profile, "users:manage")) {
      throw new AemsError(
        "FORBIDDEN",
        "Hanya Administrator yang memiliki wewenang melihat daftar manajemen pengguna.",
        403,
      );
    }
    const state = getAemsState();
    const users = state.profiles.filter(p => process.env.AEMS_STORAGE_MODE !== "supabase" || p.email_verified_at);
    const notifications = await listAccountNotifications();
    return NextResponse.json({ data: users, notifications, email_configured: isAccountEmailConfigured() });
  } catch (err) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    const parsed = z
      .object({
        id: z.string().uuid(),
        email: z.string().email(),
        full_name: z.string().trim().min(2).max(120),
        department: z.string().trim().max(120).nullable().optional(),
        role: z.enum(["ACCOUNTING", "MAINTENANCE", "ADMIN"]).nullable(),
        account_level: z.enum(["MANAGER", "STAFF"]).optional(),
        manager_id: z.string().uuid().nullable().optional(),
        expected_updated_at: z.string().datetime({ offset: true }).optional(),
        is_active: z.boolean(),
      })
      .safeParse(await req.json());
    if (!parsed.success)
      throw new AemsError(
        "VALIDATION",
        "Data pengguna atau jenis akun tidak valid.",
        400,
      );
    const body = parsed.data;
    const updated = manageUserProfile(profile, {
      id: body.id,
      account_level: body.account_level,
      manager_id: body.manager_id,
      expected_updated_at: body.expected_updated_at,
      email: String(body.email || ""),
      full_name: String(body.full_name || ""),
      role: body.role ?? null,
      is_active: body.is_active !== false,
      department: body.department ?? null,
    });
    return NextResponse.json({ data: updated });
  } catch (err) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}

export const GET = withAemsPersistence(handleGET);

const saveUser = withAemsPersistence(handlePOST);
export async function POST(req: NextRequest) {
  const response = await saveUser(req);
  if (!response.ok) return response;
  const body = await response.json();
  const notification_status = body.data.is_active && body.data.role ? await deliverAccountNotification(body.data.id) : null;
  return NextResponse.json({...body, notification_status}, {headers:{"Cache-Control":"private, no-store"}});
}
