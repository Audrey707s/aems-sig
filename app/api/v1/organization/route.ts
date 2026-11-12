import { NextResponse } from "next/server";
import { withAemsPersistence } from "@/lib/db/persistence";
import { getCurrentProfile } from "@/lib/auth/session";
import { getAemsState } from "@/lib/db/store";
export const GET = withAemsPersistence(async () => {
  await getCurrentProfile();
  return NextResponse.json({
    data: getAemsState()
      .profiles.filter((p) => p.role && p.is_active)
      .map((p) => ({
        id: p.id,
        full_name: p.full_name,
        role: p.role,
        account_level: p.account_level || "STAFF",
        manager_id: p.manager_id || null,
        is_active: p.is_active,
      })),
  });
});
