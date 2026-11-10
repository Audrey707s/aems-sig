import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { getAemsState, getEnrichedEquipment } from "@/lib/db/store";
import { formatErrorResponse } from "@/lib/utils/errors";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await getCurrentProfile();
    const { id } = await context.params;
    const state = getAemsState();
    const childIds = new Set(
      state.equipment_relationships
        .filter((r) => r.parent_equipment_id === id && r.valid_to === null)
        .map((r) => r.child_equipment_id)
    );
    const children = getEnrichedEquipment(false).filter((e) => childIds.has(e.id));
    return NextResponse.json({ data: children });
  } catch (err) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}
