import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { getEquipmentBreadcrumb } from "@/lib/db/store";
import { formatErrorResponse } from "@/lib/utils/errors";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await getCurrentProfile();
    const { id } = await context.params;
    const ancestors = getEquipmentBreadcrumb(id);
    return NextResponse.json({ data: ancestors });
  } catch (err) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}
