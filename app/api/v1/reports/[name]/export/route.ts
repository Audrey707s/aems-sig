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

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ name: string }> }
) {
  try {
    const profile = await getCurrentProfile();
    if (!hasPermission(profile, "report:export")) {
      throw new AemsError("FORBIDDEN", "Role Anda tidak berwenang mengekspor laporan.", 403);
    }

    const { name } = await context.params;
    const body = await req.json().catch(() => ({}));
    const format = String(body.format || "EXCEL").toUpperCase() as "EXCEL" | "PDF";
    const filters: Record<string, string> = body.filters || {};

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
