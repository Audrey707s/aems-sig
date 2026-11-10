import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { addEquipmentSpecItem, getAemsState } from "@/lib/db/store";
import { AemsError, formatErrorResponse } from "@/lib/utils/errors";
import { createSpecItemSchema } from "@/lib/utils/schemas";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await getCurrentProfile();
    const { id } = await context.params;
    const state = getAemsState();
    const items = state.equipment_spec_items.filter(
      (s) => s.equipment_id === id || s.asset_id === id
    );
    return NextResponse.json({ data: items });
  } catch (err) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getCurrentProfile();
    const { id } = await context.params;
    const body = await req.json();
    const parsed = createSpecItemSchema.safeParse({
      ...body,
      equipment_id: body.asset_id ? null : id,
    });
    if (!parsed.success) {
      throw new AemsError(
        "VALIDATION",
        parsed.error.issues.map((i) => i.message).join("; "),
        400
      );
    }
    const created = addEquipmentSpecItem(profile, parsed.data);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}
