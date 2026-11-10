import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { validateAndPreviewMappingItem } from "@/lib/db/store";
import { formatErrorResponse } from "@/lib/utils/errors";

export async function POST(req: NextRequest) {
  try {
    await getCurrentProfile();
    const body = await req.json();
    const preview = validateAndPreviewMappingItem({
      equipment_id: body.equipment_id,
      action_type: body.action_type,
      to_parent_kind: body.to_parent_kind,
      to_parent_id: body.to_parent_id,
    });
    return NextResponse.json({ data: preview });
  } catch (err) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}
