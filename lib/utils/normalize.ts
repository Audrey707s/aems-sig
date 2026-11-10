// =============================================================================
// Business Key Normalization & Comparison Utilities (Blueprint R.02 BR-ID-04)
// =============================================================================

export interface NormalizationOptions {
  padNumeric?: boolean;
  padLength?: number;
}

/**
 * Normalizes a business key (SAP Asset No or Equipment No) per BR-ID-04:
 * - Trims leading/trailing whitespace
 * - Removes internal whitespace and invisible control characters
 * - Converts to uppercase
 * - Optionally pads purely numeric strings with leading zeros per SAP config
 */
export function normalizeKey(
  raw: string | number | null | undefined,
  options?: NormalizationOptions
): string {
  if (raw === null || raw === undefined) return "";
  const str = String(raw)
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();

  if (!str) return "";

  if (options?.padNumeric && /^\d+$/.test(str)) {
    const targetLen = options.padLength ?? 12;
    return str.padStart(targetLen, "0");
  }

  return str;
}

/**
 * Builds canonical composite business key for SAP Asset (BR-ID-02):
 * (company_code, normalized_asset_no, sub_number)
 */
export function buildAssetCompositeKey(
  companyCode: string | null | undefined,
  sapAssetNo: string | null | undefined,
  sapSubNo: string | null | undefined,
  options?: NormalizationOptions
): string {
  const cc = normalizeKey(companyCode || "MAIN");
  const assetNorm = normalizeKey(sapAssetNo, options);
  const sub = normalizeKey(sapSubNo || "0000");
  return `${cc}::${assetNorm}::${sub}`;
}

/**
 * Builds canonical composite business key for Equipment (BR-ID-03):
 * (source_system, normalized_equipment_no)
 */
export function buildEquipmentCompositeKey(
  sourceSystem: string | null | undefined,
  equipmentNo: string | null | undefined
): string {
  const src = normalizeKey(sourceSystem || "SAP_PM");
  const eqNorm = normalizeKey(equipmentNo);
  return `${src}::${eqNorm}`;
}

/**
 * Sanitizes string values before exporting to Excel to prevent CSV/Formula Injection (Bab 20.5 Table 71)
 */
export function sanitizeSpreadsheetCell(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" || typeof value === "boolean") return value;
  const str = String(value);
  if (/^[=+\-@]/.test(str)) {
    return `'${str}`;
  }
  return str;
}
