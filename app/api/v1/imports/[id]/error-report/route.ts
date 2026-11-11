import { withAemsPersistence } from "@/lib/db/persistence";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { getAemsState } from "@/lib/db/store";
import { generateImportErrorReportWorkbook } from "@/lib/imports/excel";
import { AemsError, formatErrorResponse } from "@/lib/utils/errors";
import { hasPermission } from "@/lib/permissions/rbac";

async function handleGET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getCurrentProfile();
    const { id } = await context.params;
    const state = getAemsState();
    const batch = state.import_batches.find((b) => b.id === id);
    if (!batch) {
      throw new AemsError("NOT_FOUND", "Batch import tidak ditemukan.", 404);
    }
    if (
      batch.uploaded_by !== profile.id &&
      !hasPermission(profile, "import:view_all")
    ) {
      throw new AemsError("FORBIDDEN", "Akses ditolak.", 403);
    }

    const buf = await generateImportErrorReportWorkbook(
      batch.id,
      batch.file_name,
      batch.rows || []
    );

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Error_Report_${batch.id.slice(0, 8)}.xlsx"`,
      },
    });
  } catch (err) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}

export const GET = withAemsPersistence(handleGET);
