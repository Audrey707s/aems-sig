import { withAemsPersistence } from "@/lib/db/persistence";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { generateImportTemplateWorkbook } from "@/lib/imports/excel";
import { ImportType } from "@/lib/types/domain";
import { AemsError, formatErrorResponse } from "@/lib/utils/errors";

async function handleGET(
  _req: NextRequest,
  context: { params: Promise<{ type: string }> }
) {
  try {
    await getCurrentProfile();
    const { type } = await context.params;
    const upper = type.toUpperCase();
    const mapType: Record<string, ImportType> = {
      ASSET: "ASSET_MASTER",
      ASSET_MASTER: "ASSET_MASTER",
      EQUIPMENT: "EQUIPMENT_MASTER",
      EQUIPMENT_MASTER: "EQUIPMENT_MASTER",
      MAPPING: "MAPPING",
    };

    const resolved = mapType[upper];
    if (!resolved) {
      throw new AemsError(
        "VALIDATION",
        "Jenis template tidak dikenal (gunakan asset, equipment, atau mapping).",
        400
      );
    }

    const buf = await generateImportTemplateWorkbook(resolved);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Template_${resolved}_AEMS.xlsx"`,
      },
    });
  } catch (err) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}

export const GET = withAemsPersistence(handleGET);
