// =============================================================================
// Excel (.xlsx) Parsing, Template Generation, Error Reports, & Report Export
// Baseline: Blueprint R.02 Bab 16.6, 18.1, 20.5
// =============================================================================

import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { ImportRowRecord, ImportType } from "@/lib/types/domain";
import { sanitizeSpreadsheetCell } from "@/lib/utils/normalize";
import { AemsError } from "@/lib/utils/errors";

/**
 * Safely parses an uploaded .xlsx buffer into an array of row objects without
 * executing macros or dynamically evaluating formulas (Bab 18.2 Stage 2 & Bab 20.5).
 */
export async function parseExcelBuffer(
  buffer: ArrayBuffer | Buffer,
  fileName: string,
  maxFileMb = 10
): Promise<{ headers: string[]; rows: Array<Record<string, unknown>> }> {
  const lowerName = fileName.toLowerCase();
  if (!lowerName.endsWith(".xlsx")) {
    throw new AemsError(
      "FILE_INVALID",
      "Format berkas tidak didukung. Hanya berkas .xlsx yang diizinkan.",
      415
    );
  }

  const byteLen = buffer.byteLength;
  if (byteLen > maxFileMb * 1024 * 1024) {
    throw new AemsError(
      "FILE_INVALID",
      `Ukuran berkas melebihi batas maksimum ${maxFileMb} MB.`,
      413
    );
  }

  // Verify ZIP magic bytes (PK\x03\x04) for .xlsx container integrity
  const u8 = new Uint8Array(buffer instanceof Buffer ? buffer : buffer);
  if (u8.length < 4 || u8[0] !== 0x50 || u8[1] !== 0x4b) {
    throw new AemsError(
      "FILE_INVALID",
      "Struktur berkas .xlsx tidak valid atau rusak.",
      415
    );
  }

  const workbook = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new AemsError(
      "FILE_INVALID",
      "Berkas Excel tidak memiliki lembar kerja (worksheet).",
      400
    );
  }

  const headers: string[] = [];
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const val = extractCellPrimitive(cell.value);
    headers[colNumber] = String(val ?? `col_${colNumber}`).trim();
  });

  const validHeaders = headers.filter(Boolean);
  if (validHeaders.length === 0) {
    throw new AemsError(
      "FILE_INVALID",
      "Baris header (baris 1) pada lembar kerja kosong.",
      400
    );
  }

  const rows: Array<Record<string, unknown>> = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // skip header row
    const rowObj: Record<string, unknown> = {};
    let hasAnyValue = false;

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const headerKey = headers[colNumber];
      if (!headerKey) return;
      const val = extractCellPrimitive(cell.value);
      if (val !== null && val !== undefined && String(val).trim() !== "") {
        hasAnyValue = true;
      }
      rowObj[headerKey] = val ?? "";
    });

    if (hasAnyValue) {
      rows.push(rowObj);
    }
  });

  return { headers: validHeaders, rows };
}

function extractCellPrimitive(cellVal: ExcelJS.CellValue): unknown {
  if (cellVal === null || cellVal === undefined) return "";
  if (typeof cellVal === "string" || typeof cellVal === "number" || typeof cellVal === "boolean") {
    return cellVal;
  }
  if (cellVal instanceof Date) {
    return cellVal.toISOString().split("T")[0];
  }
  if (typeof cellVal === "object") {
    // Formula cell: read cached result only, never execute formula
    if ("result" in cellVal) {
      return cellVal.result ?? "";
    }
    if ("richText" in cellVal && Array.isArray(cellVal.richText)) {
      return cellVal.richText.map((rt) => rt.text).join("");
    }
    if ("text" in cellVal) {
      return cellVal.text;
    }
  }
  return String(cellVal);
}

/**
 * Generates standard .xlsx template for any of the 3 import types (Table 58, FR-IMP-02)
 */
export async function generateImportTemplateWorkbook(
  importType: ImportType
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AEMS System";
  workbook.created = new Date();

  const dataSheet = workbook.addWorksheet("Data Import");
  const guideSheet = workbook.addWorksheet("Petunjuk & Nilai Standar");

  if (importType === "ASSET_MASTER") {
    dataSheet.columns = [
      { header: "company_code", key: "company_code", width: 16 },
      { header: "sap_asset_no", key: "sap_asset_no", width: 20 },
      { header: "sap_sub_no", key: "sap_sub_no", width: 14 },
      { header: "name", key: "name", width: 32 },
      { header: "category_code", key: "category_code", width: 18 },
      { header: "location_code", key: "location_code", width: 18 },
      { header: "cost_center", key: "cost_center", width: 16 },
      { header: "acquisition_date", key: "acquisition_date", width: 18 },
      { header: "acquisition_value", key: "acquisition_value", width: 20 },
      { header: "status", key: "status", width: 14 },
      { header: "description", key: "description", width: 36 },
    ];
    dataSheet.addRow({
      company_code: "MAIN",
      sap_asset_no: "SAP-010",
      sap_sub_no: "0000",
      name: "Kompresor Udara Screw",
      category_code: "CAT-MSN",
      location_code: "LOC-UTL",
      cost_center: "CC-3100",
      acquisition_date: "2026-10-01",
      acquisition_value: 125000000,
      status: "ACTIVE",
      description: "Contoh baris baru Master Asset SAP",
    });
    dataSheet.addRow({
      company_code: "MAIN",
      sap_asset_no: "SAP-001",
      sap_sub_no: "0000",
      name: "Laptop Lenovo ThinkPad T14 (Update)",
      category_code: "CAT-IT",
      location_code: "LOC-GRS",
      cost_center: "CC-1100",
      acquisition_date: "2026-01-15",
      acquisition_value: 18500000,
      status: "ACTIVE",
      description: "Contoh baris duplikat untuk uji Skip/Replace",
    });
  } else if (importType === "EQUIPMENT_MASTER") {
    dataSheet.columns = [
      { header: "source_system", key: "source_system", width: 16 },
      { header: "equipment_no", key: "equipment_no", width: 20 },
      { header: "name", key: "name", width: 30 },
      { header: "kind", key: "kind", width: 18 },
      { header: "serial_no", key: "serial_no", width: 20 },
      { header: "condition", key: "condition", width: 18 },
      { header: "location_code", key: "location_code", width: 18 },
      { header: "status", key: "status", width: 14 },
      { header: "specification", key: "specification", width: 34 },
    ];
    dataSheet.addRow({
      source_system: "SAP_PM",
      equipment_no: "EQ-501",
      name: "Inverter VFD 55kW",
      kind: "COMPONENT",
      serial_no: "SN-VFD-501",
      condition: "BAIK",
      location_code: "LOC-L2",
      status: "ACTIVE",
      specification: "ABB ACS580 3-Phase 400V",
    });
    dataSheet.addRow({
      source_system: "SAP_PM",
      equipment_no: "EQ-101",
      name: "SSD NVMe 512GB",
      kind: "COMPONENT",
      serial_no: "SN-SSD-101",
      condition: "BAIK",
      location_code: "LOC-GRS",
      status: "ACTIVE",
      specification: "PCIe 4.0 M.2 2280 (Contoh duplikat)",
    });
  } else {
    dataSheet.columns = [
      { header: "equipment_no", key: "equipment_no", width: 20 },
      { header: "parent_type", key: "parent_type", width: 18 },
      { header: "parent_no", key: "parent_no", width: 20 },
      { header: "company_code", key: "company_code", width: 16 },
      { header: "sap_sub_no", key: "sap_sub_no", width: 14 },
      { header: "effective_date", key: "effective_date", width: 18 },
      { header: "reason", key: "reason", width: 36 },
    ];
    dataSheet.addRow({
      equipment_no: "EQ-900",
      parent_type: "ASSET",
      parent_no: "SAP-004",
      company_code: "MAIN",
      sap_sub_no: "0000",
      effective_date: "2026-11-11",
      reason: "Mapping awal printer cadangan ke aset SAP-004",
    });
  }

  styleHeaderRow(dataSheet.getRow(1));

  guideSheet.columns = [
    { header: "Atribut / Kolom", key: "col", width: 24 },
    { header: "Keterangan & Nilai yang Diizinkan", key: "desc", width: 70 },
  ];
  guideSheet.addRow({
    col: "Format Berkas",
    desc: "Hanya .xlsx (maksimum 10 MB atau 20.000 baris). Rumus dan makro diabaikan demi keamanan.",
  });
  guideSheet.addRow({
    col: "Normalisasi Key",
    desc: "Spasi di tepi/dalam dihapus dan diubah ke HURUF BESAR otomatis.",
  });
  guideSheet.addRow({
    col: "Aturan Replace",
    desc: "Sel kosong tidak menimpa nilai lama. Replace tidak menghapus sub-unit, relasi aktif, atau histori.",
  });
  styleHeaderRow(guideSheet.getRow(1));

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Generates an .xlsx Error Report for a batch (FR-IMP-09, Table 59 Stage 6)
 */
export async function generateImportErrorReportWorkbook(
  batchId: string,
  fileName: string,
  rows: ImportRowRecord[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Error Report Import");

  sheet.columns = [
    { header: "Baris Excel", key: "row_number", width: 14 },
    { header: "Business Key", key: "display_key", width: 22 },
    { header: "Status Validasi", key: "validation_status", width: 18 },
    { header: "Status Pencocokan", key: "match_status", width: 20 },
    { header: "Tindakan", key: "action", width: 14 },
    { header: "Hasil Commit", key: "result_status", width: 20 },
    { header: "Detail Galat / Pesan", key: "message", width: 60 },
  ];

  styleHeaderRow(sheet.getRow(1));

  for (const r of rows) {
    const errText =
      r.errors.length > 0
        ? r.errors.map((e) => `[${e.code}] ${e.field ? `${e.field}: ` : ""}${e.message}`).join(" | ")
        : r.result_message || "OK";

    sheet.addRow({
      row_number: r.row_number,
      display_key: sanitizeSpreadsheetCell(r.display_key),
      validation_status: r.validation_status,
      match_status: r.match_status,
      action: r.action,
      result_status: r.result_status || "-",
      message: sanitizeSpreadsheetCell(errText),
    });
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Generates an .xlsx Report export with formula-injection protection (Bab 16.6, Bab 20.5)
 */
export async function generateReportExcelBuffer(
  title: string,
  columns: Array<{ header: string; key: string; width?: number }>,
  rows: Array<Record<string, unknown>>,
  meta: { generatedBy: string; filterSummary: string }
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(title.slice(0, 31));

  sheet.addRow([`AEMS — ${title}`]);
  sheet.addRow([
    `Diekspor oleh: ${meta.generatedBy} | Waktu: ${new Date().toISOString()} | Filter: ${meta.filterSummary || "Semua"}`,
  ]);
  sheet.addRow([]);

  const headerRowValues = columns.map((c) => c.header);
  const headerRow = sheet.addRow(headerRowValues);
  styleHeaderRow(headerRow);

  columns.forEach((col, i) => {
    sheet.getColumn(i + 1).width = col.width || 22;
  });

  for (const row of rows) {
    const vals = columns.map((c) => sanitizeSpreadsheetCell(row[c.key] ?? "-"));
    sheet.addRow(vals);
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Generates a clean PDF report buffer using pdf-lib (Bab 16.6, max 2000 rows per file)
 */
export async function generateReportPdfBuffer(
  title: string,
  columns: Array<{ header: string; key: string }>,
  rows: Array<Record<string, unknown>>,
  meta: { generatedBy: string; filterSummary: string }
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 841.89; // A4 Landscape
  const pageHeight = 595.28;
  const margin = 36;
  const usableWidth = pageWidth - margin * 2;
  const colWidth = usableWidth / Math.max(columns.length, 1);

  const limitedRows = rows.slice(0, 2000);
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const drawHeader = () => {
    // Navy brand banner
    page.drawRectangle({
      x: margin,
      y: y - 28,
      width: usableWidth,
      height: 28,
      color: rgb(0.102, 0.196, 0.388), // #1A3263
    });
    page.drawText(`AEMS — ${title}`, {
      x: margin + 10,
      y: y - 19,
      size: 12,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    y -= 42;

    page.drawText(
      `Dibuat oleh: ${meta.generatedBy}   |   Tanggal: ${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC   |   Filter: ${meta.filterSummary || "Semua"}`,
      {
        x: margin,
        y,
        size: 8.5,
        font: fontRegular,
        color: rgb(0.3, 0.3, 0.3),
      }
    );
    y -= 18;

    // Table column headers
    page.drawRectangle({
      x: margin,
      y: y - 16,
      width: usableWidth,
      height: 18,
      color: rgb(0.94, 0.94, 0.95),
    });
    columns.forEach((col, idx) => {
      page.drawText(col.header.slice(0, 24), {
        x: margin + idx * colWidth + 4,
        y: y - 11,
        size: 8,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1),
      });
    });
    y -= 22;
  };

  drawHeader();

  for (const row of limitedRows) {
    if (y < margin + 24) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
      drawHeader();
    }

    columns.forEach((col, idx) => {
      const rawText = String(row[col.key] ?? "-").replace(/[^\x20-\x7E]/g, "");
      const maxChars = Math.max(Math.floor(colWidth / 4.8), 8);
      const clipped =
        rawText.length > maxChars ? `${rawText.slice(0, maxChars - 2)}..` : rawText;
      page.drawText(clipped, {
        x: margin + idx * colWidth + 4,
        y: y - 10,
        size: 8,
        font: fontRegular,
        color: rgb(0.15, 0.15, 0.15),
      });
    });

    page.drawLine({
      start: { x: margin, y: y - 14 },
      end: { x: pageWidth - margin, y: y - 14 },
      thickness: 0.4,
      color: rgb(0.88, 0.88, 0.88),
    });
    y -= 16;
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1A3263" },
    };
    cell.alignment = { vertical: "middle", horizontal: "left" };
  });
  row.height = 22;
}
