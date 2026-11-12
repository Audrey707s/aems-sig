import { beforeEach, describe, expect, it } from "vitest";
import {
  getAemsState,
  resetAemsState,
  submitMappingRequest,
  decideMappingRequest,
  manageUserProfile,
} from "@/lib/db/store";
import { saveReference } from "@/lib/db/references";
import { hasPermission, canReviewRequest } from "@/lib/permissions/rbac";
import { SEED_IDS } from "@/lib/db/seed-data";
import type { Profile } from "@/lib/types/domain";
let staff: Profile, manager: Profile, other: Profile, admin: Profile;
beforeEach(() => {
  resetAemsState();
  const s = getAemsState();
  admin = s.profiles.find((p) => p.role === "ADMIN")!;
  staff = s.profiles.find((p) => p.role === "MAINTENANCE")!;
  manager = {
    ...staff,
    id: crypto.randomUUID(),
    email: "manager@test.invalid",
    account_level: "MANAGER",
    manager_id: null,
  };
  other = {
    ...manager,
    id: crypto.randomUUID(),
    role: "ACCOUNTING",
    email: "other@test.invalid",
  };
  s.profiles.push(manager, other);
  staff.manager_id = manager.id;
  staff.account_level = "STAFF";
});
const move = () =>
  submitMappingRequest(staff, {
    items: [
      {
        equipment_id: SEED_IDS.EQ_001,
        action_type: "MOVE",
        to_parent_kind: "ASSET",
        to_parent_id: SEED_IDS.ASSET_SAP_004,
      },
    ],
    reason: "Pemindahan fasilitas untuk pengujian",
  });
describe("Departmental review and organization", () => {
  it("applies LINK immediately even when legacy approval setting is enabled", () => {
    getAemsState().app_settings.hierarchy.require_approval_first_link = true;
    staff.manager_id = null;
    const r = submitMappingRequest(staff, {
      items: [
        {
          equipment_id: SEED_IDS.EQ_900,
          action_type: "LINK",
          to_parent_kind: "ASSET",
          to_parent_id: SEED_IDS.ASSET_SAP_004,
        },
      ],
      reason: "Pengaitan awal langsung",
    });
    expect(r.status).toBe("APPLIED");
    expect(
      getAemsState().equipment.find((e) => e.id === SEED_IDS.EQ_900)
        ?.root_asset_id,
    ).toBe(SEED_IDS.ASSET_SAP_004);
  });
  it("routes Staff MOVE to their own manager and applies after review", () => {
    const r = move();
    expect(r.status).toBe("SUBMITTED");
    expect(r.approver_id).toBe(manager.id);
    expect(canReviewRequest(manager, r)).toBe(true);
    expect(canReviewRequest(other, r)).toBe(false);
    expect(() =>
      decideMappingRequest(other, r.id, "APPROVE", "Tidak sesuai bagian"),
    ).toThrow(/kewenangan/);
    expect(
      decideMappingRequest(manager, r.id, "APPROVE", "Disetujui manajer bagian")
        .status,
    ).toBe("APPLIED");
  });
  it("also requires approval for UNLINK", () => {
    const r = submitMappingRequest(staff, {
      items: [
        {
          equipment_id: SEED_IDS.EQ_101,
          action_type: "UNLINK",
          to_parent_kind: null,
          to_parent_id: null,
        },
      ],
      reason: "Pelepasan komponen untuk perbaikan",
    });
    expect(r.approver_id).toBe(manager.id);
    expect(r.status).toBe("SUBMITTED");
    expect(
      getAemsState().equipment_active_parent.some(
        (p) => p.equipment_id === SEED_IDS.EQ_101,
      ),
    ).toBe(true);
    decideMappingRequest(manager, r.id, "APPROVE", "Disetujui");
    expect(
      getAemsState().equipment_active_parent.some(
        (p) => p.equipment_id === SEED_IDS.EQ_101,
      ),
    ).toBe(false);
  });
  it("does not mutate relationships when no valid manager exists", () => {
    staff.manager_id = other.id;
    const before = structuredClone(getAemsState().equipment_active_parent);
    expect(move).toThrow(/Atasan manajer/);
    expect(getAemsState().equipment_active_parent).toEqual(before);
  });
  it("allows manager direct changes but never self-review", () => {
    staff.account_level = "MANAGER";
    staff.manager_id = null;
    expect(hasPermission(staff, "mapping:approve")).toBe(true);
    const r = move();
    expect(r.status).toBe("APPLIED");
    expect(() =>
      decideMappingRequest(staff, r.id, "REJECT", "Sendiri"),
    ).toThrow(/Maker-Checker/);
  });
  it("assigns staff to active same-department managers only", () => {
    const input = { ...staff, manager_id: other.id };
    expect(() => manageUserProfile(admin, input)).toThrow(/bagian yang sama/);
    expect(() =>
      manageUserProfile(admin, { ...staff, manager_id: staff.id }),
    ).toThrow(/bagian yang sama/);
    expect(
      manageUserProfile(admin, { ...staff, manager_id: manager.id }).manager_id,
    ).toBe(manager.id);
  });
  it("prevents demoting a manager while active reports remain", () => {
    expect(() =>
      manageUserProfile(admin, { ...manager, account_level: "STAFF" }),
    ).toThrow(/penempatan staff/);
  });
  it("prevents staff from assigning roles", () => {
    expect(() =>
      manageUserProfile(staff, { ...staff, account_level: "MANAGER" }),
    ).toThrow(/Administrator/);
  });
});
describe("Reference CRUD", () => {
  it("creates nested locations and edits with a current snapshot", () => {
    const root = saveReference(admin, "locations", {
      code: "PLANT-NEW",
      name: "Pabrik Baru",
      parent_id: null,
      is_active: true,
    });
    const area = saveReference(admin, "locations", {
      code: "AREA-NEW",
      name: "Area Baru",
      parent_id: root.id,
      is_active: true,
    });
    const expected = structuredClone(area);
    saveReference(admin, "locations", { ...area, name: "Mill Baru", expected });
    expect(getAemsState().locations.find((r) => r.id === area.id)?.name).toBe(
      "Mill Baru",
    );
    expect(() =>
      saveReference(admin, "locations", {
        ...expected,
        name: "Tertimpa",
        expected,
      }),
    ).toThrow(/berubah/);
  });
  it("blocks cycles and deleting parents with active children", () => {
    const root = saveReference(admin, "locations", {
      code: "ROOT-NEW",
      name: "Pabrik",
      parent_id: null,
      is_active: true,
    });
    const child = saveReference(admin, "locations", {
      code: "CHILD-NEW",
      name: "Mill",
      parent_id: root.id,
      is_active: true,
    });
    expect(() =>
      saveReference(admin, "locations", {
        ...root,
        parent_id: child.id,
        expected: { ...root },
      }),
    ).toThrow(/siklus/);
    expect(() =>
      saveReference(admin, "locations", {
        ...root,
        is_active: false,
        expected: { ...root },
      }),
    ).toThrow(/masih digunakan/);
  });
  it("retains history on delete and prevents duplicate codes", () => {
    const row = saveReference(admin, "asset_categories", {
      code: "TEST-CAT",
      name: "Kategori Baru",
      parent_id: null,
      is_active: true,
    });
    expect(() =>
      saveReference(admin, "asset_categories", {
        code: "test-cat",
        name: "Duplikat",
        parent_id: null,
        is_active: true,
      }),
    ).toThrow(/Kode sudah/);
    saveReference(admin, "asset_categories", {
      ...row,
      is_active: false,
      expected: { ...row },
    });
    expect(
      getAemsState().asset_categories.find((r) => r.id === row.id)?.is_active,
    ).toBe(false);
    expect(getAemsState().audit_logs[0].action).toBe("DEACTIVATE_REFERENCE");
  });
  it("protects references used by assets and denies staff mutations", () => {
    const state = getAemsState(),
      used = state.locations.find((l) =>
        state.assets.some((a) => a.location_id === l.id),
      )!;
    expect(() =>
      saveReference(admin, "locations", {
        ...used,
        is_active: false,
        expected: { ...used },
      }),
    ).toThrow(/masih digunakan/);
    expect(() =>
      saveReference(staff, "asset_categories", {
        code: "BAD",
        name: "Akses",
        parent_id: null,
        is_active: true,
      }),
    ).toThrow(/Hanya Admin/);
  });
});
