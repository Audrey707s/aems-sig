import { beforeEach, describe, expect, it } from "vitest";
import {
  buildAssetCompositeKey,
  buildEquipmentCompositeKey,
  normalizeKey,
  sanitizeSpreadsheetCell,
} from "@/lib/utils/normalize";
import { canRunImportType, hasPermission } from "@/lib/permissions/rbac";
import {
  addEquipmentSpecItem,
  createAsset,
  createEquipment,
  decideMappingRequest,
  getAemsState,
  getAssetEquipmentTree,
  getEquipmentBreadcrumb,
  promoteSpecItemToEquipment,
  resetAemsState,
  softDeleteAsset,
  softDeleteEquipment,
  submitMappingRequest,
  updateAsset,
  validateAndPreviewMappingItem,
} from "@/lib/db/store";
import { SEED_IDS } from "@/lib/db/seed-data";
import { AemsError } from "@/lib/utils/errors";
import { Profile } from "@/lib/types/domain";

describe("AEMS Unit Tests — Normalization, RBAC, Domain Invariants & Hierarchy", () => {
  beforeEach(() => {
    resetAemsState();
    const state = getAemsState();
    for (const role of ["MAINTENANCE", "ACCOUNTING"] as const) {
      const staff = state.profiles.find((p) => p.role === role)!;
      const manager = {
        ...staff,
        id: crypto.randomUUID(),
        email: `manager-${role}@test.invalid`,
        account_level: "MANAGER" as const,
        manager_id: null,
      };
      state.profiles.push(manager);
      staff.manager_id = manager.id;
      staff.account_level = "STAFF";
    }
  });

  // ---------------------------------------------------------------------------
  // 1. Business Key Normalization & Formula Sanitizer (BR-ID-04, BR-IM-02, Table 72)
  // ---------------------------------------------------------------------------
  describe("Business Key Normalization & Formula Injection Prevention", () => {
    it("normalizes leading/trailing spaces, multiple internal spaces, and lowercase into canonical uppercase", () => {
      expect(normalizeKey("  sap-001 ")).toBe("SAP-001");
      expect(normalizeKey("eq - 101  a")).toBe("EQ-101A");
      expect(normalizeKey("1000")).toBe("1000");
    });

    it("supports optional leading-zero numeric padding when configured (A-01 / Q-01)", () => {
      expect(normalizeKey("12345", { padNumeric: true, padLength: 12 })).toBe(
        "000000012345",
      );
      expect(normalizeKey("SAP-001", { padNumeric: true, padLength: 12 })).toBe(
        "SAP-001",
      );
    });

    it("builds deterministic composite keys for Asset and Equipment", () => {
      expect(buildAssetCompositeKey(" 1000 ", " sap-001 ", "0000")).toBe(
        "1000::SAP-001::0000",
      );
      expect(buildEquipmentCompositeKey(" cmms ", " eq-101 ")).toBe(
        "CMMS::EQ-101",
      );
    });

    it("neutralizes spreadsheet formula injection prefixes (=, +, -, @)", () => {
      expect(sanitizeSpreadsheetCell("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
      expect(sanitizeSpreadsheetCell("+CMD|' /C calc'!A0")).toBe(
        "'+CMD|' /C calc'!A0",
      );
      expect(sanitizeSpreadsheetCell("-100+200")).toBe("'-100+200");
      expect(sanitizeSpreadsheetCell('@HYPERLINK("http://evil")')).toBe(
        '\'@HYPERLINK("http://evil")',
      );
      expect(sanitizeSpreadsheetCell("Genset Caterpillar")).toBe(
        "Genset Caterpillar",
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Role-Based Access Control (RBAC) Matrix (Bab 7.1, 7.2, 20.2)
  // ---------------------------------------------------------------------------
  describe("RBAC Permission Matrix (3 Fixed Roles + Inactive/Unassigned)", () => {
    it("enforces Accounting permissions: asset write & asset/mapping import allowed, equipment write & approve denied", () => {
      const state = getAemsState();
      const accounting = state.profiles.find((p) => p.role === "ACCOUNTING")!;

      expect(hasPermission(accounting, "asset:write")).toBe(true);
      expect(hasPermission(accounting, "equipment:write")).toBe(false);
      expect(hasPermission(accounting, "mapping:request")).toBe(true);
      expect(hasPermission(accounting, "mapping:approve")).toBe(false);
      expect(canRunImportType(accounting, "ASSET_MASTER")).toBe(true);
      expect(canRunImportType(accounting, "EQUIPMENT_MASTER")).toBe(false);
      expect(canRunImportType(accounting, "MAPPING")).toBe(true);
    });

    it("enforces Maintenance permissions: equipment write & equipment/mapping import allowed, asset write & approve denied", () => {
      const state = getAemsState();
      const maintenance = state.profiles.find((p) => p.role === "MAINTENANCE")!;

      expect(hasPermission(maintenance, "asset:write")).toBe(false);
      expect(hasPermission(maintenance, "equipment:write")).toBe(true);
      expect(hasPermission(maintenance, "mapping:request")).toBe(true);
      expect(hasPermission(maintenance, "mapping:approve")).toBe(false);
      expect(canRunImportType(maintenance, "ASSET_MASTER")).toBe(false);
      expect(canRunImportType(maintenance, "EQUIPMENT_MASTER")).toBe(true);
      expect(canRunImportType(maintenance, "MAPPING")).toBe(true);
    });

    it("enforces Administrator full permissions across all modules", () => {
      const state = getAemsState();
      const admin = state.profiles.find((p) => p.role === "ADMIN")!;

      expect(hasPermission(admin, "asset:write")).toBe(true);
      expect(hasPermission(admin, "equipment:write")).toBe(true);
      expect(hasPermission(admin, "mapping:approve")).toBe(true);
      expect(hasPermission(admin, "users:manage")).toBe(true);
      expect(canRunImportType(admin, "ASSET_MASTER")).toBe(true);
      expect(canRunImportType(admin, "EQUIPMENT_MASTER")).toBe(true);
      expect(canRunImportType(admin, "MAPPING")).toBe(true);
    });

    it("denies all permissions to inactive users (BR-AC-05) or users without an assigned role (BR-AC-06)", () => {
      const inactiveAdmin: Profile = {
        id: "u-inactive",
        email: "inactive@perusahaan.co.id",
        full_name: "Inactive User",
        role: "ADMIN",
        is_active: false,
        department: "IT",
        last_login_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const unassignedUser: Profile = {
        ...inactiveAdmin,
        id: "u-norole",
        role: null,
        is_active: true,
      };

      expect(hasPermission(inactiveAdmin, "asset:read")).toBe(false);
      expect(hasPermission(inactiveAdmin, "asset:write")).toBe(false);
      expect(hasPermission(unassignedUser, "asset:read")).toBe(false);
      expect(hasPermission(unassignedUser, "equipment:read")).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Master Data Asset & Equipment CRUD, Optimistic Concurrency & Soft Delete
  // ---------------------------------------------------------------------------
  describe("Master Data Invariants, Optimistic Concurrency & Soft Delete", () => {
    it("rejects duplicate normalized SAP Asset No with DUPLICATE_KEY (BR-ID-02)", () => {
      const state = getAemsState();
      const accounting = state.profiles.find((p) => p.role === "ACCOUNTING")!;

      expect(() =>
        createAsset(accounting, {
          sap_asset_no: "  sap-001 ",
          name: "Duplikat Genset",
        }),
      ).toThrowError(AemsError);

      try {
        createAsset(accounting, {
          sap_asset_no: "sap-001",
          name: "Duplikat Genset",
        });
      } catch (err) {
        expect((err as AemsError).code).toBe("DUPLICATE_KEY");
        expect((err as AemsError).httpStatus).toBe(409);
      }
    });

    it("creates Equipment without Asset (FR-EQP-02, BR-EQ-01) and initializes root_asset_id = null", () => {
      const state = getAemsState();
      const maintenance = state.profiles.find((p) => p.role === "MAINTENANCE")!;

      const eq = createEquipment(maintenance, {
        equipment_no: "EQ-777",
        kind: "WHOLE_UNIT",
        name: "Pompa Transfer Baru",
      });

      expect(eq.root_asset_id).toBeNull();
      expect(eq.depth).toBe(0);
      expect(eq.kind).toBe("WHOLE_UNIT");
    });

    it("rejects business key changes by non-Admin (BR-ID-06) and allows Admin with reason", () => {
      const state = getAemsState();
      const accounting = state.profiles.find((p) => p.role === "ACCOUNTING")!;
      const admin = state.profiles.find((p) => p.role === "ADMIN")!;

      expect(() =>
        updateAsset(accounting, SEED_IDS.ASSET_SAP_004, {
          sap_asset_no: "SAP-004-RENAMED",
          row_version: 1,
        }),
      ).toThrow(/hanya diizinkan untuk Administrator/i);

      const updated = updateAsset(admin, SEED_IDS.ASSET_SAP_004, {
        sap_asset_no: "SAP-004-NEW",
        row_version: 1,
        change_reason: "Koreksi penomoran SAP FI-AA",
      });
      expect(updated.sap_asset_no).toBe("SAP-004-NEW");
      expect(updated.asset_key_norm).toBe("SAP-004-NEW");
    });

    it("enforces optimistic concurrency on row_version and returns VERSION_CONFLICT with field diff (BR-DL-05, AC-11)", () => {
      const state = getAemsState();
      const accounting = state.profiles.find((p) => p.role === "ACCOUNTING")!;

      // User A updates SAP-004 (row_version 1 -> 2)
      updateAsset(accounting, SEED_IDS.ASSET_SAP_004, {
        name: "Compressor Air Unit — Revisi User A",
        row_version: 1,
      });

      // User B tries to save with stale row_version = 1
      try {
        updateAsset(accounting, SEED_IDS.ASSET_SAP_004, {
          name: "Compressor Air Unit — Revisi User B",
          row_version: 1,
        });
        expect.fail("Should have thrown VERSION_CONFLICT");
      } catch (err) {
        const aemsErr = err as AemsError;
        expect(aemsErr.code).toBe("VERSION_CONFLICT");
        expect(aemsErr.httpStatus).toBe(409);
        expect(aemsErr.details?.current_row_version).toBe(2);
        expect(aemsErr.details?.diff).toBeDefined();
      }
    });

    it("blocks soft-delete of Asset that still has active Equipment (BR-DL-02, AC-12)", () => {
      const state = getAemsState();
      const accounting = state.profiles.find((p) => p.role === "ACCOUNTING")!;

      expect(() =>
        softDeleteAsset(accounting, SEED_IDS.ASSET_SAP_001, "Uji hapus"),
      ).toThrow(/masih memiliki .* equipment aktif/i);
    });

    it("blocks soft-delete of Parent Equipment that still has active Child Equipment (BR-DL-03)", () => {
      const state = getAemsState();
      const maintenance = state.profiles.find((p) => p.role === "MAINTENANCE")!;

      expect(() =>
        softDeleteEquipment(maintenance, SEED_IDS.EQ_001, "Uji hapus parent"),
      ).toThrow(/masih memiliki .* sub-equipment aktif/i);
    });

    it("deactivates leaf Equipment, closes active relationship, and preserves mapping history (BR-DL-04)", () => {
      const state = getAemsState();
      const maintenance = state.profiles.find((p) => p.role === "MAINTENANCE")!;

      // EQ-101 is a leaf child under EQ-001
      const retired = softDeleteEquipment(
        maintenance,
        SEED_IDS.EQ_101,
        "Motor dinamo rusak total dan dipensiunkan",
      );
      expect(retired.status).toBe("INACTIVE");
      expect(retired.deleted_at).not.toBeNull();
      expect(retired.root_asset_id).toBeNull();

      // Active parent slot removed
      const activeSlot = state.equipment_active_parent.find(
        (p) => p.equipment_id === SEED_IDS.EQ_101,
      );
      expect(activeSlot).toBeUndefined();

      // Historical relationship preserved with valid_to != null and end_reason = RETIRE
      const closedRel = state.equipment_relationships.find(
        (r) => r.child_equipment_id === SEED_IDS.EQ_101,
      );
      expect(closedRel?.valid_to).not.toBeNull();
      expect(closedRel?.end_reason).toBe("RETIRE");
    });

    it("creates unnumbered component specification and promotes it to official numbered Equipment (BR-ID-07, FR-EQP-08)", () => {
      const state = getAemsState();
      const maintenance = state.profiles.find((p) => p.role === "MAINTENANCE")!;

      const spec = addEquipmentSpecItem(maintenance, {
        equipment_id: SEED_IDS.EQ_001,
        spec_name: "Fuel Injector Assy",
        spec_value: "Caterpillar 6-Nozzle High Pressure",
        spec_group: "Fuel System",
        serial_no: "SN-INJ-889",
      });
      expect(spec.promoted_equipment_id).toBeNull();

      const promoted = promoteSpecItemToEquipment(maintenance, {
        spec_item_id: spec.id,
        equipment_no: "EQ-109",
        kind: "COMPONENT",
        reason: "Mulai dilacak terpisah sebagai komponen bernomor",
      });

      expect(promoted.equipment.equipment_no).toBe("EQ-109");
      expect(promoted.specItem.promoted_equipment_id).toBe(
        promoted.equipment.id,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Hierarchy, Cycle Detection, Subtree Move, Maker-Checker & Temporal Reconstruction
  // ---------------------------------------------------------------------------
  describe("Hierarchy Engine, Cycle Prevention (AE001..AE012) & Maker-Checker", () => {
    it("rejects self-parenting with AE001 (BR-HR-03, AC-04)", () => {
      expect(() =>
        validateAndPreviewMappingItem({
          equipment_id: SEED_IDS.EQ_001,
          action_type: "MOVE",
          to_parent_kind: "EQUIPMENT",
          to_parent_id: SEED_IDS.EQ_001,
        }),
      ).toThrow(/AE001/);
    });

    it("rejects indirect cycle (parent moved under its own child/descendant) with AE001 (BR-HR-04, AC-04)", () => {
      // EQ-101 is a child of EQ-001. Trying to make EQ-001 a child of EQ-101 must fail with AE001.
      try {
        validateAndPreviewMappingItem({
          equipment_id: SEED_IDS.EQ_001,
          action_type: "MOVE",
          to_parent_kind: "EQUIPMENT",
          to_parent_id: SEED_IDS.EQ_101,
        });
        expect.fail("Should have thrown AE001");
      } catch (err) {
        expect((err as AemsError).code).toBe("AE001");
      }
    });

    it("rejects hierarchy exceeding max_depth with AE002 (BR-HR-05)", () => {
      const state = getAemsState();
      state.app_settings.hierarchy.max_depth = 1; // Only depth 1 allowed

      try {
        // EQ-900 (unmapped) linking under EQ-001 (which is at depth 1) would place EQ-900 at depth 2 > 1
        validateAndPreviewMappingItem({
          equipment_id: SEED_IDS.EQ_900,
          action_type: "LINK",
          to_parent_kind: "EQUIPMENT",
          to_parent_id: SEED_IDS.EQ_001,
        });
        expect.fail("Should have thrown AE002");
      } catch (err) {
        expect((err as AemsError).code).toBe("AE002");
      }
    });

    it("rejects second active parent on LINK without MOVE with AE003 (BR-HR-02, AC-05)", () => {
      try {
        validateAndPreviewMappingItem({
          equipment_id: SEED_IDS.EQ_001,
          action_type: "LINK",
          to_parent_kind: "ASSET",
          to_parent_id: SEED_IDS.ASSET_SAP_002,
        });
        expect.fail("Should have thrown AE003");
      } catch (err) {
        expect((err as AemsError).code).toBe("AE003");
      }
    });

    it("rejects duplicate open mapping request on the same equipment with AE004 (BR-MP-07)", () => {
      // EQ-915 already has open request CR-0012 in seed data
      try {
        validateAndPreviewMappingItem({
          equipment_id: SEED_IDS.EQ_915,
          action_type: "LINK",
          to_parent_kind: "ASSET",
          to_parent_id: SEED_IDS.ASSET_SAP_004,
        });
        expect.fail("Should have thrown AE004");
      } catch (err) {
        expect((err as AemsError).code).toBe("AE004");
      }
    });

    it("moves parent equipment along with all its descendants and updates root_asset_id cache atomically (BR-HR-08, AC-06)", () => {
      const state = getAemsState();
      const maintenance = state.profiles.find((p) => p.role === "MAINTENANCE")!;
      const admin = state.profiles.find((p) => p.role === "ADMIN")!;

      // Move EQ-001 (along with children EQ-101, EQ-102, EQ-103) from SAP-001 to SAP-004
      const req = submitMappingRequest(maintenance, {
        items: [
          {
            equipment_id: SEED_IDS.EQ_001,
            action_type: "MOVE",
            to_parent_kind: "ASSET",
            to_parent_id: SEED_IDS.ASSET_SAP_004,
          },
        ],
        reason:
          "Relokasi unit genset utama beserta seluruh sub-equipment ke fasilitas SAP-004",
      });

      expect(req.status).toBe("SUBMITTED");
      expect(req.items[0].descendant_count).toBe(3);

      // Admin approves
      const approved = decideMappingRequest(
        admin,
        req.id,
        "APPROVE",
        "Disetujui sesuai berita acara relokasi",
      );
      expect(approved.status).toBe("APPLIED");

      // Check EQ-001 and all 3 children now have root_asset_id = SAP-004
      for (const id of [
        SEED_IDS.EQ_001,
        SEED_IDS.EQ_101,
        SEED_IDS.EQ_102,
        SEED_IDS.EQ_103,
      ]) {
        const eq = state.equipment.find((e) => e.id === id)!;
        expect(eq.root_asset_id).toBe(SEED_IDS.ASSET_SAP_004);
      }

      // Breadcrumb of EQ-101 now starts with SAP-004 -> EQ-001 -> EQ-101
      const bc = getEquipmentBreadcrumb(SEED_IDS.EQ_101);
      expect(bc.map((b) => b.code)).toEqual(["SAP-004", "EQ-001", "EQ-101"]);
    });

    it("enforces Maker-Checker: requester cannot approve their own mapping request when maker_checker is active (A-04 / BR-MP-02)", () => {
      const state = getAemsState();
      const admin = state.profiles.find((p) => p.role === "ADMIN")!;

      // Admin submits without immediate apply on unmapped EQ-900
      const req = submitMappingRequest(admin, {
        items: [
          {
            equipment_id: SEED_IDS.EQ_900,
            action_type: "LINK",
            to_parent_kind: "ASSET",
            to_parent_id: SEED_IDS.ASSET_SAP_004,
          },
        ],
        reason: "Uji Maker-Checker",
        apply_immediately: false,
      });

      expect(() =>
        decideMappingRequest(admin, req.id, "APPROVE", "Approve sendiri"),
      ).toThrow(/Maker-Checker/i);
    });

    it("marks request as FAILED_VALIDATION if hierarchy changes between submission and approval (Gambar 11 & 12)", () => {
      const state = getAemsState();
      const accounting = state.profiles.find((p) => p.role === "ACCOUNTING")!;
      const admin = state.profiles.find((p) => p.role === "ADMIN")!;

      // Accounting submits a request to LINK unmapped EQ-900 to SAP-004
      const req = submitMappingRequest(accounting, {
        items: [
          {
            equipment_id: SEED_IDS.EQ_001,
            action_type: "MOVE",
            to_parent_kind: "ASSET",
            to_parent_id: SEED_IDS.ASSET_SAP_004,
          },
        ],
        reason: "Pindahkan EQ-001 ke SAP-004",
      });

      // Before Admin approves req, SAP-004 is soft-deleted!
      softDeleteAsset(
        accounting,
        SEED_IDS.ASSET_SAP_004,
        "Aset ditutup sebelum approval",
      );

      // Now Admin attempts to approve req -> target asset is inactive (AE011) -> status transitions to FAILED_VALIDATION
      expect(() =>
        decideMappingRequest(admin, req.id, "APPROVE", "Coba setujui"),
      ).toThrow(/AE011/);

      const updatedReq = state.mapping_change_requests.find(
        (r) => r.id === req.id,
      )!;
      expect(updatedReq.status).toBe("FAILED_VALIDATION");
    });

    it("reconstructs historical hierarchy accurately at any past timestamp asOfDate (Bab 14.8, FR-MAP-09)", () => {
      // In seed data (Gambar 23):
      // EQ-203 was under EQ-201 (under EQ-002 / SAP-002) from 2026-09-01 to 2026-10-12,
      // then moved to EQ-202 (under EQ-002 / SAP-002) on 2026-10-12T09:00:00.000Z.
      const treeSept2026 = getAssetEquipmentTree(
        SEED_IDS.ASSET_SAP_002,
        "2026-09-15T00:00:00.000Z",
      );
      const eq002Sept = treeSept2026.find((n) => n.equipment_no === "EQ-002")!;
      const eq201Sept = eq002Sept.children.find(
        (n) => n.equipment_no === "EQ-201",
      )!;
      const eq202Sept = eq002Sept.children.find(
        (n) => n.equipment_no === "EQ-202",
      )!;
      expect(eq201Sept.children.map((c) => c.equipment_no)).toContain("EQ-203");
      expect(eq202Sept.children.map((c) => c.equipment_no)).not.toContain(
        "EQ-203",
      );

      const treeNov2026 = getAssetEquipmentTree(
        SEED_IDS.ASSET_SAP_002,
        "2026-11-01T00:00:00.000Z",
      );
      const eq002Nov = treeNov2026.find((n) => n.equipment_no === "EQ-002")!;
      const eq201Nov = eq002Nov.children.find(
        (n) => n.equipment_no === "EQ-201",
      )!;
      const eq202Nov = eq002Nov.children.find(
        (n) => n.equipment_no === "EQ-202",
      )!;
      expect(eq201Nov.children.map((c) => c.equipment_no)).not.toContain(
        "EQ-203",
      );
      expect(eq202Nov.children.map((c) => c.equipment_no)).toContain("EQ-203");
    });
  });
});
