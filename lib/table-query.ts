export const NONE_VALUE = "__none__";
export type SortDirection = "asc" | "desc";
export function selectedValues(raw: string | null | undefined): string[] {
  return [...new Set((raw || "").split(",").map(v => v.trim()).filter(Boolean))];
}
export function matchesSelected(value: unknown, raw: string | null | undefined): boolean {
  const selected = selectedValues(raw);
  return !selected.length || selected.includes(value === null || value === undefined || value === "" ? NONE_VALUE : String(value));
}
export function sortTableRows<T extends object>(rows: T[], key: string, direction: SortDirection, allowed: readonly string[], fallback: string): T[] {
  const field = allowed.includes(key) ? key : fallback;
  return [...rows].sort((a, b) => {
    const av = (a as Record<string,unknown>)[field], bv = (b as Record<string,unknown>)[field];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const result = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), "id", {numeric: true, sensitivity: "base"});
    return result * (direction === "desc" ? -1 : 1);
  });
}
export const assetSortKeys = ["sap_asset_no","sap_sub_no","name","category_name","location_name","acquisition_value","total_equipment_count","status"];
export const equipmentSortKeys = ["equipment_no","name","kind","category_name","location_name","status","parent_label","root_asset_no","depth","condition"];
export const statusOptions = [{value:"ACTIVE",label:"Aktif"},{value:"INACTIVE",label:"Nonaktif"},{value:"DISPOSED",label:"Dilepas"}];
export const equipmentStatusOptions = [...statusOptions.slice(0,2),{value:"RETIRED",label:"Dipensiunkan"}];
export const kindOptions = [{value:"WHOLE_UNIT",label:"Perangkat utuh"},{value:"COMPONENT",label:"Komponen"},{value:"OTHER",label:"Lainnya"}];
export const physicalOptions = [{value:"BAIK",label:"Baik"},{value:"RUSAK_RINGAN",label:"Rusak ringan"},{value:"RUSAK_BERAT",label:"Rusak berat"},{value:"DALAM_PERBAIKAN",label:"Dalam perbaikan"}];
export const mappingOptions = [{value:"MAPPED",label:"Terhubung"},{value:"UNMAPPED",label:"Belum terhubung"}];
export const SUB_ASSET_HELP = "Sub-aset membedakan bagian aset dalam satu nomor SAP. Gunakan 0000 untuk aset utama; nomor ini ikut diperiksa saat impor agar data tidak tertukar.";
