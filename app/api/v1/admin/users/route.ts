import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { getAemsState, manageUserProfile } from "@/lib/db/store";
import { AemsError, formatErrorResponse } from "@/lib/utils/errors";
import { hasPermission } from "@/lib/permissions/rbac";

export async function GET() {
  try {
    const profile = await getCurrentProfile();
    if (!hasPermission(profile, "users:manage")) {
      throw new AemsError(
        "FORBIDDEN",
        "Hanya Administrator yang memiliki wewenang melihat daftar manajemen pengguna.",
        403
      );
    }
    const state = getAemsState();
    return NextResponse.json({ data: state.profiles });
  } catch (err) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    const body = await req.json();
    const updated = manageUserProfile(profile, {
      id: body.id,
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
