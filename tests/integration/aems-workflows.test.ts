import { beforeEach, describe, expect, it } from "vitest";
import {
  commitImportBatch,
  createAndValidateImportBatch,
  getAemsState,
  getEquipmentBreadcrumb,
  resetAemsState,
  runReconciliationScan,
  searchBidirectional,
  updateImportBatchDecisions,
} from "@/lib/db/store";
import { SEED_IDS } from "@/lib/db/seed-data";
import { buildStandardReport } from "@/lib/db/reports";
import {
  generateImportErrorReportWorkbook,
  generateImportTemplateWorkbook,
  generateReportExcelBuffer,
  generateReportPdfBuffer,
  parseExcelBuffer,
} from "@/lib/imports/excel";

describe("AEMS Integration Tests — Import Pipeline, Replace/Skip, Excel/PDF & Reports", () => {
  beforeEach(() => {
    resetAemsState();
  });

  // ---------------------------------------------------------------------------
  // 1. Excel Import Staging, Duplicate Detection, Skip vs Replace & Blank Protection
  // ---------------------------------------------------------------------------
  describe("Excel Import End-to-End Staging & Commit Invariants (Bab 18)", () => {
    it("detects NEW, IDENTICAL, DUPLICATE_DIFF, and DUPLICATE_IN_FILE accurately on Asset Import (AC-07)", () => {
      const state = getAemsState();
      const accounting = state.profiles.find((p) => p.role === "ACCOUNTING")!;

      const batch = createAndValidateImportBatch(accounting, {
        import_type: "ASSET_MASTER",
        file_name: "upload-aset-test.xlsx",
        file_sha256: "sha256-test-1",
        default_action: "SKIP",
        commit_mode: "PARTIAL",
        raw_rows: [
          // Row 2: Identical to SAP-001 (blank optional fields ignored per A-08)
          {
            company_code: "MAIN",
            sap_asset_no: "SAP-001",
            sap_sub_no: "0000",
            name: "Laptop Lenovo ThinkPad T14",
          },
          // Row 3: Duplicate with diff on SAP-002 (updated name & value, blank description should NOT wipe existing description)
          {
            company_code: "MAIN",
            sap_asset_no: " sap-002 ",
            sap_sub_no: "0000",
            name: "Mesin Produksi Rotary Kiln (Overhaul 2026)",
            acquisition_value: 495000000,
            description: "",
          },
          // Row 4: Brand new asset SAP-005
          {
            company_code: "MAIN",
            sap_asset_no: "SAP-005",
            sap_sub_no: "0000",
            name: "Forklift Toyota 5 Ton",
            category_code: "CAT-KND",
            location_code: "LOC-GDG",
            acquisition_value: 650000000,
          },
          // Row 5: Duplicate in-file with Row 4
          {
            company_code: "MAIN",
            sap_asset_no: " sap-005 ",
            sap_sub_no: "0000",
            name: "Forklift Duplikat Baris",
          },
        ],
      });

      expect(batch.total_count).toBe(4);
      expect(batch.identical_count).toBe(1); // SAP-001
      expect(batch.dup_count).toBe(1); // SAP-002
      expect(batch.new_count).toBe(1); // SAP-005 first occurrence
      expect(batch.invalid_count).toBe(1); // SAP-005 second occurrence in file

      // Set SAP-002 duplicate row decision to REPLACE
      const dupRow = batch.rows!.find((r) => r.match_status === "DUPLICATE_DIFF")!;
      updateImportBatchDecisions(accounting, batch.id, {
        row_decisions: { [dupRow.id]: "REPLACE" },
        commit_mode: "PARTIAL",
      });

      const committed = commitImportBatch(accounting, batch.id, "idem-key-001");
      expect(committed.status).toBe("COMPLETED_WITH_ERRORS");
      expect(committed.inserted_count).toBe(1); // SAP-005
      expect(committed.replaced_count).toBe(1); // SAP-002
      expect(committed.skipped_count).toBe(1); // SAP-001 (IDENTICAL)
      expect(committed.failed_count).toBe(1); // in-file duplicate

      // Verify SAP-002 was updated without losing its existing description (A-08) or active equipment children (R-10)
      const sap002 = state.assets.find((a) => a.id === SEED_IDS.ASSET_SAP_002)!;
      expect(sap002.name).toBe("Mesin Produksi Rotary Kiln (Overhaul 2026)");
      expect(sap002.acquisition_value).toBe(495000000);
      expect(sap002.description).toContain("Mesin utama lini produksi 2"); // preserved!

      // Verify idempotency on duplicate commit call (AC-09, BR-IM-06)
      const retryCommit = commitImportBatch(accounting, batch.id, "idem-key-001");
      expect(retryCommit.inserted_count).toBe(1);
      expect(state.assets.filter((a) => a.sap_asset_no === "SAP-005").length).toBe(1);
    });

    it("preserves active hierarchy relationships and children when Equipment Master is REPLACED via import (R-10, AC-08)", () => {
      const state = getAemsState();
      const maintenance = state.profiles.find((p) => p.role === "MAINTENANCE")!;

      const batch = createAndValidateImportBatch(maintenance, {
        import_type: "EQUIPMENT_MASTER",
        file_name: "update-eq001.xlsx",
        file_sha256: "sha256-eq-replace",
        default_action: "REPLACE",
        commit_mode: "ATOMIC",
        raw_rows: [
          {
            source_system: "SAP_PM",
            equipment_no: "EQ-001",
            kind: "WHOLE_UNIT",
            name: "Laptop Unit Utama (Updated via Import)",
            specification: "Intel Core i7, 14 inch — Upgraded",
            condition: "BAIK",
          },
        ],
      });

      expect(batch.dup_count).toBe(1);
      const committed = commitImportBatch(maintenance, batch.id);
      expect(committed.status).toBe("COMPLETED");
      expect(committed.replaced_count).toBe(1);

      // Verify EQ-001 still has root_asset_id = SAP-001 and all 3 children intact
      const eq001 = state.equipment.find((e) => e.id === SEED_IDS.EQ_001)!;
      expect(eq001.name).toBe("Laptop Unit Utama (Updated via Import)");
      expect(eq001.root_asset_id).toBe(SEED_IDS.ASSET_SAP_001);

      const activeChildren = state.equipment_relationships.filter(
        (r) => r.parent_equipment_id === SEED_IDS.EQ_001 && r.valid_to === null
      );
      expect(activeChildren.length).toBe(3);
    });

    it("rolls back entire transaction in ATOMIC mode when any row is invalid or has version conflict (AC-10, BR-IM-07)", () => {
      const state = getAemsState();
      const accounting = state.profiles.find((p) => p.role === "ACCOUNTING")!;
      const initialAssetCount = state.assets.length;

      const batch = createAndValidateImportBatch(accounting, {
        import_type: "ASSET_MASTER",
        file_name: "atomic-rollback.xlsx",
        file_sha256: "sha256-atomic-fail",
        default_action: "REPLACE",
        commit_mode: "ATOMIC",
        raw_rows: [
          {
            company_code: "MAIN",
            sap_asset_no: "SAP-099",
            sap_sub_no: "0000",
            name: "Aset Valid Baru",
          },
          {
            company_code: "MAIN",
            sap_asset_no: "", // INVALID: missing required sap_asset_no
            sap_sub_no: "0000",
            name: "Aset Tanpa Nomor",
          },
        ],
      });

      expect(() => commitImportBatch(accounting, batch.id)).toThrow(/Mode ATOMIC/i);
      expect(batch.status).toBe("FAILED");
      // SAP-099 must NOT exist in state.assets because ATOMIC rolled back
      expect(state.assets.length).toBe(initialAssetCount);
    });

    it("detects intra-file hierarchy cycles across rows in MAPPING import (BR-IM-09)", () => {
      const state = getAemsState();
      const admin = state.profiles.find((p) => p.role === "ADMIN")!;

      const batch = createAndValidateImportBatch(admin, {
        import_type: "MAPPING",
        file_name: "mapping-cycle.xlsx",
        file_sha256: "sha256-map-cycle",
        raw_rows: [
          {
            equipment_no: "EQ-301",
            parent_type: "EQUIPMENT",
            parent_no: "EQ-900",
          },
          {
            equipment_no: "EQ-900",
            parent_type: "EQUIPMENT",
            parent_no: "EQ-301",
          },
        ],
      });

      expect(batch.invalid_count).toBe(2);
      expect(
        batch.rows!.every((r) => r.errors.some((e) => e.code === "AE001"))
      ).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Real Excel (.xlsx) & PDF Generation and Roundtrip Parsing
  // ---------------------------------------------------------------------------
  describe("Excel (.xlsx) & PDF Generation and Roundtrip Parsing", () => {
    it("generates a valid .xlsx template and parses it back via ExcelJS", async () => {
      const buffer = await generateImportTemplateWorkbook("ASSET_MASTER");
      expect(buffer.byteLength).toBeGreaterThan(1000);

      const parsed = await parseExcelBuffer(buffer, "template_asset.xlsx");
      expect(parsed.headers).toContain("sap_asset_no");
      expect(parsed.rows.length).toBeGreaterThanOrEqual(2);
    });

    it("generates .xlsx error report and standard reports in .xlsx and .pdf formats", async () => {
      const state = getAemsState();
      const admin = state.profiles.find((p) => p.role === "ADMIN")!;

      const batch = createAndValidateImportBatch(admin, {
        import_type: "ASSET_MASTER",
        file_name: "sample.xlsx",
        file_sha256: "sha-sample",
        raw_rows: [{ sap_asset_no: "", name: "Invalid" }],
      });

      const errWorkbook = await generateImportErrorReportWorkbook(
        batch.id,
        batch.file_name,
        batch.rows || []
      );
      expect(errWorkbook.byteLength).toBeGreaterThan(1000);

      const reportData = buildStandardReport(admin, "all-assets", {});
      expect(reportData.rows.length).toBeGreaterThan(0);

      const xlsxBuf = await generateReportExcelBuffer(
        reportData.title,
        reportData.columns,
        reportData.rows,
        { generatedBy: admin.full_name, filterSummary: "Semua" }
      );
      expect(xlsxBuf.byteLength).toBeGreaterThan(1000);

      const pdfBuf = await generateReportPdfBuffer(
        reportData.title,
        reportData.columns,
        reportData.rows,
        { generatedBy: admin.full_name, filterSummary: "Semua" }
      );
      expect(pdfBuf.byteLength).toBeGreaterThan(500);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Bidirectional Search & Reconciliation Scan (FR-MAP-03, Bab 18.7)
  // ---------------------------------------------------------------------------
  describe("Bidirectional Search & Reconciliation Scanner", () => {
    it("searches both Asset -> Equipment Tree and Equipment -> Breadcrumb -> SAP Asset (AC-02, AC-03)", () => {
      const byAsset = searchBidirectional("SAP-001", "ADMIN");
      expect(byAsset.assets.length).toBe(1);
      expect(byAsset.assets[0].attached_equipment_count).toBe(4); // EQ-001, EQ-101, EQ-102, EQ-103

      const bySubEquipment = searchBidirectional("EQ-101", "MAINTENANCE");
      expect(bySubEquipment.equipment.length).toBe(1);
      expect(bySubEquipment.equipment[0].root_asset_no).toBe("SAP-001");
      expect(bySubEquipment.equipment[0].breadcrumb.map((b) => b.code)).toEqual([
        "SAP-001",
        "EQ-001",
        "EQ-101",
      ]);
    });

    it("hides financial acquisition_value from MAINTENANCE role when configured (Table 33, Q-09)", () => {
      const state = getAemsState();
      state.app_settings.security.maintenance_can_view_financial_values = false;

      const maintRes = searchBidirectional("SAP-001", "MAINTENANCE");
      expect(maintRes.assets[0].acquisition_value).toBeNull();

      const accRes = searchBidirectional("SAP-001", "ACCOUNTING");
      expect(accRes.assets[0].acquisition_value).toBe(18500000);
    });

    it("scans and detects unmapped equipment and auto-heals stale root_asset_id cache", () => {
      const state = getAemsState();
      const admin = state.profiles.find((p) => p.role === "ADMIN")!;

      // Artificially corrupt root_asset_id cache on EQ-102
      const eq102 = state.equipment.find((e) => e.id === SEED_IDS.EQ_102)!;
      eq102.root_asset_id = null;

      const findings = runReconciliationScan(admin);
      expect(
        findings.some(
          (f) => f.finding_type === "STALE_ROOT_CACHE" && f.entity_code === "EQ-102"
        )
      ).toBe(true);
      // Verify auto-healed back to SAP-001
      expect(eq102.root_asset_id).toBe(SEED_IDS.ASSET_SAP_001);
      expect(getEquipmentBreadcrumb(SEED_IDS.EQ_102).map((b) => b.code)).toEqual([
        "SAP-001",
        "EQ-001",
        "EQ-102",
      ]);
    });
  });
});
