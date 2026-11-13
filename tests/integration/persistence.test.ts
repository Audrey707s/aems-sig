import { saveReference } from "@/lib/db/references";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createInitialSeedState } from "@/lib/db/seed-data";
import { aemsRequestState } from "@/lib/db/context";
import {
  submitMappingRequest,
  decideMappingRequest,
  createAndValidateImportBatch,
  commitImportBatch,
  updateEquipment,
  updateAsset,
  createAsset,
  getAemsState,
  resetAemsState,
} from "@/lib/db/store";
import {
  databaseDiff,
  flattenDatabase,
  hydrateDatabase,
  runPersistedOperation,
  type DatabaseRows,
  type PersistenceDriver,
  type DatabaseChanges,
} from "@/lib/db/persistence";

/** Independent clients share only this fake durable database, never process state. */
class FakeDatabase {
  tables = flattenDatabase(createInitialSeedState());
  revision = 0;
  failCommit = false;
  client(): PersistenceDriver {
    return {
      read: async () =>
        structuredClone({ tables: this.tables, revision: this.revision }),
      commit: async (expected, changes) => {
        if (this.failCommit) throw new Error("Database offline");
        if (expected !== this.revision) throw new Error("Conflict");
        const next = structuredClone(this.tables);
        for (const [name, change] of Object.entries(changes)) {
          const table = name as keyof DatabaseRows;
          const key =
            table === "app_settings"
              ? "key"
              : table === "equipment_active_parent"
                ? "equipment_id"
                : "id";
          next[table] = next[table].filter(
            (r) => !change.remove.includes(String(r[key])),
          );
          for (const row of change.upsert) {
            const index = next[table].findIndex((r) => r[key] === row[key]);
            if (index < 0) next[table].push(row);
            else next[table][index] = row;
          }
        }
        this.tables = next;
        this.revision++;
      },
    };
  }
}

describe("Persistent request repository", () => {
  let db: FakeDatabase;
  beforeEach(() => {
    delete process.env.AEMS_STORAGE_MODE;
    resetAemsState();
    db = new FakeDatabase();
  });
  afterEach(() => {
    delete process.env.AEMS_STORAGE_MODE;
  });

  it("keeps a created asset across unrelated request clients and process-store resets", async () => {
    let createdId = "";
    await runPersistedOperation(db.client(), async () => {
      const actor = getAemsState().profiles.find((p) => p.role === "ADMIN")!;
      createdId = createAsset(actor, {
        sap_asset_no: "PERSIST-TEST",
        name: "Persists across cold starts",
      }).id;
      return Response.json({ ok: true }, { status: 201 });
    });
    resetAemsState();
    await runPersistedOperation(db.client(), async () => {
      expect(getAemsState().assets.find((a) => a.id === createdId)?.name).toBe(
        "Persists across cold starts",
      );
      return Response.json({ ok: true });
    });
    expect(db.revision).toBe(1);
  });

  it("writes the business mutation and its audit record in one commit", async () => {
    let captured: DatabaseChanges = {};
    const driver = db.client();
    await runPersistedOperation(
      {
        ...driver,
        commit: async (rev, changes) => {
          captured = changes;
          await driver.commit(rev, changes);
        },
      },
      async () => {
        createAsset(getAemsState().profiles.find((p) => p.role === "ADMIN")!, {
          sap_asset_no: "ATOMIC-TEST",
          name: "Atomic asset",
        });
        return Response.json({ ok: true });
      },
    );
    expect(captured.assets?.upsert).toHaveLength(1);
    expect(captured.audit_logs?.upsert).toHaveLength(1);
  });

  it("does not persist partial state when a handler returns a failure response", async () => {
    await runPersistedOperation(db.client(), async () => {
      getAemsState().assets[0].name = "Must roll back";
      return Response.json({ error: "validation" }, { status: 400 });
    });
    expect(db.tables.assets[0].name).not.toBe("Must roll back");
    expect(db.revision).toBe(0);
  });

  it("does not report success when the database commit fails", async () => {
    db.failCommit = true;
    await expect(
      runPersistedOperation(db.client(), async () => {
        getAemsState().assets[0].name = "Never saved";
        return Response.json({ ok: true });
      }),
    ).rejects.toThrow("Database offline");
    expect(db.tables.assets[0].name).not.toBe("Never saved");
  });

  it("rejects stale writers instead of silently overwriting a concurrent update", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const slow = runPersistedOperation(db.client(), async () => {
      getAemsState().assets[0].name = "Stale writer";
      await gate;
      return Response.json({ ok: true });
    });
    await runPersistedOperation(db.client(), async () => {
      getAemsState().assets[0].name = "Winning writer";
      return Response.json({ ok: true });
    });
    release();
    await expect(slow).rejects.toThrow("Conflict");
    expect(db.tables.assets[0].name).toBe("Winning writer");
  });

  it("isolates two request snapshots while asynchronous work overlaps", async () => {
    const states = [createInitialSeedState(), createInitialSeedState()];
    states[0].assets[0].name = "Request A";
    states[1].assets[0].name = "Request B";
    const names = await Promise.all(
      states.map((state) =>
        aemsRequestState.run({ state }, async () => {
          await Promise.resolve();
          return getAemsState().assets[0].name;
        }),
      ),
    );
    expect(names).toEqual(["Request A", "Request B"]);
  });

  it("never substitutes seed data when a persistent request context is missing", () => {
    process.env.AEMS_STORAGE_MODE = "supabase";
    expect(() => getAemsState()).toThrow();
  });

  it("does not fill an empty database with sample assets", () => {
    const tables = flattenDatabase(createInitialSeedState());
    tables.assets = [];
    tables.equipment = [];
    expect(hydrateDatabase(tables).assets).toEqual([]);
    expect(hydrateDatabase(tables).equipment).toEqual([]);
  });

  it("persists mapping requests, approval, hierarchy, and history across independent clients", async () => {
    let requestId = "";
    await runPersistedOperation(db.client(), async () => {
      const actor = getAemsState().profiles.find(
        (p) => p.role === "MAINTENANCE",
      )!;
      const manager = {
        ...actor,
        id: crypto.randomUUID(),
        email: "manager@test.invalid",
        account_level: "MANAGER" as const,
        manager_id: null,
      };
      getAemsState().profiles.push(manager);
      actor.manager_id = manager.id;
      actor.account_level = "STAFF";
      requestId = submitMappingRequest(actor, {
        items: [
          {
            equipment_id: "50000000-0000-4000-8000-000000000001",
            action_type: "MOVE",
            to_parent_kind: "ASSET",
            to_parent_id: "40000000-0000-4000-8000-000000000004",
          },
        ],
        reason: "Uji mapping persisten",
      }).id;
      return Response.json({ ok: true });
    });
    await runPersistedOperation(db.client(), async () => {
      const actor = getAemsState().profiles.find((p) => p.role === "ADMIN")!;
      decideMappingRequest(
        actor,
        requestId,
        "APPROVE",
        "Persetujuan persistensi",
      );
      return Response.json({ ok: true });
    });
    await runPersistedOperation(db.client(), async () => {
      const state = getAemsState();
      expect(
        state.mapping_change_requests.find((r) => r.id === requestId)?.status,
      ).toBe("APPLIED");
      expect(
        state.equipment.find((e) => e.equipment_no === "EQ-001")?.root_asset_id,
      ).toBe("40000000-0000-4000-8000-000000000004");
      expect(
        state.mapping_history.some((h) => h.change_request_id === requestId),
      ).toBe(true);
      return Response.json({ ok: true });
    });
  });

  it("persists import staging rows, committed master data, and batch results across clients", async () => {
    let batchId = "";
    await runPersistedOperation(db.client(), async () => {
      const actor = getAemsState().profiles.find(
        (p) => p.role === "ACCOUNTING",
      )!;
      batchId = createAndValidateImportBatch(actor, {
        import_type: "ASSET_MASTER",
        file_name: "persistent-test.xlsx",
        file_sha256: "persistence-test",
        default_action: "SKIP",
        commit_mode: "ATOMIC",
        raw_rows: [
          { sap_asset_no: "UAT-IMPORT-PERSIST", name: "Import persistensi" },
        ],
      }).id;
      return Response.json({ ok: true });
    });
    await runPersistedOperation(db.client(), async () => {
      const actor = getAemsState().profiles.find(
        (p) => p.role === "ACCOUNTING",
      )!;
      expect(
        getAemsState().import_batches.find((b) => b.id === batchId)?.rows,
      ).toHaveLength(1);
      commitImportBatch(actor, batchId);
      return Response.json({ ok: true });
    });
    await runPersistedOperation(db.client(), async () => {
      expect(
        getAemsState().assets.some(
          (a) => a.sap_asset_no === "UAT-IMPORT-PERSIST",
        ),
      ).toBe(true);
      expect(
        getAemsState().import_batches.find((b) => b.id === batchId)?.status,
      ).toBe("COMPLETED");
      return Response.json({ ok: true });
    });
  });

  it("persists edited condition, asset attributes and audit in a new request", async () => {
    await runPersistedOperation(db.client(), async () => {
      const state = getAemsState(),
        admin = state.profiles.find((p) => p.role === "ADMIN")!;
      updateEquipment(admin, state.equipment[0].id, {
        condition: "DALAM_PERBAIKAN",
        manufacturer: "Edited maker",
        row_version: state.equipment[0].row_version,
      });
      updateAsset(admin, state.assets[0].id, {
        attributes: { physical_condition: "RUSAK_RINGAN" },
        row_version: state.assets[0].row_version,
      });
      return Response.json({ ok: true });
    });
    resetAemsState();
    await runPersistedOperation(db.client(), async () => {
      const state = getAemsState();
      expect(state.equipment[0].condition).toBe("DALAM_PERBAIKAN");
      expect(state.equipment[0].manufacturer).toBe("Edited maker");
      expect(state.assets[0].attributes.physical_condition).toBe(
        "RUSAK_RINGAN",
      );
      expect(
        state.audit_logs.some(
          (a) =>
            a.action === "UPDATE" && a.changed_fields.includes("condition"),
        ),
      ).toBe(true);
      return Response.json({ ok: true });
    });
  });

  it("persists nested references and deactivation across request clients", async()=>{
    let id="";
    await runPersistedOperation(db.client(),async()=>{
      const admin=getAemsState().profiles.find(p=>p.role==="ADMIN")!;
      const parent=saveReference(admin,"locations",{code:"PERSIST-PLANT",name:"Pabrik Persisten",parent_id:null,is_active:true});
      id=saveReference(admin,"locations",{code:"PERSIST-MILL",name:"Mill Persisten",parent_id:parent.id,is_active:true}).id;
      return Response.json({ok:true});
    });
    resetAemsState();
    await runPersistedOperation(db.client(),async()=>{
      const state=getAemsState(),row=state.locations.find(r=>r.id===id)!;
      expect(state.locations.find(r=>r.id===row.parent_id)?.code).toBe("PERSIST-PLANT");
      saveReference(state.profiles.find(p=>p.role==="ADMIN")!,"locations",{...row,is_active:false,expected:{...row}});
      return Response.json({ok:true});
    });
    await runPersistedOperation(db.client(),async()=>{expect(getAemsState().locations.find(r=>r.id===id)?.is_active).toBe(false);return Response.json({ok:true});});
  });

  it("forbids removal of history and master data", () => {
    const before = flattenDatabase(createInitialSeedState());
    const after = structuredClone(before);
    after.audit_logs = [];
    expect(() => databaseDiff(before, after)).toThrow("Data dan riwayat");
  });
});
