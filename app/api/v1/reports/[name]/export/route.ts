import { withAemsPersistence } from "@/lib/db/persistence";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { buildStandardReport } from "@/lib/db/reports";
import { recordReportExportAudit } from "@/lib/db/store";
import {
  generateReportExcelBuffer,
  generateReportPdfBuffer,
} from "@/lib/imports/excel";
import { AemsError, formatErrorResponse } from "@/lib/utils/errors";
import { hasPermission } from "@/lib/permissions/rbac";

async function exportReport(
  req: NextRequest,
  context: { params: Promise<{ name: string }> },
  formatInput: string,
  filters: Record<string, string>
) {
  try {
    const profile = await getCurrentProfile();
    if (!hasPermission(profile, "report:export")) {
      throw new AemsError("FORBIDDEN", "Role Anda tidak berwenang mengekspor laporan.", 403);
    }

    const { name } = await context.params;
    const format = formatInput.toUpperCase() === "PDF" ? "PDF" : "EXCEL";

    const report = buildStandardReport(profile, name, filters);
    const filterSummary =
      Object.entries(filters)
        .filter(([, v]) => Boolean(v))
        .map(([k, v]) => `${k}=${v}`)
        .join(", ") || "Semua Data";

    // FR-RPT-07: Record export itself in audit_logs
    recordReportExportAudit(profile, name, format, filters);

    if (format === "PDF") {
      const pdfBuf = await generateReportPdfBuffer(
        report.title,
        report.columns,
        report.rows,
        { generatedBy: profile.full_name, filterSummary }
      );
      return new NextResponse(new Uint8Array(pdfBuf), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="Laporan_${name}.pdf"`,
        },
      });
    } else {
      const xlsxBuf = await generateReportExcelBuffer(
        report.title,
        report.columns,
        report.rows,
        { generatedBy: profile.full_name, filterSummary }
      );
      return new NextResponse(new Uint8Array(xlsxBuf), {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="Laporan_${name}.xlsx"`,
        },
      });
    }
  } catch (err) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}

async function handleGET(req: NextRequest, context: { params: Promise<{ name: string }> }) {
  const filters = Object.fromEntries(req.nextUrl.searchParams.entries());
  return exportReport(req, context, req.nextUrl.searchParams.get("format") || "xlsx", filters);
}

async function handlePOST(req: NextRequest, context: { params: Promise<{ name: string }> }) {
  const body = await req.json().catch(() => ({}));
  return exportReport(req, context, String(body.format || "EXCEL"), body.filters || {});
}

export const GET = withAemsPersistence(handleGET);

export const POST = withAemsPersistence(handlePOST);
