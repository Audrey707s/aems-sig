import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { getAemsState } from "@/lib/db/store";
import { AemsError, formatErrorResponse } from "@/lib/utils/errors";
import { hasPermission } from "@/lib/permissions/rbac";

export async function GET(req: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    if (!hasPermission(profile, "audit:view_full")) {
      throw new AemsError(
        "FORBIDDEN",
        "Audit trail lengkap (termasuk alamat IP dan User Agent) hanya dapat diakses oleh Administrator (Table 68 & FR-RPT-06).",
        403
      );
    }

    const state = getAemsState();
    const sp = req.nextUrl.searchParams;
    const entityType = sp.get("entity_type") || "";
    const action = sp.get("action") || "";
    const q = (sp.get("q") || "").trim().toLowerCase();

    let logs = [...state.audit_logs];
    if (entityType) {
      logs = logs.filter((l) => l.entity_type === entityType);
    }
    if (action) {
      logs = logs.filter((l) => l.action === action);
    }
    if (q) {
      logs = logs.filter(
        (l) =>
          (l.entity_code && l.entity_code.toLowerCase().includes(q)) ||
          l.actor_name.toLowerCase().includes(q) ||
          l.action.toLowerCase().includes(q)
      );
    }

    return NextResponse.json({ data: logs });
  } catch (err) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}
