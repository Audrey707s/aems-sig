// =============================================================================
// Server & Client Zod Validation Schemas (Blueprint R.02 Bab 8, 10, 15, 19)
// =============================================================================

import { z } from "zod";

export const createAssetSchema = z.object({
  company_code: z.string().trim().min(1, "Company code wajib diisi").default("MAIN"),
  sap_asset_no: z.string().trim().min(1, "Nomor aset SAP wajib diisi"),
  sap_sub_no: z.string().trim().min(1, "Sub-nomor aset wajib diisi").default("0000"),
  name: z.string().trim().min(2, "Nama aset minimal 2 karakter"),
  description: z.string().trim().nullable().optional(),
  asset_category_id: z.string().uuid().nullable().optional(),
  location_id: z.string().uuid().nullable().optional(),
  cost_center: z.string().trim().nullable().optional(),
  acquisition_date: z.string().trim().nullable().optional(),
  acquisition_value: z.number().nonnegative("Nilai perolehan tidak boleh negatif").nullable().optional(),
  currency: z.string().trim().length(3).default("IDR"),
  serial_no: z.string().trim().nullable().optional(),
  manufacturer: z.string().trim().nullable().optional(),
  model: z.string().trim().nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "DISPOSED"]).default("ACTIVE"),
  attributes: z.record(z.unknown()).optional().default({}),
});

export const updateAssetSchema = createAssetSchema.partial().extend({
  row_version: z.number().int().positive("row_version wajib disertakan untuk kontrol konkurensi"),
  change_reason: z.string().trim().optional(),
});

export const softDeleteSchema = z.object({
  reason: z.string().trim().min(3, "Alasan penonaktifan wajib diisi (minimal 3 karakter)"),
  cascade_descendants: z.boolean().optional().default(false),
});

export const createEquipmentSchema = z.object({
  source_system: z.string().trim().min(1).default("SAP_PM"),
  equipment_no: z.string().trim().min(1, "Nomor equipment wajib diisi"),
  kind: z.enum(["WHOLE_UNIT", "COMPONENT", "OTHER"]).default("OTHER"),
  name: z.string().trim().min(2, "Nama equipment minimal 2 karakter"),
  specification: z.string().trim().nullable().optional(),
  equipment_category_id: z.string().uuid().nullable().optional(),
  manufacturer: z.string().trim().nullable().optional(),
  model: z.string().trim().nullable().optional(),
  serial_no: z.string().trim().nullable().optional(),
  condition: z
    .enum(["BAIK", "RUSAK_RINGAN", "RUSAK_BERAT", "DALAM_PERBAIKAN", "TIDAK_DIKETAHUI"])
    .default("BAIK"),
  location_id: z.string().uuid().nullable().optional(),
  install_date: z.string().trim().nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "RETIRED"]).default("ACTIVE"),
  attributes: z.record(z.unknown()).optional().default({}),
});

export const updateEquipmentSchema = createEquipmentSchema.partial().extend({
  row_version: z.number().int().positive("row_version wajib disertakan untuk kontrol konkurensi"),
  change_reason: z.string().trim().optional(),
});

export const createSpecItemSchema = z.object({
  asset_id: z.string().uuid().nullable().optional(),
  equipment_id: z.string().uuid().nullable().optional(),
  spec_name: z.string().trim().min(1, "Nama spesifikasi/komponen wajib diisi"),
  spec_value: z.string().trim().min(1, "Nilai spesifikasi wajib diisi"),
  spec_group: z.string().trim().nullable().optional(),
  quantity: z.number().int().positive().default(1),
  serial_no: z.string().trim().nullable().optional(),
});

export const promoteSpecItemSchema = z.object({
  spec_item_id: z.string().uuid("ID spesifikasi tidak valid"),
  equipment_no: z.string().trim().min(1, "Nomor equipment resmi wajib diisi untuk promosi"),
  kind: z.enum(["WHOLE_UNIT", "COMPONENT", "OTHER"]).default("COMPONENT"),
  reason: z.string().trim().min(3, "Alasan promosi wajib diisi"),
});

export const mappingRequestItemSchema = z.object({
  equipment_id: z.string().uuid("ID equipment tidak valid"),
  action_type: z.enum(["LINK", "MOVE", "UNLINK"]),
  to_parent_kind: z.enum(["ASSET", "EQUIPMENT"]).nullable().optional(),
  to_parent_id: z.string().uuid().nullable().optional(),
});

export const createMappingRequestSchema = z.object({
  items: z.array(mappingRequestItemSchema).min(1, "Minimal 1 item perubahan mapping"),
  reason: z.string().trim().min(3, "Alasan pengajuan mapping wajib diisi"),
  effective_at: z.string().optional(),
  apply_immediately: z.boolean().optional().default(false),
});

export const decideMappingRequestSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  review_note: z.string().trim().min(2, "Catatan peninjauan wajib diisi"),
});
