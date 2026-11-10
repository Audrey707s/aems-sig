import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { getAssetEquipmentTree } from "@/lib/db/store";
import { formatErrorResponse } from "@/lib/utils/errors";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await getCurrentProfile();
    const { id } = await context.params;
    const asOf = req.nextUrl.searchParams.get("as_of");
    const tree = getAssetEquipmentTree(id, asOf);
    return NextResponse.json({ data: tree, as_of: asOf || null });
  } catch (err) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}
