import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types/domain";
import type { AemsDatabaseState } from "./seed-data";
import { aemsRequestState } from "./context";
import { AemsError, formatErrorResponse } from "@/lib/utils/errors";
import { getCurrentProfile } from "@/lib/auth/session";

export const PERSISTED_TABLES = [
  "profiles", "asset_categories", "equipment_categories", "locations", "assets", "equipment",
  "import_batches", "mapping_change_requests", "asset_equipment_mappings", "equipment_relationships",
  "equipment_active_parent", "equipment_spec_items", "mapping_change_items", "import_rows",
  "mapping_history", "audit_logs", "reconciliation_findings", "app_settings",
] as const;
type TableName = typeof PERSISTED_TABLES[number];
type Row = Record<string, unknown>;
export type DatabaseRows = Record<TableName, Row[]>;
export type DatabaseChanges = Partial<Record<TableName, { upsert: Row[]; remove: string[] }>>;
export interface DatabaseSnapshot { revision: number; tables: DatabaseRows }
export interface PersistenceDriver {
  read(): Promise<DatabaseSnapshot>;
  commit(revision: number, changes: DatabaseChanges): Promise<void>;
}
const keyFor = (table: TableName) => table === "app_settings" ? "key" : table === "equipment_active_parent" ? "equipment_id" : "id";

/** Reconstruct domain relationships from normalized tables, without any seed fallback. */
export function hydrateDatabase(tables: DatabaseRows): AemsDatabaseState {
  for (const table of PERSISTED_TABLES) {
    if (!Array.isArray(tables[table])) throw new AemsError("INTERNAL_ERROR", "Struktur database belum lengkap.", 503);
  }
  const profiles = tables.profiles;
  const person = (id: unknown) => profiles.find(p => p.id === id);
  const assets = tables.assets;
  const equipment: Row[] = tables.equipment.map(e => {
    const parent = tables.equipment_active_parent.find(p => p.equipment_id === e.id);
    return {...e, active_parent_kind: parent?.parent_kind ?? null, active_parent_id: parent?.parent_id ?? null};
  });
  const parentNo = (kind: unknown, id: unknown) => kind === "ASSET" ? assets.find(a => a.id === id)?.sap_asset_no ?? null : equipment.find(e => e.id === id)?.equipment_no ?? null;
  const assetNo = (id: unknown) => assets.find(a => a.id === id)?.sap_asset_no ?? null;
  const settings = Object.fromEntries(tables.app_settings.map(r => [r.key, r.value]));
  if (!settings.hierarchy || !settings.normalization || !settings.imports || !settings.security) {
    throw new AemsError("INTERNAL_ERROR", "Pengaturan database belum lengkap.", 503);
  }
  const requests: Row[] = tables.mapping_change_requests.map(r => ({...r,
    requester_name: r.requester_name ?? person(r.requested_by)?.full_name ?? "Pengguna",
    requester_role: r.requester_role ?? person(r.requested_by)?.role,
    reviewer_name: r.reviewer_name ?? person(r.reviewed_by)?.full_name ?? null,
    items: tables.mapping_change_items.filter(i => i.change_request_id === r.id).map(i => ({...i,
      equipment_no: i.equipment_no ?? equipment.find(e => e.id === i.equipment_id)?.equipment_no,
      equipment_name: i.equipment_name ?? equipment.find(e => e.id === i.equipment_id)?.name,
      from_parent_no: i.from_parent_no ?? parentNo(i.from_parent_kind, i.from_parent_id),
      to_parent_no: i.to_parent_no ?? parentNo(i.to_parent_kind, i.to_parent_id),
      from_root_asset_no: i.from_root_asset_no ?? assetNo(i.from_root_asset_id),
      to_root_asset_no: i.to_root_asset_no ?? assetNo(i.to_root_asset_id),
    })),
  }));
  return {
    profiles: profiles as unknown as AemsDatabaseState["profiles"],
    asset_categories: tables.asset_categories,
    equipment_categories: tables.equipment_categories,
    locations: tables.locations,
    assets, equipment,
    asset_equipment_mappings: tables.asset_equipment_mappings,
    equipment_relationships: tables.equipment_relationships,
    equipment_active_parent: tables.equipment_active_parent,
    equipment_spec_items: tables.equipment_spec_items,
    mapping_change_requests: requests,
    mapping_history: tables.mapping_history.map(h => ({...h,
      equipment_no: h.equipment_no ?? equipment.find(e => e.id === h.equipment_id)?.equipment_no,
      equipment_name: h.equipment_name ?? equipment.find(e => e.id === h.equipment_id)?.name,
      request_code: h.request_code ?? requests.find(r => r.id === h.change_request_id)?.request_code ?? null,
      from_parent_no: h.from_parent_no ?? parentNo(h.from_parent_kind, h.from_parent_id),
      to_parent_no: h.to_parent_no ?? parentNo(h.to_parent_kind, h.to_parent_id),
      from_asset_no: h.from_asset_no ?? assetNo(h.from_asset_id),
      to_asset_no: h.to_asset_no ?? assetNo(h.to_asset_id),
      actor_name: h.actor_name ?? person(h.actor_id)?.full_name ?? "Pengguna",
      approver_name: h.approver_name ?? person(h.approved_by)?.full_name ?? null,
    })),
    import_batches: tables.import_batches.map(b => ({...b,
      uploader_name: b.uploader_name ?? person(b.uploaded_by)?.full_name ?? "Pengguna",
      uploader_role: b.uploader_role ?? person(b.uploaded_by)?.role,
      rows: tables.import_rows.filter(r => r.batch_id === b.id).map(r => ({...r, display_key: r.display_key ?? r.key_norm ?? ""})),
    })),
    audit_logs: tables.audit_logs.map(a => ({...a,
      actor_name: a.actor_name ?? person(a.actor_id)?.full_name ?? "Sistem",
      entity_code: a.entity_code ?? (a.entity_type === "ASSET" ? assetNo(a.entity_id) : equipment.find(e => e.id === a.entity_id)?.equipment_no) ?? null,
    })),
    reconciliation_findings: tables.reconciliation_findings.map(f => ({...f,
      entity_name: f.entity_name ?? (f.entity_type === "ASSET" ? assets.find(a => a.id === f.entity_id)?.name : equipment.find(e => e.id === f.entity_id)?.name) ?? f.entity_code,
      resolver_name: f.resolver_name ?? person(f.resolved_by)?.full_name ?? null,
    })),
    app_settings: settings,
  } as unknown as AemsDatabaseState;
}

/** Flatten only the domain fields; database-generated identities/keys stay in PostgreSQL. */
export function flattenDatabase(state: AemsDatabaseState): DatabaseRows {
  const rows: Record<string, unknown> = { ...state };
  rows.app_settings = Object.entries(state.app_settings).map(([key, value]) => ({key, value}));
  rows.mapping_change_items = state.mapping_change_requests.flatMap(r => r.items);
  rows.mapping_change_requests = state.mapping_change_requests.map(({items: _items, ...r}) => { void _items; return r; });
  rows.import_rows = state.import_batches.flatMap(b => b.rows || []);
  rows.import_batches = state.import_batches.map(({rows: _rows, ...b}) => { void _rows; return b; });
  rows.assets = state.assets.map(({asset_key_norm: _norm, ...a}) => { void _norm; return a; });
  rows.equipment = state.equipment.map(({equipment_key_norm: _norm, active_parent_kind: _kind, active_parent_id: _parent, ...e}) => { void _norm; void _kind; void _parent; return e; });
  return rows as DatabaseRows;
}

export function databaseDiff(before: DatabaseRows, after: DatabaseRows): DatabaseChanges {
  const changes: DatabaseChanges = {};
  for (const table of PERSISTED_TABLES) {
    const key = keyFor(table);
    const old = new Map(before[table].map(r => [String(r[key]), JSON.stringify(r)]));
    const current = new Set(after[table].map(r => String(r[key])));
    const upsert = after[table].filter(r => old.get(String(r[key])) !== JSON.stringify(r));
    const remove = before[table].filter(r => !current.has(String(r[key]))).map(r => String(r[key]));
    if (remove.length && table !== "equipment_active_parent") throw new AemsError("FORBIDDEN", "Data dan riwayat tidak boleh dihapus permanen.", 403);
    if (upsert.length || remove.length) changes[table] = {upsert, remove};
  }
  return changes;
}

export function supabasePersistenceDriver(): PersistenceDriver {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new AemsError("INTERNAL_ERROR", "Koneksi database belum dikonfigurasi.", 503);
  // The server-only credential is never sent to a browser or returned by an API.
  const client: SupabaseClient = createClient(url, key, {auth: {persistSession: false, autoRefreshToken: false}});
  return {
    async read() {
      const {data, error} = await client.rpc("aems_read_state");
      if (error || !data || !Number.isSafeInteger(data.revision)) throw new AemsError("INTERNAL_ERROR", "Database tidak dapat dibaca. Silakan coba kembali.", 503);
      return data as DatabaseSnapshot;
    },
    async commit(revision, changes) {
      const {error} = await client.rpc("aems_apply_changes", {p_revision: revision, p_changes: changes});
      if (error?.code === "40001") throw new AemsError("VERSION_CONFLICT", "Data telah berubah oleh pengguna lain. Muat ulang sebelum menyimpan kembali.", 409);
      if (error) throw new AemsError("INTERNAL_ERROR", "Perubahan tidak tersimpan. Silakan coba kembali.", 503);
    },
  };
}

/** A response is successful only after its complete database transaction commits. */
export async function runPersistedOperation<T extends Response>(driver: PersistenceDriver, operation: () => Promise<T>, verifiedProfile?: Profile): Promise<T> {
  const snapshot = await driver.read();
  const state = hydrateDatabase(snapshot.tables);
  const before = structuredClone(flattenDatabase(state));
  const profile = verifiedProfile ? state.profiles.find(p => p.id === verifiedProfile.id) : undefined;
  if (verifiedProfile && (!profile?.is_active || !profile.role)) throw new AemsError("FORBIDDEN", "Akses akun tidak tersedia.", 403);
  return aemsRequestState.run({state, profile}, async () => {
    const response = await operation();
    if (response.ok) {
      const changes = databaseDiff(before, flattenDatabase(state));
      if (Object.keys(changes).length) await driver.commit(snapshot.revision, changes);
    }
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  });
}

export function withAemsPersistence<Args extends unknown[]>(handler: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    if (process.env.AEMS_STORAGE_MODE !== "supabase") {
      if (process.env.VERCEL_ENV === "production") return Response.json({error: {code: "INTERNAL_ERROR", message: "Penyimpanan database belum dikonfigurasi."}}, {status: 503});
      return handler(...args);
    }
    try {
      const profile = await getCurrentProfile();
      return await runPersistedOperation(supabasePersistenceDriver(), () => handler(...args), profile);
    } catch (error) {
      const formatted = formatErrorResponse(error);
      return Response.json(formatted.body, {status: formatted.status, headers: {"Cache-Control": "private, no-store"}});
    }
  };
}
