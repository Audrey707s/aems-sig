import { withAemsPersistence } from "@/lib/db/persistence";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getCurrentProfile } from "@/lib/auth/session";
import { createAndValidateImportBatch, getAemsState } from "@/lib/db/store";
import { parseExcelBuffer } from "@/lib/imports/excel";
import { CommitMode, DuplicateDecision, ImportType } from "@/lib/types/domain";
import { AemsError, formatErrorResponse } from "@/lib/utils/errors";
import { hasPermission } from "@/lib/permissions/rbac";

async function handleGET() {
  try {
    const profile = await getCurrentProfile();
    const state = getAemsState();
    const canViewAll = hasPermission(profile, "import:view_all");

    const batches = state.import_batches
      .filter((b) => canViewAll || b.uploaded_by === profile.id)
      .map((b) => ({
        ...b,
        rows: undefined, // keep summary lightweight
      }));

    return NextResponse.json({ data: batches });
  } catch (err) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    const state = getAemsState();
    const contentType = req.headers.get("content-type") || "";

    let importType: ImportType;
    let fileName: string;
    let fileSha256: string;
    let rawRows: Array<Record<string, unknown>> = [];
    let headers: string[] = [];
    let columnMap: Record<string, string> | undefined;
    let commitMode: CommitMode | undefined;
    let defaultAction: DuplicateDecision | undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const typeStr = String(formData.get("import_type") || "ASSET_MASTER").toUpperCase();
      if (!["ASSET_MASTER", "EQUIPMENT_MASTER", "MAPPING"].includes(typeStr)) {
        throw new AemsError("VALIDATION", "Jenis import tidak valid.", 400);
      }
      importType = typeStr as ImportType;

      if (!file) {
        throw new AemsError("FILE_INVALID", "Berkas .xlsx wajib diunggah.", 400);
      }
      fileName = file.name;
      const ab = await file.arrayBuffer();
      const buf = Buffer.from(ab);
      fileSha256 = crypto.createHash("sha256").update(buf).digest("hex");

      const parsed = await parseExcelBuffer(
        buf,
        fileName,
        state.app_settings.imports.max_file_mb
      );
      headers = parsed.headers;
      rawRows = parsed.rows;

      const colMapStr = formData.get("column_map");
      if (colMapStr) {
        columnMap = JSON.parse(String(colMapStr));
      }
      const modeStr = formData.get("commit_mode");
      if (modeStr) commitMode = String(modeStr) as CommitMode;
      const defAct = formData.get("default_action") || formData.get("default_duplicate_action");
      if (defAct) defaultAction = String(defAct) as DuplicateDecision;
    } else {
      // JSON body support (for structured API/integration tests and pre-parsed rows)
      const body = await req.json();
      const typeStr = String(body.import_type || "ASSET_MASTER").toUpperCase();
      if (!["ASSET_MASTER", "EQUIPMENT_MASTER", "MAPPING"].includes(typeStr)) {
        throw new AemsError("VALIDATION", "Jenis import tidak valid.", 400);
      }
      importType = typeStr as ImportType;
      fileName = String(body.file_name || "upload.xlsx");
      if (!fileName.toLowerCase().endsWith(".xlsx")) {
        throw new AemsError(
          "FILE_INVALID",
          "Format berkas tidak didukung. Hanya .xlsx yang diterima pada MVP.",
          415
        );
      }
      rawRows = Array.isArray(body.raw_rows)
        ? body.raw_rows
        : Array.isArray(body.rows)
        ? body.rows
        : [];
      fileSha256 =
        body.file_sha256 ||
        crypto
          .createHash("sha256")
          .update(JSON.stringify({ fileName, rawRows }))
          .digest("hex");
      columnMap = body.column_map;
      commitMode = body.commit_mode;
      defaultAction = body.default_action || body.default_duplicate_action;
      headers = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];
    }

    const batch = createAndValidateImportBatch(profile, {
      import_type: importType,
      file_name: fileName,
      file_sha256: fileSha256,
      raw_rows: rawRows,
      column_map: columnMap,
      commit_mode: commitMode,
      default_action: defaultAction,
      idempotency_key: req.headers.get("Idempotency-Key") || undefined,
    });

    return NextResponse.json(
      { data: batch, detected_headers: headers },
      { status: 201 }
    );
  } catch (err) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}

export const GET = withAemsPersistence(handleGET);

export const POST = withAemsPersistence(handlePOST);
