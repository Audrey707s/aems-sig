// =============================================================================
// 8 Standard Reports Definition & Data Builder (Blueprint R.02 Bab 16.6 Table 53)
// =============================================================================

import {
  getAemsState,
  getEnrichedAssets,
  getEnrichedEquipment,
} from "@/lib/db/store";
import { AppRole, Profile } from "@/lib/types/domain";
import { hasPermission } from "@/lib/permissions/rbac";
import { AemsError } from "@/lib/utils/errors";

export type ReportName =
  | "all-assets"
  | "all-equipment"
  | "assets-without-equipment"
  | "equipment-without-asset"
  | "inconsistent-data"
  | "movement-history"
  | "master-change-history"
  | "import-history";

export interface ReportOutput {
  name: ReportName;
  title: string;
  columns: Array<{ header: string; key: string; width?: number }>;
  rows: Array<Record<string, unknown>>;
}

export function buildStandardReport(
  actor: Profile,
  reportName: string,
  filters?: Record<string, string>
): ReportOutput {
  if (!hasPermission(actor, "report:read")) {
    throw new AemsError("FORBIDDEN", "Akses laporan ditolak.", 403);
  }

  const state = getAemsState();
  const activeEquipment = state.equipment.filter((e) => e.deleted_at === null);
  const mappedAssetIds = new Set(
    activeEquipment.map((e) => e.root_asset_id).filter(Boolean) as string[]
  );

  const q = (filters?.q || "").trim().toLowerCase();
  const categoryId = filters?.category_id || "";
  const locationId = filters?.location_id || "";
  const kind = filters?.kind || "";
  const statusFilter = filters?.status || "";

  switch (reportName as ReportName) {
    case "all-assets": {
      let rows = getEnrichedAssets(false, actor.role).map((a) => ({
        company_code: a.company_code,
        sap_asset_no: a.sap_asset_no,
        sap_sub_no: a.sap_sub_no,
        name: a.name,
        category_name: a.category_name,
        location_name: a.location_name,
        cost_center: a.cost_center || "-",
        acquisition_value:
          a.acquisition_value !== null
            ? `Rp ${a.acquisition_value.toLocaleString("id-ID")}`
            : "Disembunyikan",
        equipment_count: activeEquipment.filter((e) => e.root_asset_id === a.id)
          .length,
        status: a.status,
        asset_category_id: a.asset_category_id,
        location_id: a.location_id,
      }));
      if (categoryId) rows = rows.filter((r) => r.asset_category_id === categoryId);
      if (locationId) rows = rows.filter((r) => r.location_id === locationId);
      if (statusFilter) rows = rows.filter((r) => r.status === statusFilter);
      if (q) {
        rows = rows.filter(
          (r) =>
            r.sap_asset_no.toLowerCase().includes(q) ||
            r.name.toLowerCase().includes(q)
        );
      }
      return {
        name: "all-assets",
        title: "Laporan Seluruh Aset SAP",
        columns: [
          { header: "Company", key: "company_code", width: 12 },
          { header: "No. Aset SAP", key: "sap_asset_no", width: 18 },
          { header: "Sub-No", key: "sap_sub_no", width: 12 },
          { header: "Nama Aset", key: "name", width: 32 },
          { header: "Kategori", key: "category_name", width: 22 },
          { header: "Lokasi", key: "location_name", width: 22 },
          { header: "Cost Center", key: "cost_center", width: 16 },
          { header: "Nilai Perolehan", key: "acquisition_value", width: 22 },
          { header: "Jml Equipment", key: "equipment_count", width: 16 },
          { header: "Status", key: "status", width: 14 },
        ],
        rows,
      };
    }

    case "all-equipment": {
      let rows = getEnrichedEquipment(false).map((e) => ({
        source_system: e.source_system,
        equipment_no: e.equipment_no,
        name: e.name,
        kind: e.kind,
        parent_no: e.active_parent_no || "(Unmapped)",
        root_asset_no: e.root_asset_no || "(Belum ada aset)",
        condition: e.condition,
        location_name: e.location_name,
        serial_no: e.serial_no || "-",
        status: e.status,
        location_id: e.location_id,
      }));
      if (kind) rows = rows.filter((r) => r.kind === kind);
      if (locationId) rows = rows.filter((r) => r.location_id === locationId);
      if (statusFilter) rows = rows.filter((r) => r.status === statusFilter);
      if (q) {
        rows = rows.filter(
          (r) =>
            r.equipment_no.toLowerCase().includes(q) ||
            r.name.toLowerCase().includes(q)
        );
      }
      return {
        name: "all-equipment",
        title: "Laporan Seluruh Equipment",
        columns: [
          { header: "Sumber", key: "source_system", width: 14 },
          { header: "No. Equipment", key: "equipment_no", width: 18 },
          { header: "Nama Equipment", key: "name", width: 30 },
          { header: "Jenis", key: "kind", width: 18 },
          { header: "Parent Langsung", key: "parent_no", width: 18 },
          { header: "Aset Induk Efektif", key: "root_asset_no", width: 20 },
          { header: "Kondisi", key: "condition", width: 18 },
          { header: "Lokasi", key: "location_name", width: 22 },
          { header: "Serial No", key: "serial_no", width: 18 },
          { header: "Status", key: "status", width: 14 },
        ],
        rows,
      };
    }

    case "assets-without-equipment": {
      let rows = getEnrichedAssets(false, actor.role)
        .filter((a) => !mappedAssetIds.has(a.id))
        .map((a) => ({
          sap_asset_no: a.sap_asset_no,
          name: a.name,
          category_name: a.category_name,
          location_name: a.location_name,
          acquisition_date: a.acquisition_date || "-",
          status: a.status,
          asset_category_id: a.asset_category_id,
          location_id: a.location_id,
        }));
      if (categoryId) rows = rows.filter((r) => r.asset_category_id === categoryId);
      if (locationId) rows = rows.filter((r) => r.location_id === locationId);
      return {
        name: "assets-without-equipment",
        title: "Laporan Aset Tanpa Equipment",
        columns: [
          { header: "No. Aset SAP", key: "sap_asset_no", width: 20 },
          { header: "Nama Aset", key: "name", width: 34 },
          { header: "Kategori", key: "category_name", width: 24 },
          { header: "Lokasi", key: "location_name", width: 24 },
          { header: "Tgl Perolehan", key: "acquisition_date", width: 18 },
          { header: "Status", key: "status", width: 14 },
        ],
        rows,
      };
    }

    case "equipment-without-asset": {
      let rows = getEnrichedEquipment(false)
        .filter((e) => e.root_asset_id === null)
        .map((e) => ({
          equipment_no: e.equipment_no,
          name: e.name,
          kind: e.kind,
          location_name: e.location_name,
          condition: e.condition,
          reason: e.active_parent_id
            ? "Rantai parent tanpa aset induk"
            : "Mandiri (tanpa parent)",
          status: e.status,
          location_id: e.location_id,
        }));
      if (kind) rows = rows.filter((r) => r.kind === kind);
      if (locationId) rows = rows.filter((r) => r.location_id === locationId);
      return {
        name: "equipment-without-asset",
        title: "Laporan Equipment Tanpa Aset (Unmapped)",
        columns: [
          { header: "No. Equipment", key: "equipment_no", width: 20 },
          { header: "Nama Equipment", key: "name", width: 32 },
          { header: "Jenis", key: "kind", width: 18 },
          { header: "Lokasi", key: "location_name", width: 22 },
          { header: "Kondisi", key: "condition", width: 18 },
          { header: "Keterangan Unmapped", key: "reason", width: 32 },
          { header: "Status", key: "status", width: 14 },
        ],
        rows,
      };
    }

    case "inconsistent-data": {
      const rows = state.reconciliation_findings.map((f) => ({
        detected_at: f.detected_at.slice(0, 19).replace("T", " "),
        finding_type: f.finding_type,
        severity: f.severity,
        entity_code: f.entity_code,
        entity_name: f.entity_name,
        description: f.description,
        status: f.status,
        resolution_note: f.resolution_note || "-",
      }));
      return {
        name: "inconsistent-data",
        title: "Laporan Data Tidak Konsisten & Temuan Rekonsiliasi",
        columns: [
          { header: "Waktu Deteksi", key: "detected_at", width: 20 },
          { header: "Jenis Temuan", key: "finding_type", width: 28 },
          { header: "Severitas", key: "severity", width: 14 },
          { header: "Kode Entitas", key: "entity_code", width: 18 },
          { header: "Nama Entitas", key: "entity_name", width: 26 },
          { header: "Deskripsi", key: "description", width: 45 },
          { header: "Status", key: "status", width: 14 },
          { header: "Catatan Penyelesaian", key: "resolution_note", width: 30 },
        ],
        rows,
      };
    }

    case "movement-history": {
      const rows = state.mapping_history.map((h) => ({
        occurred_at: h.occurred_at.slice(0, 19).replace("T", " "),
        request_code: h.request_code || "-",
        event_type: h.event_type,
        equipment_no: h.equipment_no,
        equipment_name: h.equipment_name,
        from_parent: h.from_parent_no || "(Unmapped)",
        to_parent: h.to_parent_no || "(Unmapped)",
        from_asset: h.from_asset_no || "-",
        to_asset: h.to_asset_no || "-",
        actor_name: h.actor_name,
        approver_name: h.approver_name || "-",
        reason: h.reason || "-",
      }));
      return {
        name: "movement-history",
        title: "Laporan Histori Perpindahan Equipment",
        columns: [
          { header: "Waktu Efektif", key: "occurred_at", width: 20 },
          { header: "No. Pengajuan", key: "request_code", width: 16 },
          { header: "Peristiwa", key: "event_type", width: 18 },
          { header: "No. Equipment", key: "equipment_no", width: 18 },
          { header: "Nama Equipment", key: "equipment_name", width: 28 },
          { header: "Parent Asal", key: "from_parent", width: 18 },
          { header: "Parent Tujuan", key: "to_parent", width: 18 },
          { header: "Aset Asal", key: "from_asset", width: 16 },
          { header: "Aset Tujuan", key: "to_asset", width: 16 },
          { header: "Pemohon", key: "actor_name", width: 24 },
          { header: "Penyetuju", key: "approver_name", width: 24 },
          { header: "Alasan", key: "reason", width: 34 },
        ],
        rows,
      };
    }

    case "master-change-history": {
      const rows = state.audit_logs
        .filter((l) => ["ASSET", "EQUIPMENT", "SPEC_ITEM"].includes(l.entity_type))
        .map((l) => ({
          occurred_at: l.occurred_at.slice(0, 19).replace("T", " "),
          entity_type: l.entity_type,
          entity_code: l.entity_code || "-",
          action: l.action,
          actor_name: l.actor_name,
          actor_role: l.actor_role || "-",
          changed_fields: l.changed_fields.join(", ") || "-",
          old_values: l.old_values ? JSON.stringify(l.old_values) : "-",
          new_values: l.new_values ? JSON.stringify(l.new_values) : "-",
        }));
      return {
        name: "master-change-history",
        title: "Laporan Histori Perubahan Master Data",
        columns: [
          { header: "Waktu", key: "occurred_at", width: 20 },
          { header: "Tipe", key: "entity_type", width: 14 },
          { header: "Kode Objek", key: "entity_code", width: 18 },
          { header: "Aksi", key: "action", width: 16 },
          { header: "Pelaku", key: "actor_name", width: 24 },
          { header: "Role", key: "actor_role", width: 16 },
          { header: "Field Berubah", key: "changed_fields", width: 24 },
          { header: "Nilai Lama", key: "old_values", width: 36 },
          { header: "Nilai Baru", key: "new_values", width: 36 },
        ],
        rows,
      };
    }

    case "import-history": {
      const canViewAll = hasPermission(actor, "import:view_all");
      const rows = state.import_batches
        .filter((b) => canViewAll || b.uploaded_by === actor.id)
        .map((b) => ({
          started_at: b.started_at.slice(0, 19).replace("T", " "),
          import_type: b.import_type,
          file_name: b.file_name,
          uploader_name: b.uploader_name,
          status: b.status,
          commit_mode: b.commit_mode,
          total_count: b.total_count,
          inserted_count: b.inserted_count,
          replaced_count: b.replaced_count,
          skipped_count: b.skipped_count,
          failed_count: b.failed_count,
        }));
      return {
        name: "import-history",
        title: "Laporan Histori Import Excel",
        columns: [
          { header: "Waktu Import", key: "started_at", width: 20 },
          { header: "Jenis Import", key: "import_type", width: 20 },
          { header: "Nama Berkas", key: "file_name", width: 28 },
          { header: "Diunggah Oleh", key: "uploader_name", width: 24 },
          { header: "Status", key: "status", width: 22 },
          { header: "Mode", key: "commit_mode", width: 12 },
          { header: "Total", key: "total_count", width: 10 },
          { header: "Insert", key: "inserted_count", width: 10 },
          { header: "Replace", key: "replaced_count", width: 10 },
          { header: "Skip", key: "skipped_count", width: 10 },
          { header: "Gagal", key: "failed_count", width: 10 },
        ],
        rows,
      };
    }

    default:
      throw new AemsError(
        "NOT_FOUND",
        `Laporan '${reportName}' tidak ditemukan.`,
        404
      );
  }
}
