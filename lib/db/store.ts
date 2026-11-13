// =============================================================================
// AEMS Transactional Domain Engine (Enforces all Blueprint R.02 DB Invariants)
// =============================================================================

import { AemsDatabaseState, createInitialSeedState } from "@/lib/db/seed-data";
import {
  AppRole,
  AppSettingsConfig,
  Asset,
  AuditLogRecord,
  BreadcrumbNode,
  CommitMode,
  DuplicateDecision,
  Equipment,
  EquipmentCondition,
  EquipmentKind,
  EquipmentSpecItem,
  EquipmentStatus,
  EquipmentTreeNode,
  ImportBatchRecord,
  ImportRowRecord,
  ImportType,
  MappingChangeItem,
  MappingChangeRequest,
  ParentKind,
  Profile,
  ReconciliationFinding,
} from "@/lib/types/domain";
import { aemsRequestState } from "@/lib/db/context";
import { AemsError } from "@/lib/utils/errors";
import {
  buildAssetCompositeKey,
  buildEquipmentCompositeKey,
  normalizeKey,
} from "@/lib/utils/normalize";
import { canRunImportType, hasPermission } from "@/lib/permissions/rbac";

const globalForAems = globalThis as unknown as {
  __aemsState?: AemsDatabaseState;
  __aemsHierarchyLock?: boolean;
};

export function getAemsState(): AemsDatabaseState {
  const request = aemsRequestState.getStore();
  if (request) return request.state;
  if (
    process.env.AEMS_STORAGE_MODE === "supabase" ||
    process.env.VERCEL_ENV === "production"
  ) {
    throw new AemsError(
      "INTERNAL_ERROR",
      "Koneksi data belum tersedia. Silakan coba kembali.",
      503,
    );
  }
  if (!globalForAems.__aemsState) {
    globalForAems.__aemsState = createInitialSeedState();
  }
  return globalForAems.__aemsState;
}

export function resetAemsState(): AemsDatabaseState {
  if (process.env.AEMS_STORAGE_MODE === "supabase") {
    throw new AemsError(
      "FORBIDDEN",
      "Reset data contoh dinonaktifkan pada database.",
      403,
    );
  }
  globalForAems.__aemsState = createInitialSeedState();
  return globalForAems.__aemsState;
}

function appendAuditLog(
  state: AemsDatabaseState,
  actor: Profile,
  entityType: string,
  entityId: string | null,
  entityCode: string | null,
  action: string,
  oldValues: Record<string, unknown> | null,
  newValues: Record<string, unknown> | null,
  changedFields: string[],
  importBatchId: string | null = null,
): AuditLogRecord {
  const nextId =
    state.audit_logs.length > 0
      ? Math.max(...state.audit_logs.map((a) => a.id)) + 1
      : 1;
  const record: AuditLogRecord = {
    id: nextId,
    occurred_at: new Date().toISOString(),
    actor_id: actor.id,
    actor_name: actor.full_name,
    actor_role: actor.role,
    entity_type: entityType,
    entity_id: entityId,
    entity_code: entityCode,
    action,
    old_values: oldValues,
    new_values: newValues,
    changed_fields: changedFields,
    request_id: crypto.randomUUID(),
    ip_address: "127.0.0.1",
    user_agent: "AEMS-Server/1.0",
    import_batch_id: importBatchId,
  };
  state.audit_logs.unshift(record);
  return record;
}

// -----------------------------------------------------------------------------
// Enriched Read Helpers
// -----------------------------------------------------------------------------

export function getEnrichedAssets(
  includeDeleted = false,
  viewerRole?: AppRole | null,
): Asset[] {
  const state = getAemsState();
  const hideFinancials =
    viewerRole === "MAINTENANCE" &&
    !state.app_settings.security.maintenance_can_view_financial_values;

  return state.assets
    .filter((a) => includeDeleted || a.deleted_at === null)
    .map((a) => {
      const cat = state.asset_categories.find(
        (c) => c.id === a.asset_category_id,
      );
      const loc = state.locations.find((l) => l.id === a.location_id);
      return {
        ...a,
        acquisition_value: hideFinancials ? null : a.acquisition_value,
        category_name: cat?.name || "-",
        location_name: loc?.name || "-",
      };
    });
}

export function getEnrichedEquipment(includeDeleted = false): Equipment[] {
  const state = getAemsState();
  return state.equipment
    .filter((e) => includeDeleted || e.deleted_at === null)
    .map((e) => {
      const cat = state.equipment_categories.find(
        (c) => c.id === e.equipment_category_id,
      );
      const loc = state.locations.find((l) => l.id === e.location_id);
      const rootAsset = e.root_asset_id
        ? state.assets.find((a) => a.id === e.root_asset_id)
        : null;
      const slot = state.equipment_active_parent.find(
        (p) => p.equipment_id === e.id,
      );
      let activeParentNo: string | null = null;
      let activeParentName: string | null = null;
      if (slot) {
        if (slot.parent_kind === "ASSET") {
          const pa = state.assets.find((a) => a.id === slot.parent_id);
          activeParentNo = pa?.sap_asset_no || null;
          activeParentName = pa?.name || null;
        } else {
          const pe = state.equipment.find((eq) => eq.id === slot.parent_id);
          activeParentNo = pe?.equipment_no || null;
          activeParentName = pe?.name || null;
        }
      }
      return {
        ...e,
        category_name: cat?.name || "-",
        location_name: loc?.name || "-",
        root_asset_no: rootAsset?.sap_asset_no || null,
        root_asset_name: rootAsset?.name || null,
        active_parent_kind: slot?.parent_kind || null,
        active_parent_id: slot?.parent_id || null,
        active_parent_no: activeParentNo,
        active_parent_name: activeParentName,
      };
    });
}

// -----------------------------------------------------------------------------
// Hierarchy & Recursive CTE Equivalent Functions (Bab 14.5, 14.6, 14.7)
// -----------------------------------------------------------------------------

/**
 * Computes all active descendants of a given equipment (excluding itself).
 * Equivalent to recursive CTE over equipment_relationships where valid_to is null.
 */
export function getActiveDescendants(
  equipmentId: string,
  state = getAemsState(),
): Equipment[] {
  const result: Equipment[] = [];
  const visited = new Set<string>([equipmentId]);
  const queue: string[] = [equipmentId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const childLinks = state.equipment_relationships.filter(
      (r) => r.parent_equipment_id === currentId && r.valid_to === null,
    );
    for (const link of childLinks) {
      if (!visited.has(link.child_equipment_id)) {
        visited.add(link.child_equipment_id);
        const childEq = state.equipment.find(
          (e) => e.id === link.child_equipment_id && e.deleted_at === null,
        );
        if (childEq) {
          result.push(childEq);
          queue.push(childEq.id);
        }
      }
    }
  }
  return result;
}

/**
 * Computes the height of the subtree below equipmentId (0 if leaf).
 */
export function getSubtreeHeight(
  equipmentId: string,
  state = getAemsState(),
): number {
  const visited = new Set<string>([equipmentId]);
  function dfs(id: string): number {
    const childLinks = state.equipment_relationships.filter(
      (r) => r.parent_equipment_id === id && r.valid_to === null,
    );
    let maxChild = 0;
    for (const link of childLinks) {
      if (!visited.has(link.child_equipment_id)) {
        visited.add(link.child_equipment_id);
        maxChild = Math.max(maxChild, 1 + dfs(link.child_equipment_id));
      }
    }
    return maxChild;
  }
  return dfs(equipmentId);
}

/**
 * Resolves the breadcrumb chain (Asset -> Parent Equipment -> ... -> Self)
 * using live active relationships (recursive CTE truth, Bab 14.5).
 */
export function getEquipmentBreadcrumb(
  equipmentId: string,
  state = getAemsState(),
): BreadcrumbNode[] {
  const eq = state.equipment.find((e) => e.id === equipmentId);
  if (!eq) return [];

  const chain: BreadcrumbNode[] = [
    {
      kind: "EQUIPMENT",
      id: eq.id,
      code: eq.equipment_no,
      name: eq.name,
      status: eq.status,
    },
  ];

  const visited = new Set<string>([eq.id]);
  let currentEqId = eq.id;

  while (true) {
    const slot = state.equipment_active_parent.find(
      (p) => p.equipment_id === currentEqId,
    );
    if (!slot) break;

    if (slot.parent_kind === "ASSET") {
      const asset = state.assets.find((a) => a.id === slot.parent_id);
      if (asset) {
        chain.unshift({
          kind: "ASSET",
          id: asset.id,
          code: asset.sap_asset_no,
          name: asset.name,
          status: asset.status,
        });
      }
      break;
    } else {
      if (visited.has(slot.parent_id)) break; // guard against corrupt state
      visited.add(slot.parent_id);
      const parentEq = state.equipment.find((e) => e.id === slot.parent_id);
      if (!parentEq) break;
      chain.unshift({
        kind: "EQUIPMENT",
        id: parentEq.id,
        code: parentEq.equipment_no,
        name: parentEq.name,
        status: parentEq.status,
      });
      currentEqId = parentEq.id;
    }
  }

  return chain;
}

/**
 * Resolves the effective root asset ID by walking up active parent relationships.
 */
export function resolveEffectiveRootAssetId(
  equipmentId: string,
  state = getAemsState(),
): { rootAssetId: string | null; depth: number; pathIds: string[] } {
  const pathIds: string[] = [equipmentId];
  const visited = new Set<string>([equipmentId]);
  let curr = equipmentId;

  while (true) {
    const slot = state.equipment_active_parent.find(
      (p) => p.equipment_id === curr,
    );
    if (!slot) {
      return {
        rootAssetId: null,
        depth: pathIds.length > 1 ? pathIds.length - 1 : 0,
        pathIds,
      };
    }
    if (slot.parent_kind === "ASSET") {
      return {
        rootAssetId: slot.parent_id,
        depth: pathIds.length,
        pathIds,
      };
    }
    if (visited.has(slot.parent_id)) {
      break;
    }
    visited.add(slot.parent_id);
    pathIds.unshift(slot.parent_id);
    curr = slot.parent_id;
  }

  return { rootAssetId: null, depth: 0, pathIds };
}

/**
 * Recomputes root_asset_id, depth, and path_ids cache for an equipment and all its descendants
 * within the same transaction (BR-HR-08).
 */
export function recomputeSubtreeCache(
  equipmentId: string,
  state = getAemsState(),
): void {
  const targets = [
    equipmentId,
    ...getActiveDescendants(equipmentId, state).map((d) => d.id),
  ];
  for (const id of targets) {
    const eq = state.equipment.find((e) => e.id === id);
    if (eq) {
      const resolved = resolveEffectiveRootAssetId(id, state);
      eq.root_asset_id = resolved.rootAssetId;
      eq.depth = resolved.depth;
      eq.path_ids = resolved.pathIds;
    }
  }
}

/**
 * Builds the full hierarchical EquipmentTreeNode[] for an Asset (FR-AST-06).
 * Also supports Historical Reconstruction at a given ISO timestamp `asOfDate` (Bab 14.8, FR-MAP-09)!
 */
export function getAssetEquipmentTree(
  assetId: string,
  asOfDate?: string | null,
  state = getAemsState(),
): EquipmentTreeNode[] {
  const ts = asOfDate ? new Date(asOfDate).getTime() : null;

  const isRelActiveAt = (validFrom: string, validTo: string | null) => {
    if (ts === null) return validTo === null;
    const fromTime = new Date(validFrom).getTime();
    const toTime = validTo ? new Date(validTo).getTime() : Infinity;
    return fromTime <= ts && ts < toTime;
  };

  const directLinks = state.asset_equipment_mappings.filter(
    (m) => m.asset_id === assetId && isRelActiveAt(m.valid_from, m.valid_to),
  );

  const visited = new Set<string>();

  function buildNode(
    eqId: string,
    currentDepth: number,
  ): EquipmentTreeNode | null {
    if (visited.has(eqId)) return null;
    visited.add(eqId);
    const eq = state.equipment.find((e) => e.id === eqId);
    if (!eq) return null;

    const childLinks = state.equipment_relationships.filter(
      (r) =>
        r.parent_equipment_id === eqId &&
        isRelActiveAt(r.valid_from, r.valid_to),
    );

    const children: EquipmentTreeNode[] = [];
    for (const cl of childLinks) {
      const childNode = buildNode(cl.child_equipment_id, currentDepth + 1);
      if (childNode) children.push(childNode);
    }

    const totalDescendants = children.reduce(
      (acc, c) => acc + 1 + c.descendant_count,
      0,
    );

    const specItems = state.equipment_spec_items.filter(
      (s) => s.equipment_id === eq.id,
    );

    return {
      id: eq.id,
      equipment_no: eq.equipment_no,
      name: eq.name,
      kind: eq.kind,
      status: eq.status,
      condition: eq.condition,
      serial_no: eq.serial_no,
      depth: currentDepth,
      descendant_count: totalDescendants,
      spec_items: specItems,
      children,
    };
  }

  const roots: EquipmentTreeNode[] = [];
  for (const dl of directLinks) {
    const node = buildNode(dl.equipment_id, 1);
    if (node) roots.push(node);
  }
  return roots;
}

// -----------------------------------------------------------------------------
// Master Data Asset CRUD (Bab 10.1, 10.4, 12.1)
// -----------------------------------------------------------------------------

export function createAsset(
  actor: Profile,
  input: {
    company_code?: string;
    sap_asset_no: string;
    sap_sub_no?: string;
    name: string;
    description?: string | null;
    asset_category_id?: string | null;
    location_id?: string | null;
    cost_center?: string | null;
    acquisition_date?: string | null;
    acquisition_value?: number | null;
    currency?: string;
    serial_no?: string | null;
    manufacturer?: string | null;
    model?: string | null;
    status?: "ACTIVE" | "INACTIVE" | "DISPOSED";
    attributes?: Record<string, unknown>;
    source_type?: string;
    source_batch_id?: string | null;
  },
): Asset {
  if (!hasPermission(actor, "asset:write")) {
    throw new AemsError(
      "FORBIDDEN",
      "Role Anda tidak memiliki wewenang membuat atau mengubah Master Data Aset.",
      403,
    );
  }

  const state = getAemsState();
  validateMasterReferences(
    state,
    input.location_id,
    input.asset_category_id,
    "asset",
  );
  const normOpts = {
    padNumeric: state.app_settings.normalization.pad_numeric_sap_asset,
    padLength: state.app_settings.normalization.sap_asset_pad_length,
  };
  const companyCode = normalizeKey(
    input.company_code || state.app_settings.normalization.default_company_code,
  );
  const subNo = normalizeKey(
    input.sap_sub_no || state.app_settings.normalization.default_sub_no,
  );
  const assetKeyNorm = normalizeKey(input.sap_asset_no, normOpts);

  if (!assetKeyNorm) {
    throw new AemsError("VALIDATION", "Nomor aset SAP wajib diisi.", 400);
  }

  // BR-ID-02 & BR-ID-05: Unique across all assets including soft-deleted ones
  const existing = state.assets.find(
    (a) =>
      normalizeKey(a.company_code) === companyCode &&
      a.asset_key_norm === assetKeyNorm &&
      normalizeKey(a.sap_sub_no) === subNo,
  );

  if (existing) {
    throw new AemsError(
      "DUPLICATE_KEY",
      `Nomor aset SAP '${input.sap_asset_no}' (${companyCode}/${subNo}) sudah terdaftar di sistem.`,
      409,
      { sap_asset_no: input.sap_asset_no, existing_id: existing.id },
    );
  }

  const now = new Date().toISOString();
  const newAsset: Asset = {
    id: crypto.randomUUID(),
    company_code: companyCode,
    sap_asset_no: input.sap_asset_no.trim(),
    sap_sub_no: subNo,
    asset_key_norm: assetKeyNorm,
    name: input.name.trim(),
    description: input.description ?? null,
    asset_category_id: input.asset_category_id ?? null,
    location_id: input.location_id ?? null,
    cost_center: input.cost_center ?? null,
    acquisition_date: input.acquisition_date ?? null,
    acquisition_value: input.acquisition_value ?? null,
    currency: input.currency || "IDR",
    serial_no: input.serial_no ?? null,
    manufacturer: input.manufacturer ?? null,
    model: input.model ?? null,
    status: input.status || "ACTIVE",
    attributes: input.attributes || {},
    source_type: input.source_type || "MANUAL",
    source_batch_id: input.source_batch_id ?? null,
    row_version: 1,
    created_at: now,
    created_by: actor.id,
    updated_at: now,
    updated_by: actor.id,
    deleted_at: null,
    deleted_by: null,
    delete_reason: null,
  };

  state.assets.unshift(newAsset);
  appendAuditLog(
    state,
    actor,
    "ASSET",
    newAsset.id,
    newAsset.sap_asset_no,
    "CREATE",
    null,
    {
      sap_asset_no: newAsset.sap_asset_no,
      name: newAsset.name,
      status: newAsset.status,
      acquisition_value: newAsset.acquisition_value,
    },
    ["sap_asset_no", "name", "status", "acquisition_value"],
    newAsset.source_batch_id,
  );

  return newAsset;
}

function validateMasterReferences(
  state: AemsDatabaseState,
  locationId: string | null | undefined,
  categoryId: string | null | undefined,
  kind: "asset" | "equipment",
) {
  if (
    locationId &&
    !state.locations.some((l) => l.id === locationId && l.is_active)
  )
    throw new AemsError("VALIDATION", "Lokasi tidak ditemukan.");
  const categories =
    kind === "asset" ? state.asset_categories : state.equipment_categories;
  if (categoryId && !categories.some((c) => c.id === categoryId && c.is_active))
    throw new AemsError("VALIDATION", "Kategori tidak ditemukan.");
}

export function updateAsset(
  actor: Profile,
  assetId: string,
  input: Partial<Asset> & { row_version: number; change_reason?: string },
): Asset {
  if (!hasPermission(actor, "asset:write")) {
    throw new AemsError(
      "FORBIDDEN",
      "Role Anda tidak memiliki wewenang mengubah Master Data Aset.",
      403,
    );
  }

  const state = getAemsState();
  const asset = state.assets.find(
    (a) => a.id === assetId && a.deleted_at === null,
  );
  if (!asset) {
    throw new AemsError("NOT_FOUND", "Data aset tidak ditemukan.", 404);
  }

  // BR-DL-05: Optimistic concurrency check on row_version
  if (asset.row_version !== input.row_version) {
    const diff: Record<string, { server: unknown; client: unknown }> = {};
    for (const k of [
      "name",
      "status",
      "location_id",
      "asset_category_id",
      "acquisition_value",
      "description",
    ] as const) {
      if (input[k] !== undefined && input[k] !== asset[k]) {
        diff[k] = { server: asset[k], client: input[k] };
      }
    }
    throw new AemsError(
      "VERSION_CONFLICT",
      "Data aset telah diubah oleh pengguna lain sejak Anda membuka halaman ini. Tinjau perbedaan sebelum menyimpan.",
      409,
      {
        current_row_version: asset.row_version,
        submitted_row_version: input.row_version,
        server_state: asset,
        diff,
      },
    );
  }

  const nextCompany = input.company_code?.trim() ?? asset.company_code;
  const nextNumber = input.sap_asset_no?.trim() ?? asset.sap_asset_no;
  const nextSub = input.sap_sub_no?.trim() ?? asset.sap_sub_no;
  const identityChanged =
    nextCompany !== asset.company_code ||
    nextNumber !== asset.sap_asset_no ||
    nextSub !== asset.sap_sub_no;
  if (identityChanged) {
    if (actor.role !== "ADMIN")
      throw new AemsError(
        "FORBIDDEN",
        "Perubahan nomor aset SAP, company code, dan sub-nomor hanya diizinkan untuk Administrator.",
        403,
      );
    if (!input.change_reason || input.change_reason.trim().length < 3)
      throw new AemsError(
        "VALIDATION",
        "Alasan perubahan identitas aset wajib diisi.",
      );
    if (
      state.assets.some(
        (a) =>
          a.id !== asset.id &&
          a.company_code === nextCompany &&
          a.sap_sub_no === nextSub &&
          a.asset_key_norm === normalizeKey(nextNumber),
      )
    )
      throw new AemsError(
        "DUPLICATE_KEY",
        "Kombinasi nomor aset SAP, company code, dan sub-nomor sudah digunakan.",
        409,
      );
  }
  validateMasterReferences(
    state,
    input.location_id,
    input.asset_category_id,
    "asset",
  );

  // BR-DL-02: Cannot set status to INACTIVE/DISPOSED if asset still has active equipment
  if (input.status && input.status !== "ACTIVE" && asset.status === "ACTIVE") {
    const activeLinks = state.asset_equipment_mappings.filter(
      (m) => m.asset_id === asset.id && m.valid_to === null,
    );
    if (activeLinks.length > 0) {
      throw new AemsError(
        "HAS_ACTIVE_CHILDREN",
        `Aset ${asset.sap_asset_no} tidak dapat dinonaktifkan karena masih memiliki ${activeLinks.length} equipment aktif langsung di bawahnya. Lepaskan atau pindahkan equipment terlebih dahulu.`,
        409,
        { active_equipment_count: activeLinks.length },
      );
    }
  }

  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};
  const changedFields: string[] = [];

  const updatableFields = [
    "company_code",
    "sap_asset_no",
    "sap_sub_no",
    "attributes",
    "name",
    "description",
    "asset_category_id",
    "location_id",
    "cost_center",
    "acquisition_date",
    "acquisition_value",
    "currency",
    "serial_no",
    "manufacturer",
    "model",
    "status",
  ] as const;

  for (const field of updatableFields) {
    if (input[field] !== undefined && input[field] !== asset[field]) {
      oldValues[field] = asset[field];
      newValues[field] = input[field];
      (asset as unknown as Record<string, unknown>)[field] = input[field];
      changedFields.push(field);
    }
  }

  asset.asset_key_norm = normalizeKey(asset.sap_asset_no);
  asset.row_version += 1;
  asset.updated_at = new Date().toISOString();
  asset.updated_by = actor.id;

  if (changedFields.length > 0) {
    if (input.change_reason) newValues.change_reason = input.change_reason;
    appendAuditLog(
      state,
      actor,
      "ASSET",
      asset.id,
      asset.sap_asset_no,
      "UPDATE",
      oldValues,
      newValues,
      changedFields,
    );
  }

  return asset;
}

export function softDeleteAsset(
  actor: Profile,
  assetId: string,
  reason: string,
): Asset {
  if (!hasPermission(actor, "asset:write")) {
    throw new AemsError(
      "FORBIDDEN",
      "Role Anda tidak memiliki wewenang menonaktifkan aset.",
      403,
    );
  }

  const state = getAemsState();
  const asset = state.assets.find(
    (a) => a.id === assetId && a.deleted_at === null,
  );
  if (!asset) {
    throw new AemsError("NOT_FOUND", "Data aset tidak ditemukan.", 404);
  }

  // BR-DL-02: Reject if asset has active equipment
  const activeLinks = state.asset_equipment_mappings.filter(
    (m) => m.asset_id === asset.id && m.valid_to === null,
  );
  if (activeLinks.length > 0) {
    throw new AemsError(
      "HAS_ACTIVE_CHILDREN",
      `Penonaktifan ditolak: Aset ${asset.sap_asset_no} masih memiliki ${activeLinks.length} equipment aktif. Ajukan pelepasan atau pemindahan equipment terlebih dahulu.`,
      409,
      { active_equipment_count: activeLinks.length },
    );
  }

  const oldStatus = asset.status;
  asset.status = "INACTIVE";
  asset.deleted_at = new Date().toISOString();
  asset.deleted_by = actor.id;
  asset.delete_reason = reason.trim();
  asset.row_version += 1;

  appendAuditLog(
    state,
    actor,
    "ASSET",
    asset.id,
    asset.sap_asset_no,
    "SOFT_DELETE",
    { status: oldStatus, deleted_at: null },
    {
      status: "INACTIVE",
      deleted_at: asset.deleted_at,
      delete_reason: asset.delete_reason,
    },
    ["status", "deleted_at", "delete_reason"],
  );

  return asset;
}

// -----------------------------------------------------------------------------
// Master Data Equipment CRUD & Specifications (Bab 10.2, 10.4, 12.2)
// -----------------------------------------------------------------------------

export function createEquipment(
  actor: Profile,
  input: {
    source_system?: string;
    equipment_no: string;
    kind: EquipmentKind;
    name: string;
    specification?: string | null;
    equipment_category_id?: string | null;
    manufacturer?: string | null;
    model?: string | null;
    serial_no?: string | null;
    condition?: EquipmentCondition;
    location_id?: string | null;
    install_date?: string | null;
    status?: EquipmentStatus;
    attributes?: Record<string, unknown>;
    source_type?: string;
    source_batch_id?: string | null;
  },
): Equipment {
  if (!hasPermission(actor, "equipment:write")) {
    throw new AemsError(
      "FORBIDDEN",
      "Role Anda tidak memiliki wewenang membuat atau mengubah Master Data Equipment.",
      403,
    );
  }

  const state = getAemsState();
  validateMasterReferences(
    state,
    input.location_id,
    input.equipment_category_id,
    "equipment",
  );
  const sourceSystem = normalizeKey(
    input.source_system ||
      state.app_settings.normalization.default_source_system,
  );
  const eqKeyNorm = normalizeKey(input.equipment_no);

  if (!eqKeyNorm) {
    throw new AemsError(
      "VALIDATION",
      "Nomor equipment resmi wajib diisi.",
      400,
    );
  }

  // BR-ID-03 & BR-ID-05: Unique across all equipment including inactive
  const existing = state.equipment.find(
    (e) =>
      normalizeKey(e.source_system) === sourceSystem &&
      e.equipment_key_norm === eqKeyNorm,
  );
  if (existing) {
    throw new AemsError(
      "DUPLICATE_KEY",
      `Nomor equipment '${input.equipment_no}' (${sourceSystem}) sudah terdaftar di sistem.`,
      409,
      { equipment_no: input.equipment_no, existing_id: existing.id },
    );
  }

  const now = new Date().toISOString();
  const newId = crypto.randomUUID();
  const newEq: Equipment = {
    id: newId,
    source_system: sourceSystem,
    equipment_no: input.equipment_no.trim(),
    equipment_key_norm: eqKeyNorm,
    kind: input.kind || "OTHER",
    name: input.name.trim(),
    specification: input.specification ?? null,
    equipment_category_id: input.equipment_category_id ?? null,
    manufacturer: input.manufacturer ?? null,
    model: input.model ?? null,
    serial_no: input.serial_no ?? null,
    condition: input.condition || "BAIK",
    location_id: input.location_id ?? null,
    install_date: input.install_date ?? null,
    status: input.status || "ACTIVE",
    root_asset_id: null, // FR-EQP-02: starts unmapped until mapping applied
    depth: 0,
    path_ids: [newId],
    attributes: input.attributes || {},
    source_type: input.source_type || "MANUAL",
    source_batch_id: input.source_batch_id ?? null,
    row_version: 1,
    created_at: now,
    created_by: actor.id,
    updated_at: now,
    updated_by: actor.id,
    deleted_at: null,
    deleted_by: null,
    delete_reason: null,
  };

  state.equipment.unshift(newEq);
  appendAuditLog(
    state,
    actor,
    "EQUIPMENT",
    newEq.id,
    newEq.equipment_no,
    "CREATE",
    null,
    {
      equipment_no: newEq.equipment_no,
      name: newEq.name,
      kind: newEq.kind,
      status: newEq.status,
    },
    ["equipment_no", "name", "kind", "status"],
    newEq.source_batch_id,
  );

  return newEq;
}

export function updateEquipment(
  actor: Profile,
  equipmentId: string,
  input: Partial<Equipment> & { row_version: number; change_reason?: string },
): Equipment {
  if (!hasPermission(actor, "equipment:write")) {
    throw new AemsError(
      "FORBIDDEN",
      "Role Anda tidak memiliki wewenang mengubah Master Data Equipment.",
      403,
    );
  }

  const state = getAemsState();
  const eq = state.equipment.find(
    (e) => e.id === equipmentId && e.deleted_at === null,
  );
  if (!eq) {
    throw new AemsError("NOT_FOUND", "Data equipment tidak ditemukan.", 404);
  }

  // BR-DL-05: Optimistic concurrency check
  if (eq.row_version !== input.row_version) {
    const diff: Record<string, { server: unknown; client: unknown }> = {};
    for (const k of [
      "name",
      "kind",
      "condition",
      "status",
      "serial_no",
      "specification",
      "location_id",
    ] as const) {
      if (input[k] !== undefined && input[k] !== eq[k]) {
        diff[k] = { server: eq[k], client: input[k] };
      }
    }
    throw new AemsError(
      "VERSION_CONFLICT",
      "Data equipment telah diubah oleh pengguna lain. Tinjau perbedaan sebelum menyimpan.",
      409,
      {
        current_row_version: eq.row_version,
        submitted_row_version: input.row_version,
        server_state: eq,
        diff,
      },
    );
  }

  const nextSource = input.source_system?.trim() ?? eq.source_system;
  const nextNumber = input.equipment_no?.trim() ?? eq.equipment_no;
  const identityChanged =
    nextSource !== eq.source_system || nextNumber !== eq.equipment_no;
  if (identityChanged) {
    if (actor.role !== "ADMIN")
      throw new AemsError(
        "FORBIDDEN",
        "Perubahan nomor equipment dan source system hanya diizinkan untuk Administrator.",
        403,
      );
    if (!input.change_reason || input.change_reason.trim().length < 3)
      throw new AemsError(
        "VALIDATION",
        "Alasan perubahan identitas equipment wajib diisi.",
      );
    if (
      state.equipment.some(
        (e) =>
          e.id !== eq.id &&
          e.source_system === nextSource &&
          e.equipment_key_norm === normalizeKey(nextNumber),
      )
    )
      throw new AemsError(
        "DUPLICATE_KEY",
        "Kombinasi nomor equipment dan source system sudah digunakan.",
        409,
      );
  }
  validateMasterReferences(
    state,
    input.location_id,
    input.equipment_category_id,
    "equipment",
  );

  // BR-DL-03: Cannot deactivate if active children exist
  if (input.status && input.status !== "ACTIVE" && eq.status === "ACTIVE") {
    const activeChildren = state.equipment_relationships.filter(
      (r) => r.parent_equipment_id === eq.id && r.valid_to === null,
    );
    if (activeChildren.length > 0) {
      throw new AemsError(
        "HAS_ACTIVE_CHILDREN",
        `Equipment ${eq.equipment_no} masih memiliki ${activeChildren.length} sub-equipment aktif. Lepaskan atau pindahkan sub-equipment terlebih dahulu.`,
        409,
        { active_children_count: activeChildren.length },
      );
    }
  }

  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};
  const changedFields: string[] = [];

  const updatableFields = [
    "source_system",
    "equipment_no",
    "attributes",
    "kind",
    "name",
    "specification",
    "equipment_category_id",
    "manufacturer",
    "model",
    "serial_no",
    "condition",
    "location_id",
    "install_date",
    "status",
  ] as const;

  for (const field of updatableFields) {
    if (input[field] !== undefined && input[field] !== eq[field]) {
      oldValues[field] = eq[field];
      newValues[field] = input[field];
      (eq as unknown as Record<string, unknown>)[field] = input[field];
      changedFields.push(field);
    }
  }

  eq.equipment_key_norm = normalizeKey(eq.equipment_no);
  eq.row_version += 1;
  eq.updated_at = new Date().toISOString();
  eq.updated_by = actor.id;

  if (changedFields.length > 0) {
    if (input.change_reason) newValues.change_reason = input.change_reason;
    appendAuditLog(
      state,
      actor,
      "EQUIPMENT",
      eq.id,
      eq.equipment_no,
      "UPDATE",
      oldValues,
      newValues,
      changedFields,
    );
  }

  return eq;
}

export function softDeleteEquipment(
  actor: Profile,
  equipmentId: string,
  reason: string,
  cascadeDescendants = false,
): Equipment {
  if (!hasPermission(actor, "equipment:write")) {
    throw new AemsError(
      "FORBIDDEN",
      "Role Anda tidak memiliki wewenang menonaktifkan equipment.",
      403,
    );
  }

  const state = getAemsState();
  const eq = state.equipment.find(
    (e) => e.id === equipmentId && e.deleted_at === null,
  );
  if (!eq) {
    throw new AemsError("NOT_FOUND", "Data equipment tidak ditemukan.", 404);
  }

  const activeChildren = state.equipment_relationships.filter(
    (r) => r.parent_equipment_id === eq.id && r.valid_to === null,
  );

  if (activeChildren.length > 0) {
    if (!cascadeDescendants || actor.role !== "ADMIN") {
      throw new AemsError(
        "HAS_ACTIVE_CHILDREN",
        `Penonaktifan ditolak: Equipment ${eq.equipment_no} masih memiliki ${activeChildren.length} sub-equipment aktif.`,
        409,
        { active_children_count: activeChildren.length },
      );
    }
  }

  const now = new Date().toISOString();
  const targets = cascadeDescendants
    ? [eq, ...getActiveDescendants(eq.id, state)]
    : [eq];

  for (const item of targets) {
    // BR-DL-04: Deactivating equipment closes its active relationship and preserves history
    const slotIdx = state.equipment_active_parent.findIndex(
      (p) => p.equipment_id === item.id,
    );
    if (slotIdx !== -1) {
      const slot = state.equipment_active_parent[slotIdx];
      if (slot.parent_kind === "ASSET") {
        const aem = state.asset_equipment_mappings.find(
          (m) => m.id === slot.link_id && m.valid_to === null,
        );
        if (aem) {
          aem.valid_to = now;
          aem.end_reason = "RETIRE";
          aem.ended_by = actor.id;
        }
      } else {
        const er = state.equipment_relationships.find(
          (r) => r.id === slot.link_id && r.valid_to === null,
        );
        if (er) {
          er.valid_to = now;
          er.end_reason = "RETIRE";
          er.ended_by = actor.id;
        }
      }
      state.equipment_active_parent.splice(slotIdx, 1);

      state.mapping_history.unshift({
        id: crypto.randomUUID(),
        equipment_id: item.id,
        equipment_no: item.equipment_no,
        equipment_name: item.name,
        event_type: "RETIRE_CLOSE",
        change_request_id: null,
        request_code: null,
        from_parent_kind: slot.parent_kind,
        from_parent_id: slot.parent_id,
        from_parent_no: null,
        to_parent_kind: null,
        to_parent_id: null,
        to_parent_no: null,
        from_asset_id: item.root_asset_id,
        from_asset_no: null,
        to_asset_id: null,
        to_asset_no: null,
        actor_id: actor.id,
        actor_name: actor.full_name,
        approved_by: actor.id,
        approver_name: actor.full_name,
        reason: `Penonaktifan equipment: ${reason}`,
        occurred_at: now,
      });
    }

    item.status = "INACTIVE";
    item.root_asset_id = null;
    item.depth = 0;
    item.path_ids = [item.id];
    item.deleted_at = now;
    item.deleted_by = actor.id;
    item.delete_reason = reason.trim();
    item.row_version += 1;

    appendAuditLog(
      state,
      actor,
      "EQUIPMENT",
      item.id,
      item.equipment_no,
      "SOFT_DELETE",
      { status: "ACTIVE", deleted_at: null },
      { status: "INACTIVE", deleted_at: now, delete_reason: reason.trim() },
      ["status", "deleted_at", "delete_reason"],
    );
  }

  return eq;
}

/**
 * Adds an unnumbered component specification item (BR-ID-07, FR-EQP-08)
 */
export function addEquipmentSpecItem(
  actor: Profile,
  input: {
    asset_id?: string | null;
    equipment_id?: string | null;
    spec_name: string;
    spec_value: string;
    spec_group?: string | null;
    quantity?: number;
    serial_no?: string | null;
  },
): EquipmentSpecItem {
  if (!hasPermission(actor, "spec:write")) {
    throw new AemsError(
      "FORBIDDEN",
      "Role Anda tidak memiliki wewenang menambah spesifikasi komponen.",
      403,
    );
  }

  if (
    (!input.asset_id && !input.equipment_id) ||
    (input.asset_id && input.equipment_id)
  ) {
    throw new AemsError(
      "VALIDATION",
      "Spesifikasi komponen harus dimiliki tepat salah satu: aset atau equipment.",
      400,
    );
  }

  const state = getAemsState();
  const item: EquipmentSpecItem = {
    id: crypto.randomUUID(),
    asset_id: input.asset_id ?? null,
    equipment_id: input.equipment_id ?? null,
    spec_name: input.spec_name.trim(),
    spec_value: input.spec_value.trim(),
    spec_group: input.spec_group?.trim() || null,
    quantity: input.quantity ?? 1,
    serial_no: input.serial_no?.trim() || null,
    promoted_equipment_id: null,
    promoted_at: null,
    promoted_by: null,
    created_at: new Date().toISOString(),
    created_by: actor.id,
  };

  state.equipment_spec_items.push(item);
  appendAuditLog(
    state,
    actor,
    "SPEC_ITEM",
    item.id,
    item.spec_name,
    "CREATE_SPEC",
    null,
    {
      spec_name: item.spec_name,
      spec_value: item.spec_value,
      equipment_id: item.equipment_id,
    },
    ["spec_name", "spec_value"],
  );

  return item;
}

export function updateEquipmentSpecItem(
  actor: Profile,
  equipmentId: string,
  itemId: string,
  input: Pick<
    EquipmentSpecItem,
    "spec_name" | "spec_value" | "spec_group" | "quantity" | "serial_no"
  >,
  expected: Pick<
    EquipmentSpecItem,
    "spec_name" | "spec_value" | "spec_group" | "quantity" | "serial_no"
  >,
): EquipmentSpecItem {
  if (!hasPermission(actor, "spec:write"))
    throw new AemsError(
      "FORBIDDEN",
      "Anda tidak memiliki wewenang mengubah spesifikasi.",
      403,
    );
  const state = getAemsState();
  const parent = state.equipment.find(
    (e) => e.id === equipmentId && !e.deleted_at,
  );
  const item = state.equipment_spec_items.find(
    (s) => s.id === itemId && s.equipment_id === equipmentId,
  );
  if (!parent || !item)
    throw new AemsError(
      "NOT_FOUND",
      "Spesifikasi equipment tidak ditemukan.",
      404,
    );
  if (item.promoted_equipment_id)
    throw new AemsError(
      "VALIDATION",
      "Spesifikasi telah dipromosikan. Ubah data pada equipment hasil promosi.",
    );
  const fields = [
    "spec_name",
    "spec_value",
    "spec_group",
    "quantity",
    "serial_no",
  ] as const;
  if (fields.some((key) => item[key] !== expected[key]))
    throw new AemsError(
      "VERSION_CONFLICT",
      "Spesifikasi telah diubah pengguna lain. Muat ulang sebelum menyimpan.",
      409,
    );
  const oldValues: Record<string, unknown> = {},
    newValues: Record<string, unknown> = {};
  const changed = fields.filter((key) => item[key] !== input[key]);
  for (const key of changed) {
    oldValues[key] = item[key];
    newValues[key] = input[key];
  }
  Object.assign(item, input);
  if (changed.length)
    appendAuditLog(
      state,
      actor,
      "SPEC_ITEM",
      item.id,
      item.spec_name,
      "UPDATE_SPEC",
      oldValues,
      newValues,
      changed,
    );
  return item;
}

/**
 * Promotes an unnumbered specification item into an official numbered Equipment (FR-EQP-08, BR-ID-07)
 */
export function promoteSpecItemToEquipment(
  actor: Profile,
  input: {
    spec_item_id: string;
    equipment_no: string;
    kind?: EquipmentKind;
    reason: string;
  },
): { specItem: EquipmentSpecItem; equipment: Equipment } {
  if (!hasPermission(actor, "equipment:write")) {
    throw new AemsError(
      "FORBIDDEN",
      "Role Anda tidak memiliki wewenang mempromosikan spesifikasi menjadi equipment.",
      403,
    );
  }

  const state = getAemsState();
  const spec = state.equipment_spec_items.find(
    (s) => s.id === input.spec_item_id,
  );
  if (!spec) {
    throw new AemsError(
      "NOT_FOUND",
      "Data spesifikasi komponen tidak ditemukan.",
      404,
    );
  }
  if (spec.promoted_equipment_id) {
    throw new AemsError(
      "VALIDATION",
      "Spesifikasi komponen ini sudah pernah dipromosikan menjadi equipment.",
      409,
    );
  }

  const newEq = createEquipment(actor, {
    equipment_no: input.equipment_no,
    kind: input.kind || "COMPONENT",
    name: spec.spec_name,
    specification: spec.spec_value,
    serial_no: spec.serial_no,
  });

  spec.promoted_equipment_id = newEq.id;
  spec.promoted_equipment_no = newEq.equipment_no;
  spec.promoted_at = new Date().toISOString();
  spec.promoted_by = actor.id;

  appendAuditLog(
    state,
    actor,
    "SPEC_ITEM",
    spec.id,
    spec.spec_name,
    "PROMOTE_TO_EQUIPMENT",
    { promoted_equipment_id: null },
    {
      promoted_equipment_id: newEq.id,
      equipment_no: newEq.equipment_no,
      reason: input.reason,
    },
    ["promoted_equipment_id"],
  );

  return { specItem: spec, equipment: newEq };
}

// -----------------------------------------------------------------------------
// Mapping & Hierarchy Validation + Atomic Maker-Checker RPC (Bab 10.2, 10.3, 14.6, 14.7)
// -----------------------------------------------------------------------------

export interface MappingImpactPreview {
  equipment_id: string;
  equipment_no: string;
  equipment_name: string;
  action_type: "LINK" | "MOVE" | "UNLINK";
  from_parent_kind: ParentKind | null;
  from_parent_id: string | null;
  from_parent_no: string | null;
  from_root_asset_id: string | null;
  from_root_asset_no: string | null;
  to_parent_kind: ParentKind | null;
  to_parent_id: string | null;
  to_parent_no: string | null;
  to_root_asset_id: string | null;
  to_root_asset_no: string | null;
  descendant_count: number;
  descendant_nos: string[];
  new_max_depth: number;
  valid: boolean;
}

/**
 * Validates and computes impact preview for a proposed LINK / MOVE / UNLINK operation.
 * Throws AemsError with exact Blueprint R.02 codes (AE001, AE002, AE003, AE004, AE010, AE011, AE012).
 */
export function validateAndPreviewMappingItem(
  item: {
    equipment_id: string;
    action_type?: "LINK" | "MOVE" | "UNLINK";
    to_parent_kind?: ParentKind | null;
    to_parent_id?: string | null;
  },
  options?: {
    ignoreOpenRequestId?: string;
    checkOpenRequests?: boolean;
    state?: AemsDatabaseState;
  },
): MappingImpactPreview {
  const state = options?.state || getAemsState();
  const maxDepth = state.app_settings.hierarchy.max_depth;

  const eq = state.equipment.find(
    (e) => e.id === item.equipment_id && e.deleted_at === null,
  );
  if (!eq || eq.status !== "ACTIVE") {
    throw new AemsError(
      "AE010",
      "Equipment tidak ditemukan atau berstatus tidak aktif (AE010).",
      409,
      { equipment_id: item.equipment_id },
    );
  }

  // Check if equipment already has an open mapping request (BR-MP-07, AE004)
  if (options?.checkOpenRequests !== false) {
    const existingOpenReq = state.mapping_change_requests.find(
      (req) =>
        req.status === "SUBMITTED" &&
        req.id !== options?.ignoreOpenRequestId &&
        req.items.some((i) => i.equipment_id === eq.id && i.status === "OPEN"),
    );
    if (existingOpenReq) {
      throw new AemsError(
        "AE004",
        `Equipment ${eq.equipment_no} sudah memiliki pengajuan perubahan mapping terbuka (${existingOpenReq.request_code}). Selesaikan atau batalkan pengajuan tersebut terlebih dahulu (AE004).`,
        409,
        {
          equipment_no: eq.equipment_no,
          open_request_code: existingOpenReq.request_code,
        },
      );
    }
  }

  const currentSlot = state.equipment_active_parent.find(
    (p) => p.equipment_id === eq.id,
  );
  let fromParentNo: string | null = null;
  if (currentSlot) {
    if (currentSlot.parent_kind === "ASSET") {
      fromParentNo =
        state.assets.find((a) => a.id === currentSlot.parent_id)
          ?.sap_asset_no || null;
    } else {
      fromParentNo =
        state.equipment.find((e) => e.id === currentSlot.parent_id)
          ?.equipment_no || null;
    }
  }
  const fromRootAsset = eq.root_asset_id
    ? state.assets.find((a) => a.id === eq.root_asset_id)
    : null;

  const descendants = getActiveDescendants(eq.id, state);
  const subtreeHeight = getSubtreeHeight(eq.id, state);

  // Determine effective action type
  const effectiveAction: "LINK" | "MOVE" | "UNLINK" =
    item.action_type ||
    (!item.to_parent_id ? "UNLINK" : currentSlot ? "MOVE" : "LINK");

  if (effectiveAction === "UNLINK") {
    if (!currentSlot) {
      throw new AemsError(
        "AE012",
        `Equipment ${eq.equipment_no} saat ini belum memiliki parent aktif sehingga tidak dapat di-unlink (AE012).`,
        409,
      );
    }
    return {
      equipment_id: eq.id,
      equipment_no: eq.equipment_no,
      equipment_name: eq.name,
      action_type: "UNLINK",
      from_parent_kind: currentSlot.parent_kind,
      from_parent_id: currentSlot.parent_id,
      from_parent_no: fromParentNo,
      from_root_asset_id: fromRootAsset?.id || null,
      from_root_asset_no: fromRootAsset?.sap_asset_no || null,
      to_parent_kind: null,
      to_parent_id: null,
      to_parent_no: null,
      to_root_asset_id: null,
      to_root_asset_no: null,
      descendant_count: descendants.length,
      descendant_nos: descendants.map((d) => d.equipment_no),
      new_max_depth: 1 + subtreeHeight,
      valid: true,
    };
  }

  // LINK or MOVE requires target parent
  if (!item.to_parent_kind || !item.to_parent_id) {
    throw new AemsError(
      "VALIDATION",
      "Target parent (Aset atau Equipment) wajib dipilih untuk operasi LINK atau MOVE.",
      400,
    );
  }

  if (effectiveAction === "LINK" && currentSlot) {
    throw new AemsError(
      "AE003",
      `Equipment ${eq.equipment_no} sudah memiliki parent aktif (${fromParentNo}). Gunakan operasi MOVE untuk memindahkan parent (AE003).`,
      409,
      { equipment_no: eq.equipment_no, active_parent_no: fromParentNo },
    );
  }

  if (
    currentSlot &&
    currentSlot.parent_kind === item.to_parent_kind &&
    currentSlot.parent_id === item.to_parent_id
  ) {
    throw new AemsError(
      "AE012",
      `Target parent yang dipilih sudah menjadi parent aktif dari ${eq.equipment_no} saat ini (AE012).`,
      409,
    );
  }

  let toParentNo: string | null = null;
  let toRootAssetId: string | null = null;
  let toRootAssetNo: string | null = null;
  let targetParentDepth = 0;

  if (item.to_parent_kind === "ASSET") {
    const targetAsset = state.assets.find(
      (a) => a.id === item.to_parent_id && a.deleted_at === null,
    );
    if (!targetAsset || targetAsset.status !== "ACTIVE") {
      throw new AemsError(
        "AE011",
        "Target Aset tidak ditemukan atau berstatus tidak aktif (AE011).",
        409,
      );
    }
    toParentNo = targetAsset.sap_asset_no;
    toRootAssetId = targetAsset.id;
    toRootAssetNo = targetAsset.sap_asset_no;
    targetParentDepth = 0;
  } else {
    // Target is EQUIPMENT
    if (item.to_parent_id === eq.id) {
      throw new AemsError(
        "AE001",
        `Perubahan ditolak karena membentuk hierarki melingkar: ${eq.equipment_no} tidak boleh menjadi parent bagi dirinya sendiri (AE001).`,
        409,
        { equipment_no: eq.equipment_no, target_parent_no: eq.equipment_no },
      );
    }

    const targetEq = state.equipment.find(
      (e) => e.id === item.to_parent_id && e.deleted_at === null,
    );
    if (!targetEq || targetEq.status !== "ACTIVE") {
      throw new AemsError(
        "AE011",
        "Target Equipment parent tidak ditemukan atau berstatus tidak aktif (AE011).",
        409,
      );
    }

    // Check cycle (BR-HR-04, AE001): targetEq must not be in descendants of eq
    if (descendants.some((d) => d.id === targetEq.id)) {
      throw new AemsError(
        "AE001",
        `Perubahan ditolak karena membentuk hierarki melingkar: ${targetEq.equipment_no} adalah turunan dari ${eq.equipment_no} (AE001).`,
        409,
        {
          equipment_no: eq.equipment_no,
          target_parent_no: targetEq.equipment_no,
        },
      );
    }

    toParentNo = targetEq.equipment_no;
    const resolvedTarget = resolveEffectiveRootAssetId(targetEq.id, state);
    toRootAssetId = resolvedTarget.rootAssetId;
    if (toRootAssetId) {
      toRootAssetNo =
        state.assets.find((a) => a.id === toRootAssetId)?.sap_asset_no || null;
    }
    targetParentDepth =
      resolvedTarget.depth > 0
        ? resolvedTarget.depth
        : resolvedTarget.pathIds.length;
  }

  const newMaxDepth = targetParentDepth + 1 + subtreeHeight;
  if (newMaxDepth > maxDepth) {
    throw new AemsError(
      "AE002",
      `Kedalaman hierarki (${newMaxDepth}) melebihi batas maksimum sistem (${maxDepth} tingkat) (AE002).`,
      409,
      { new_depth: newMaxDepth, max_depth: maxDepth },
    );
  }

  return {
    equipment_id: eq.id,
    equipment_no: eq.equipment_no,
    equipment_name: eq.name,
    action_type: currentSlot ? "MOVE" : "LINK",
    from_parent_kind: currentSlot?.parent_kind || null,
    from_parent_id: currentSlot?.parent_id || null,
    from_parent_no: fromParentNo,
    from_root_asset_id: fromRootAsset?.id || null,
    from_root_asset_no: fromRootAsset?.sap_asset_no || null,
    to_parent_kind: item.to_parent_kind,
    to_parent_id: item.to_parent_id,
    to_parent_no: toParentNo,
    to_root_asset_id: toRootAssetId,
    to_root_asset_no: toRootAssetNo,
    descendant_count: descendants.length,
    descendant_nos: descendants.map((d) => d.equipment_no),
    new_max_depth: newMaxDepth,
    valid: true,
  };
}

/**
 * Low-level atomic application of a single mapping link change within a transaction.
 * Mirrors PostgreSQL `fn_apply_link_change` (Bab 14.6 Gambar 18 & Bab 19.4).
 */
function applyLinkChangeInternal(
  state: AemsDatabaseState,
  preview: MappingImpactPreview,
  actor: Profile,
  approver: Profile,
  reason: string,
  changeRequestId: string | null,
  requestCode: string | null,
  effectiveAt: string,
): void {
  const eq = state.equipment.find((e) => e.id === preview.equipment_id)!;

  // Step 1: Close old active relationship and delete old slot if present
  const oldSlotIdx = state.equipment_active_parent.findIndex(
    (p) => p.equipment_id === eq.id,
  );
  if (oldSlotIdx !== -1) {
    const oldSlot = state.equipment_active_parent[oldSlotIdx];
    if (oldSlot.parent_kind === "ASSET") {
      const aem = state.asset_equipment_mappings.find(
        (m) => m.id === oldSlot.link_id && m.valid_to === null,
      );
      if (aem) {
        aem.valid_to = effectiveAt;
        aem.end_reason = preview.action_type;
        aem.ended_by = approver.id;
      }
    } else {
      const er = state.equipment_relationships.find(
        (r) => r.id === oldSlot.link_id && r.valid_to === null,
      );
      if (er) {
        er.valid_to = effectiveAt;
        er.end_reason = preview.action_type;
        er.ended_by = approver.id;
      }
    }
    state.equipment_active_parent.splice(oldSlotIdx, 1);
  }

  // Step 2: Open new active relationship and insert new slot if LINK or MOVE
  if (
    preview.action_type !== "UNLINK" &&
    preview.to_parent_kind &&
    preview.to_parent_id
  ) {
    // Enforce PK uniqueness on equipment_active_parent (AE003)
    if (state.equipment_active_parent.some((p) => p.equipment_id === eq.id)) {
      throw new AemsError(
        "AE003",
        `Pelanggaran constraint slot parent aktif pada ${eq.equipment_no} (AE003).`,
        409,
      );
    }

    const newLinkId = crypto.randomUUID();
    if (preview.to_parent_kind === "ASSET") {
      state.asset_equipment_mappings.push({
        id: newLinkId,
        asset_id: preview.to_parent_id,
        equipment_id: eq.id,
        valid_from: effectiveAt,
        valid_to: null,
        end_reason: null,
        change_request_id: changeRequestId,
        created_by: approver.id,
        ended_by: null,
      });
    } else {
      state.equipment_relationships.push({
        id: newLinkId,
        parent_equipment_id: preview.to_parent_id,
        child_equipment_id: eq.id,
        valid_from: effectiveAt,
        valid_to: null,
        end_reason: null,
        change_request_id: changeRequestId,
        created_by: approver.id,
        ended_by: null,
      });
    }

    state.equipment_active_parent.push({
      equipment_id: eq.id,
      parent_kind: preview.to_parent_kind,
      parent_id: preview.to_parent_id,
      link_id: newLinkId,
    });
  }

  // Step 3: Recompute root_asset_id, depth, and path_ids for eq and its entire moved subtree!
  recomputeSubtreeCache(eq.id, state);

  // Step 4: Append immutable mapping_history entry (BR-MP-05)
  const eventType =
    preview.action_type === "UNLINK"
      ? "UNLINK"
      : preview.action_type === "MOVE"
        ? "MOVE"
        : preview.to_parent_kind === "ASSET"
          ? "LINK_ASSET"
          : "LINK_EQUIPMENT";

  state.mapping_history.unshift({
    id: crypto.randomUUID(),
    equipment_id: eq.id,
    equipment_no: eq.equipment_no,
    equipment_name: eq.name,
    event_type: eventType,
    change_request_id: changeRequestId,
    request_code: requestCode,
    from_parent_kind: preview.from_parent_kind,
    from_parent_id: preview.from_parent_id,
    from_parent_no: preview.from_parent_no,
    to_parent_kind: preview.to_parent_kind,
    to_parent_id: preview.to_parent_id,
    to_parent_no: preview.to_parent_no,
    from_asset_id: preview.from_root_asset_id,
    from_asset_no: preview.from_root_asset_no,
    to_asset_id: preview.to_root_asset_id,
    to_asset_no: preview.to_root_asset_no,
    actor_id: actor.id,
    actor_name: actor.full_name,
    approved_by: approver.id,
    approver_name: approver.full_name,
    reason,
    occurred_at: effectiveAt,
  });

  // Auto-resolve any open UNMAPPED_EQUIPMENT reconciliation finding if equipment now has a root asset
  if (preview.to_root_asset_id) {
    for (const f of state.reconciliation_findings) {
      if (
        f.entity_id === eq.id &&
        f.finding_type === "UNMAPPED_EQUIPMENT" &&
        f.status === "OPEN"
      ) {
        f.status = "RESOLVED";
        f.resolution_note = `Terhubung ke aset ${preview.to_root_asset_no} melalui ${requestCode || "mapping"}`;
        f.resolved_by = approver.id;
        f.resolver_name = approver.full_name;
        f.resolved_at = effectiveAt;
      }
    }
  }
}

/**
 * Submits a mapping change request (`fn_submit_mapping_request`).
 * Validates all items on submission (BR-MP-03).
 * If `applyImmediately` is true and actor is ADMIN (and maker-checker allows direct Admin apply per A-03),
 * applies the changes in the same transaction.
 */
export function submitMappingRequest(
  actor: Profile,
  input: {
    items: Array<{
      equipment_id: string;
      action_type?: "LINK" | "MOVE" | "UNLINK";
      to_parent_kind?: ParentKind | null;
      to_parent_id?: string | null;
    }>;
    reason: string;
    effective_at?: string;
    batch_id?: string | null;
    apply_immediately?: boolean;
  },
): MappingChangeRequest {
  if (!hasPermission(actor, "mapping:request")) {
    throw new AemsError(
      "FORBIDDEN",
      "Role Anda tidak memiliki wewenang mengajukan perubahan mapping.",
      403,
    );
  }

  const state = getAemsState();
  const previews: MappingImpactPreview[] = [];
  const seenEquipmentIds = new Set<string>();

  for (const item of input.items) {
    if (seenEquipmentIds.has(item.equipment_id)) {
      throw new AemsError(
        "VALIDATION",
        "Satu equipment tidak boleh muncul lebih dari satu kali dalam pengajuan yang sama.",
        400,
      );
    }
    seenEquipmentIds.add(item.equipment_id);
    const preview = validateAndPreviewMappingItem(item, {
      checkOpenRequests: true,
      state,
    });
    previews.push(preview);
  }

  const nextNum = state.mapping_change_requests.length + 13;
  const reqCode = `CR-${String(nextNum).padStart(4, "0")}`;
  const reqId = crypto.randomUUID();
  const now = new Date().toISOString();
  const effectiveAt = input.effective_at || now;

  const requestType = previews.length > 1 ? "BATCH" : previews[0].action_type;

  const changeItems: MappingChangeItem[] = previews.map((p) => ({
    id: crypto.randomUUID(),
    change_request_id: reqId,
    equipment_id: p.equipment_id,
    equipment_no: p.equipment_no,
    equipment_name: p.equipment_name,
    action_type: p.action_type,
    from_parent_kind: p.from_parent_kind,
    from_parent_id: p.from_parent_id,
    from_parent_no: p.from_parent_no,
    from_root_asset_id: p.from_root_asset_id,
    from_root_asset_no: p.from_root_asset_no,
    to_parent_kind: p.to_parent_kind,
    to_parent_id: p.to_parent_id,
    to_parent_no: p.to_parent_no,
    to_root_asset_id: p.to_root_asset_id,
    to_root_asset_no: p.to_root_asset_no,
    descendant_count: p.descendant_count,
    status: "OPEN",
  }));

  const newRequest: MappingChangeRequest = {
    id: reqId,
    request_code: reqCode,
    request_type: requestType,
    status: "SUBMITTED",
    requested_by: actor.id,
    requester_name: actor.full_name,
    requester_role: actor.role!,
    reviewed_by: null,
    reviewer_name: null,
    reason: input.reason.trim(),
    review_note: null,
    effective_at: effectiveAt,
    batch_id: input.batch_id ?? null,
    created_at: now,
    reviewed_at: null,
    items: changeItems,
  };

  const isFirstLinkOnly = previews.every((p) => p.action_type === "LINK");
  const shouldApplyDirect =
    isFirstLinkOnly ||
    actor.role === "ADMIN" ||
    actor.account_level === "MANAGER";
  const canAutoApplyFirstLink = isFirstLinkOnly;
  if (!shouldApplyDirect) {
    const manager = state.profiles.find(
      (p) =>
        p.id === actor.manager_id &&
        p.is_active &&
        p.role === actor.role &&
        p.account_level === "MANAGER",
    );
    if (!manager)
      throw new AemsError(
        "VALIDATION",
        "Atasan manajer belum ditetapkan atau tidak aktif. Hubungi Admin untuk mengatur Organisasi.",
      );
    newRequest.approver_id = manager.id;
  }

  if (shouldApplyDirect) {
    for (let i = 0; i < previews.length; i++) {
      applyLinkChangeInternal(
        state,
        previews[i],
        actor,
        actor,
        newRequest.reason,
        reqId,
        reqCode,
        effectiveAt,
      );
      newRequest.items[i].status = "APPLIED";
    }
    newRequest.status = "APPLIED";
    newRequest.reviewed_by = actor.id;
    newRequest.reviewer_name = actor.full_name;
    newRequest.review_note = canAutoApplyFirstLink
      ? "Diterapkan otomatis sesuai kebijakan LINK pertama"
      : "Diterapkan langsung oleh Manajer/Administrator";
    newRequest.reviewed_at = now;
  }

  state.mapping_change_requests.unshift(newRequest);

  appendAuditLog(
    state,
    actor,
    "MAPPING_REQUEST",
    newRequest.id,
    newRequest.request_code,
    shouldApplyDirect ? "SUBMIT_AND_APPLY" : "SUBMIT_REQUEST",
    null,
    {
      request_code: newRequest.request_code,
      request_type: newRequest.request_type,
      status: newRequest.status,
      items_count: newRequest.items.length,
    },
    ["status"],
    input.batch_id ?? null,
  );

  return newRequest;
}

/**
 * Approves or rejects a submitted mapping request (`fn_decide_request`, Bab 14.6, 19.4).
 * Enforces:
 * - Only ADMIN can approve/reject (BR-MP-02)
 * - Maker-checker: requester cannot approve their own request when maker_checker is enabled (A-04, BR-MP-02)
 * - Advisory lock & full revalidation on approval; if state changed and validation fails, marks FAILED_VALIDATION (Gambar 11 & 12)
 */
export function decideMappingRequest(
  actor: Profile,
  requestId: string,
  decision: "APPROVE" | "REJECT",
  reviewNote: string,
): MappingChangeRequest {
  if (!hasPermission(actor, "mapping:approve")) {
    throw new AemsError(
      "FORBIDDEN",
      "Hanya Manajer yang ditunjuk atau Administrator dapat meninjau pengajuan.",
      403,
    );
  }

  const state = getAemsState();
  const req = state.mapping_change_requests.find((r) => r.id === requestId);
  if (!req) {
    throw new AemsError("NOT_FOUND", "Pengajuan mapping tidak ditemukan.", 404);
  }

  if (req.requested_by === actor.id)
    throw new AemsError(
      "MAKER_CHECKER_VIOLATION",
      "Prinsip Maker-Checker: Pemohon tidak dapat meninjau pengajuan sendiri.",
      403,
    );
  if (
    actor.role !== "ADMIN" &&
    (req.approver_id !== actor.id ||
      state.profiles.find((p) => p.id === req.requested_by)?.role !==
        actor.role)
  )
    throw new AemsError(
      "FORBIDDEN",
      "Pengajuan ini bukan kewenangan manajer Anda.",
      403,
    );

  if (req.status !== "SUBMITTED") {
    throw new AemsError(
      "VALIDATION",
      `Pengajuan ${req.request_code} sudah berstatus ${req.status} dan tidak dapat diproses ulang.`,
      409,
    );
  }

  // Maker-Checker enforcement (A-04, BR-MP-02)
  if (
    decision === "APPROVE" &&
    state.app_settings.hierarchy.maker_checker &&
    req.requested_by === actor.id
  ) {
    throw new AemsError(
      "MAKER_CHECKER_VIOLATION",
      "Prinsip Maker-Checker: Pemohon tidak diperbolehkan menyetujui pengajuannya sendiri.",
      403,
      { request_code: req.request_code, requested_by: req.requested_by },
    );
  }

  const now = new Date().toISOString();

  if (decision === "REJECT") {
    req.status = "REJECTED";
    req.reviewed_by = actor.id;
    req.reviewer_name = actor.full_name;
    req.review_note = reviewNote.trim();
    req.reviewed_at = now;
    for (const item of req.items) {
      item.status = "REJECTED";
    }

    appendAuditLog(
      state,
      actor,
      "MAPPING_REQUEST",
      req.id,
      req.request_code,
      "REJECT_REQUEST",
      { status: "SUBMITTED" },
      { status: "REJECTED", review_note: req.review_note },
      ["status", "review_note"],
    );
    return req;
  }

  // Acquire simulated advisory lock for hierarchy mutations
  if (globalForAems.__aemsHierarchyLock) {
    throw new AemsError(
      "VERSION_CONFLICT",
      "Perubahan struktur hierarki lain sedang berlangsung. Silakan coba sesaat lagi.",
      409,
    );
  }

  globalForAems.__aemsHierarchyLock = true;
  try {
    // Revalidate all items against current live database state (BR-MP-03)
    const validatedPreviews: MappingImpactPreview[] = [];
    try {
      for (const item of req.items) {
        const p = validateAndPreviewMappingItem(
          {
            equipment_id: item.equipment_id,
            action_type: item.action_type,
            to_parent_kind: item.to_parent_kind,
            to_parent_id: item.to_parent_id,
          },
          { ignoreOpenRequestId: req.id, checkOpenRequests: false, state },
        );
        validatedPreviews.push(p);
      }
    } catch (validationErr) {
      // Gambar 11 & 12: Transition to FAILED_VALIDATION if underlying hierarchy changed
      const errMsg =
        validationErr instanceof Error
          ? validationErr.message
          : "Gagal validasi ulang saat penerapan";
      req.status = "FAILED_VALIDATION";
      req.reviewed_by = actor.id;
      req.reviewer_name = actor.full_name;
      req.review_note = `${reviewNote.trim()} — [Validasi Ulang Gagal: ${errMsg}]`;
      req.reviewed_at = now;
      for (const item of req.items) {
        item.status = "FAILED_VALIDATION";
      }

      appendAuditLog(
        state,
        actor,
        "MAPPING_REQUEST",
        req.id,
        req.request_code,
        "FAILED_VALIDATION",
        { status: "SUBMITTED" },
        { status: "FAILED_VALIDATION", reason: errMsg },
        ["status", "review_note"],
      );

      throw validationErr;
    }

    // Apply all items atomically
    const requesterProfile: Profile = state.profiles.find(
      (p) => p.id === req.requested_by,
    ) || {
      id: req.requested_by,
      email: "",
      full_name: req.requester_name,
      role: req.requester_role,
      is_active: true,
      department: null,
      last_login_at: null,
      created_at: now,
      updated_at: now,
    };

    for (let i = 0; i < validatedPreviews.length; i++) {
      applyLinkChangeInternal(
        state,
        validatedPreviews[i],
        requesterProfile,
        actor,
        req.reason,
        req.id,
        req.request_code,
        now,
      );
      req.items[i].status = "APPLIED";
    }

    req.status = "APPLIED";
    req.reviewed_by = actor.id;
    req.reviewer_name = actor.full_name;
    req.review_note = reviewNote.trim();
    req.reviewed_at = now;

    appendAuditLog(
      state,
      actor,
      "MAPPING_REQUEST",
      req.id,
      req.request_code,
      "APPROVE_AND_APPLY",
      { status: "SUBMITTED" },
      { status: "APPLIED", review_note: req.review_note },
      ["status", "review_note"],
    );

    return req;
  } finally {
    globalForAems.__aemsHierarchyLock = false;
  }
}

export function cancelMappingRequest(
  actor: Profile,
  requestId: string,
): MappingChangeRequest {
  const state = getAemsState();
  const req = state.mapping_change_requests.find((r) => r.id === requestId);
  if (!req) {
    throw new AemsError("NOT_FOUND", "Pengajuan mapping tidak ditemukan.", 404);
  }
  if (req.requested_by !== actor.id && actor.role !== "ADMIN") {
    throw new AemsError(
      "FORBIDDEN",
      "Anda hanya dapat membatalkan pengajuan milik Anda sendiri.",
      403,
    );
  }
  if (req.status !== "SUBMITTED" && req.status !== "DRAFT") {
    throw new AemsError(
      "VALIDATION",
      `Pengajuan berstatus ${req.status} tidak dapat dibatalkan.`,
      409,
    );
  }

  req.status = "CANCELLED";
  for (const item of req.items) {
    item.status = "CANCELLED";
  }

  appendAuditLog(
    state,
    actor,
    "MAPPING_REQUEST",
    req.id,
    req.request_code,
    "CANCEL_REQUEST",
    { status: "SUBMITTED" },
    { status: "CANCELLED" },
    ["status"],
  );

  return req;
}

// -----------------------------------------------------------------------------
// Excel Import Staging, Duplicate Detection, Replace/Skip, and Atomic Commit (Bab 18)
// -----------------------------------------------------------------------------

export function createAndValidateImportBatch(
  actor: Profile,
  input: {
    import_type: ImportType;
    file_name: string;
    file_sha256: string;
    raw_rows: Array<Record<string, unknown>>;
    column_map?: Record<string, string>;
    commit_mode?: CommitMode;
    default_action?: DuplicateDecision;
    idempotency_key?: string;
  },
): ImportBatchRecord {
  if (!canRunImportType(actor, input.import_type)) {
    throw new AemsError(
      "FORBIDDEN",
      `Role ${actor.role} tidak memiliki wewenang menjalankan import jenis ${input.import_type}.`,
      403,
    );
  }

  const state = getAemsState();

  // Check duplicate active batch with same SHA-256 by same user (Table 59 Stage 1)
  const existingActiveBatch = state.import_batches.find(
    (b) =>
      b.uploaded_by === actor.id &&
      b.import_type === input.import_type &&
      b.file_sha256 === input.file_sha256 &&
      [
        "UPLOADED",
        "PARSING",
        "VALIDATING",
        "READY_FOR_REVIEW",
        "READY",
        "COMMITTING",
      ].includes(b.status),
  );
  if (existingActiveBatch) {
    throw new AemsError(
      "BATCH_ALREADY_COMMITTED",
      `Berkas yang identik sedang dalam proses pada batch ${existingActiveBatch.id.slice(0, 8)}.`,
      409,
      { batch_id: existingActiveBatch.id },
    );
  }

  if (input.raw_rows.length > state.app_settings.imports.max_rows) {
    throw new AemsError(
      "FILE_INVALID",
      `Jumlah baris (${input.raw_rows.length}) melebihi batas maksimum ${state.app_settings.imports.max_rows} baris per berkas.`,
      413,
    );
  }

  const batchId = crypto.randomUUID();
  const defaultAction: DuplicateDecision = input.default_action || "SKIP";
  // Table 61: ATOMIC is mandatory for MAPPING imports
  const commitMode: CommitMode =
    input.import_type === "MAPPING" ? "ATOMIC" : input.commit_mode || "ATOMIC";

  const normOpts = {
    padNumeric: state.app_settings.normalization.pad_numeric_sap_asset,
    padLength: state.app_settings.normalization.sap_asset_pad_length,
  };

  const stagedRows: ImportRowRecord[] = [];
  const seenKeysInFile = new Map<string, number>();

  // For MAPPING imports, also track parent graph within the file to detect intra-file cycles (BR-IM-09)
  const fileMappingEdges = new Map<string, string>(); // childEqNorm -> parentEqNorm

  for (let idx = 0; idx < input.raw_rows.length; idx++) {
    const rowNumber = idx + 2; // Excel row number (header is row 1)
    const raw = input.raw_rows[idx];

    // Map columns using column_map if provided, otherwise direct keys
    const mapped: Record<string, unknown> = {};
    if (input.column_map && Object.keys(input.column_map).length > 0) {
      for (const [targetField, excelCol] of Object.entries(input.column_map)) {
        if (excelCol && raw[excelCol] !== undefined) {
          mapped[targetField] = raw[excelCol];
        }
      }
    } else {
      Object.assign(mapped, raw);
    }

    const errors: Array<{ code: string; field?: string; message: string }> = [];
    let keyNorm = "";
    let displayKey = "";
    let matchStatus: ImportRowRecord["match_status"] = "NEW";
    let action: ImportRowRecord["action"] = "INSERT";
    const diff: Record<string, { old: unknown; new: unknown }> = {};
    let baseRowVersion: number | null = null;

    if (input.import_type === "ASSET_MASTER") {
      const companyCode = String(
        mapped.company_code ||
          state.app_settings.normalization.default_company_code,
      ).trim();
      const sapAssetNo = String(mapped.sap_asset_no ?? "").trim();
      const sapSubNo = String(
        mapped.sap_sub_no || state.app_settings.normalization.default_sub_no,
      ).trim();
      const name = String(mapped.name ?? "").trim();

      if (!sapAssetNo) {
        errors.push({
          code: "REQUIRED",
          field: "sap_asset_no",
          message: "Nomor aset SAP wajib diisi",
        });
      }
      if (!name) {
        errors.push({
          code: "REQUIRED",
          field: "name",
          message: "Nama aset wajib diisi",
        });
      }

      keyNorm = buildAssetCompositeKey(
        companyCode,
        sapAssetNo,
        sapSubNo,
        normOpts,
      );
      displayKey = sapAssetNo || "(kosong)";

      if (sapAssetNo) {
        const firstSeenRow = seenKeysInFile.get(keyNorm);
        if (firstSeenRow !== undefined) {
          matchStatus = "DUPLICATE_IN_FILE";
          errors.push({
            code: "DUPLICATE_IN_FILE",
            field: "sap_asset_no",
            message: `Duplikat nomor aset di dalam file yang sama (sama dengan baris ${firstSeenRow})`,
          });
        } else {
          seenKeysInFile.set(keyNorm, rowNumber);
        }
      }

      // Validate optional category_code & location_code
      if (mapped.category_code) {
        const catCode = normalizeKey(String(mapped.category_code));
        const cat = state.asset_categories.find(
          (c) =>
            normalizeKey(c.code) === catCode ||
            normalizeKey(c.name) === catCode,
        );
        if (!cat) {
          errors.push({
            code: "INVALID_REF",
            field: "category_code",
            message: `Kategori aset '${mapped.category_code}' tidak ditemukan`,
          });
        } else {
          mapped.asset_category_id = cat.id;
        }
      }

      if (mapped.location_code) {
        const locCode = normalizeKey(String(mapped.location_code));
        const loc = state.locations.find(
          (l) =>
            normalizeKey(l.code) === locCode ||
            normalizeKey(l.name) === locCode,
        );
        if (!loc) {
          errors.push({
            code: "INVALID_REF",
            field: "location_code",
            message: `Lokasi '${mapped.location_code}' tidak ditemukan`,
          });
        } else {
          mapped.location_id = loc.id;
        }
      }

      if (errors.length === 0) {
        const existingAsset = state.assets.find(
          (a) =>
            buildAssetCompositeKey(
              a.company_code,
              a.sap_asset_no,
              a.sap_sub_no,
              normOpts,
            ) === keyNorm,
        );
        if (existingAsset) {
          baseRowVersion = existingAsset.row_version;
          // Compare mapped fields against existingAsset (A-08: blank cells do not overwrite unless configured)
          const compareFields: Array<{ key: keyof Asset; label: string }> = [
            { key: "name", label: "Nama" },
            { key: "description", label: "Deskripsi" },
            { key: "asset_category_id", label: "Kategori" },
            { key: "location_id", label: "Lokasi" },
            { key: "cost_center", label: "Cost Center" },
            { key: "acquisition_value", label: "Nilai Perolehan" },
            { key: "status", label: "Status" },
          ];

          for (const cf of compareFields) {
            const rawVal = mapped[cf.key];
            const isBlank =
              rawVal === undefined ||
              rawVal === null ||
              String(rawVal).trim() === "";
            if (isBlank && !state.app_settings.imports.blank_overwrites) {
              continue;
            }
            const normalizedNewVal =
              cf.key === "acquisition_value" &&
              rawVal !== undefined &&
              rawVal !== ""
                ? Number(rawVal)
                : rawVal;
            if (
              normalizedNewVal !== undefined &&
              String(normalizedNewVal) !== String(existingAsset[cf.key] ?? "")
            ) {
              diff[cf.key] = {
                old: existingAsset[cf.key],
                new: normalizedNewVal,
              };
            }
          }

          if (Object.keys(diff).length === 0) {
            // BR-IM-05: Identical rows automatically become SKIP
            matchStatus = "IDENTICAL";
            action = "SKIP";
          } else {
            matchStatus = "DUPLICATE_DIFF";
            action = defaultAction;
          }
        }
      }
    } else if (input.import_type === "EQUIPMENT_MASTER") {
      const sourceSystem = String(
        mapped.source_system ||
          state.app_settings.normalization.default_source_system,
      ).trim();
      const eqNo = String(mapped.equipment_no ?? "").trim();
      const name = String(mapped.name ?? "").trim();
      const kind = String(mapped.kind || "OTHER")
        .trim()
        .toUpperCase();

      if (!eqNo) {
        errors.push({
          code: "REQUIRED",
          field: "equipment_no",
          message: "Nomor equipment wajib diisi",
        });
      }
      if (!name) {
        errors.push({
          code: "REQUIRED",
          field: "name",
          message: "Nama equipment wajib diisi",
        });
      }
      if (!["WHOLE_UNIT", "COMPONENT", "OTHER"].includes(kind)) {
        errors.push({
          code: "INVALID_ENUM",
          field: "kind",
          message: `Jenis equipment '${kind}' tidak valid (gunakan WHOLE_UNIT, COMPONENT, atau OTHER)`,
        });
      } else {
        mapped.kind = kind;
      }

      keyNorm = buildEquipmentCompositeKey(sourceSystem, eqNo);
      displayKey = eqNo || "(kosong)";

      if (eqNo) {
        const firstSeenRow = seenKeysInFile.get(keyNorm);
        if (firstSeenRow !== undefined) {
          matchStatus = "DUPLICATE_IN_FILE";
          errors.push({
            code: "DUPLICATE_IN_FILE",
            field: "equipment_no",
            message: `Duplikat nomor equipment di dalam file yang sama (sama dengan baris ${firstSeenRow})`,
          });
        } else {
          seenKeysInFile.set(keyNorm, rowNumber);
        }
      }

      if (mapped.location_code) {
        const locCode = normalizeKey(String(mapped.location_code));
        const loc = state.locations.find(
          (l) =>
            normalizeKey(l.code) === locCode ||
            normalizeKey(l.name) === locCode,
        );
        if (!loc) {
          errors.push({
            code: "INVALID_REF",
            field: "location_code",
            message: `Lokasi '${mapped.location_code}' tidak ditemukan`,
          });
        } else {
          mapped.location_id = loc.id;
        }
      }

      if (errors.length === 0) {
        const existingEq = state.equipment.find(
          (e) =>
            buildEquipmentCompositeKey(e.source_system, e.equipment_no) ===
            keyNorm,
        );
        if (existingEq) {
          baseRowVersion = existingEq.row_version;
          const compareFields: Array<{ key: keyof Equipment; label: string }> =
            [
              { key: "name", label: "Nama" },
              { key: "kind", label: "Jenis" },
              { key: "specification", label: "Spesifikasi" },
              { key: "serial_no", label: "Serial No" },
              { key: "condition", label: "Kondisi" },
              { key: "location_id", label: "Lokasi" },
              { key: "status", label: "Status" },
            ];

          for (const cf of compareFields) {
            const rawVal = mapped[cf.key];
            const isBlank =
              rawVal === undefined ||
              rawVal === null ||
              String(rawVal).trim() === "";
            if (isBlank && !state.app_settings.imports.blank_overwrites) {
              continue;
            }
            if (
              rawVal !== undefined &&
              String(rawVal) !== String(existingEq[cf.key] ?? "")
            ) {
              diff[cf.key] = {
                old: existingEq[cf.key],
                new: rawVal,
              };
            }
          }

          if (Object.keys(diff).length === 0) {
            matchStatus = "IDENTICAL";
            action = "SKIP";
          } else {
            matchStatus = "DUPLICATE_DIFF";
            action = defaultAction;
          }
        }
      }
    } else if (input.import_type === "MAPPING") {
      const eqNo = String(mapped.equipment_no ?? "").trim();
      const parentType = String(mapped.parent_type ?? "")
        .trim()
        .toUpperCase();
      const parentNo = String(mapped.parent_no ?? "").trim();

      keyNorm = normalizeKey(eqNo);
      displayKey = eqNo || "(kosong)";

      if (!eqNo) {
        errors.push({
          code: "REQUIRED",
          field: "equipment_no",
          message: "equipment_no wajib diisi",
        });
      }
      if (!["ASSET", "EQUIPMENT"].includes(parentType)) {
        errors.push({
          code: "INVALID_ENUM",
          field: "parent_type",
          message: "parent_type wajib bernilai ASSET atau EQUIPMENT",
        });
      }
      if (!parentNo) {
        errors.push({
          code: "REQUIRED",
          field: "parent_no",
          message: "parent_no wajib diisi",
        });
      }

      if (eqNo) {
        const firstSeenRow = seenKeysInFile.get(keyNorm);
        if (firstSeenRow !== undefined) {
          matchStatus = "DUPLICATE_IN_FILE";
          errors.push({
            code: "DUPLICATE_IN_FILE",
            field: "equipment_no",
            message: `Satu equipment (${eqNo}) hanya boleh memiliki satu parent di dalam file import (baris ${firstSeenRow}) (BR-IM-09)`,
          });
        } else {
          seenKeysInFile.set(keyNorm, rowNumber);
        }
      }

      if (errors.length === 0) {
        const eq = state.equipment.find(
          (e) => e.equipment_key_norm === keyNorm && e.deleted_at === null,
        );
        if (!eq || eq.status !== "ACTIVE") {
          errors.push({
            code: "AE010",
            field: "equipment_no",
            message: `Equipment '${eqNo}' tidak ditemukan atau tidak aktif (AE010)`,
          });
        } else {
          mapped.equipment_id = eq.id;
          const parentNorm = normalizeKey(parentNo);

          if (parentType === "ASSET") {
            const targetAsset = state.assets.find(
              (a) => a.asset_key_norm === parentNorm && a.deleted_at === null,
            );
            if (!targetAsset || targetAsset.status !== "ACTIVE") {
              errors.push({
                code: "AE011",
                field: "parent_no",
                message: `Aset '${parentNo}' tidak ditemukan atau tidak aktif (AE011)`,
              });
            } else {
              mapped.to_parent_kind = "ASSET";
              mapped.to_parent_id = targetAsset.id;
            }
          } else {
            if (parentNorm === keyNorm) {
              errors.push({
                code: "AE001",
                field: "parent_no",
                message: `Hierarki melingkar: ${eqNo} tidak boleh menjadi parent bagi dirinya sendiri (AE001)`,
              });
            } else {
              const targetEq = state.equipment.find(
                (e) =>
                  e.equipment_key_norm === parentNorm && e.deleted_at === null,
              );
              if (!targetEq || targetEq.status !== "ACTIVE") {
                errors.push({
                  code: "AE011",
                  field: "parent_no",
                  message: `Equipment parent '${parentNo}' tidak ditemukan atau tidak aktif (AE011)`,
                });
              } else {
                mapped.to_parent_kind = "EQUIPMENT";
                mapped.to_parent_id = targetEq.id;
                fileMappingEdges.set(keyNorm, parentNorm);
              }
            }
          }

          if (errors.length === 0 && mapped.to_parent_id) {
            try {
              const preview = validateAndPreviewMappingItem(
                {
                  equipment_id: eq.id,
                  to_parent_kind: mapped.to_parent_kind as ParentKind,
                  to_parent_id: mapped.to_parent_id as string,
                },
                { state },
              );
              if (preview.from_parent_no) {
                matchStatus = "DUPLICATE_DIFF";
                action = defaultAction;
                diff.parent = {
                  old: `${preview.from_parent_kind}: ${preview.from_parent_no}`,
                  new: `${preview.to_parent_kind}: ${preview.to_parent_no}`,
                };
              }
            } catch (err) {
              if (err instanceof AemsError) {
                if (err.code === "AE012") {
                  matchStatus = "IDENTICAL";
                  action = "SKIP";
                } else {
                  errors.push({
                    code: err.code,
                    field: "parent_no",
                    message: err.message,
                  });
                }
              }
            }
          }
        }
      }
    }

    const validationStatus = errors.length > 0 ? "INVALID" : "VALID";
    if (validationStatus === "INVALID") {
      action = "NONE";
    }

    stagedRows.push({
      id: crypto.randomUUID(),
      batch_id: batchId,
      row_number: rowNumber,
      raw_data: raw,
      mapped_data: mapped,
      key_norm: keyNorm,
      display_key: displayKey,
      validation_status: validationStatus,
      errors,
      match_status: matchStatus,
      action,
      diff,
      base_row_version: baseRowVersion,
      result_status: null,
      result_message: null,
    });
  }

  // Second pass for MAPPING imports: detect cycles across rows in the same file (BR-IM-09)
  if (input.import_type === "MAPPING" && fileMappingEdges.size > 0) {
    for (const row of stagedRows) {
      if (row.validation_status !== "VALID") continue;
      const startKey = row.key_norm;
      const visited = new Set<string>([startKey]);
      let curr = fileMappingEdges.get(startKey);
      while (curr) {
        if (visited.has(curr)) {
          row.validation_status = "INVALID";
          row.action = "NONE";
          row.errors.push({
            code: "AE001",
            field: "parent_no",
            message: `Siklus hierarki antar-baris terdeteksi di dalam file import melibatkan ${startKey} dan ${curr} (AE001 / BR-IM-09)`,
          });
          break;
        }
        visited.add(curr);
        curr = fileMappingEdges.get(curr);
      }
    }
  }

  const newCount = stagedRows.filter(
    (r) => r.validation_status === "VALID" && r.match_status === "NEW",
  ).length;
  const dupCount = stagedRows.filter(
    (r) =>
      r.validation_status === "VALID" && r.match_status === "DUPLICATE_DIFF",
  ).length;
  const identicalCount = stagedRows.filter(
    (r) => r.validation_status === "VALID" && r.match_status === "IDENTICAL",
  ).length;
  const invalidCount = stagedRows.filter(
    (r) => r.validation_status === "INVALID",
  ).length;

  const batch: ImportBatchRecord = {
    id: batchId,
    import_type: input.import_type,
    source_type: "EXCEL",
    file_name: input.file_name,
    file_sha256: input.file_sha256,
    idempotency_key: input.idempotency_key ?? null,
    status: "READY_FOR_REVIEW",
    commit_mode: commitMode,
    default_action: defaultAction,
    column_map: input.column_map || {},
    total_count: stagedRows.length,
    new_count: newCount,
    dup_count: dupCount,
    identical_count: identicalCount,
    invalid_count: invalidCount,
    inserted_count: 0,
    replaced_count: 0,
    skipped_count: 0,
    failed_count: 0,
    uploaded_by: actor.id,
    uploader_name: actor.full_name,
    uploader_role: actor.role!,
    started_at: new Date().toISOString(),
    finished_at: null,
    rows: stagedRows,
  };

  state.import_batches.unshift(batch);
  return batch;
}

/**
 * Updates per-row or global Skip/Replace decisions on a staged batch (FR-IMP-07).
 */
export function updateImportBatchDecisions(
  actor: Profile,
  batchId: string,
  input: {
    global_duplicate_action?: DuplicateDecision;
    row_decisions?: Record<string, DuplicateDecision>; // row.id -> SKIP | REPLACE
    commit_mode?: CommitMode;
  },
): ImportBatchRecord {
  const state = getAemsState();
  const batch = state.import_batches.find((b) => b.id === batchId);
  if (!batch) {
    throw new AemsError("NOT_FOUND", "Batch import tidak ditemukan.", 404);
  }
  if (batch.uploaded_by !== actor.id && actor.role !== "ADMIN") {
    throw new AemsError(
      "FORBIDDEN",
      "Anda bukan pemilik batch import ini.",
      403,
    );
  }
  if (!["READY_FOR_REVIEW", "READY"].includes(batch.status)) {
    throw new AemsError(
      "VALIDATION",
      `Batch berstatus ${batch.status} tidak dapat diubah keputusannya.`,
      409,
    );
  }

  if (input.commit_mode && batch.import_type !== "MAPPING") {
    batch.commit_mode = input.commit_mode;
  }

  if (input.global_duplicate_action) {
    batch.default_action = input.global_duplicate_action;
    for (const r of batch.rows || []) {
      if (
        r.validation_status === "VALID" &&
        r.match_status === "DUPLICATE_DIFF"
      ) {
        r.action = input.global_duplicate_action;
      }
    }
  }

  if (input.row_decisions) {
    for (const r of batch.rows || []) {
      const dec = input.row_decisions[r.id];
      if (
        dec &&
        r.validation_status === "VALID" &&
        r.match_status === "DUPLICATE_DIFF"
      ) {
        r.action = dec;
      }
    }
  }

  batch.status = "READY";
  return batch;
}

/**
 * Atomically commits a staged import batch (`fn_commit_import_batch`, Bab 18.4, 18.6).
 * Enforces:
 * - Atomic claim of batch status READY -> COMMITTING (idempotent on double-click/retry, BR-IM-06)
 * - In ATOMIC mode, any invalid/conflict row rolls back the entire transaction -> status FAILED (FR-IMP-12)
 * - Replace never deletes children, active relationships, or history (R-10, BR-IM-03)
 * - Blank cells never overwrite existing non-null values (A-08, BR-IM-04)
 * - Concurrent row_version conflict detected on Replace -> marked CONFLICT (BR-IM-07)
 */
export function commitImportBatch(
  actor: Profile,
  batchId: string,
  idempotencyKey?: string,
): ImportBatchRecord {
  const state = getAemsState();
  const batch = state.import_batches.find((b) => b.id === batchId);
  if (!batch) {
    throw new AemsError("NOT_FOUND", "Batch import tidak ditemukan.", 404);
  }
  if (batch.uploaded_by !== actor.id && actor.role !== "ADMIN") {
    throw new AemsError(
      "FORBIDDEN",
      "Anda tidak berwenang melakukan commit batch ini.",
      403,
    );
  }

  // Idempotency protection on retry / double click (BR-IM-06, AC-09)
  if (
    ["COMMITTING", "COMPLETED", "COMPLETED_WITH_ERRORS"].includes(
      batch.status,
    ) ||
    (idempotencyKey &&
      batch.idempotency_key === idempotencyKey &&
      batch.finished_at)
  ) {
    return batch;
  }

  if (!["READY_FOR_REVIEW", "READY"].includes(batch.status)) {
    throw new AemsError(
      "BATCH_ALREADY_COMMITTED",
      `Batch import berstatus ${batch.status} tidak dapat di-commit ulang.`,
      409,
    );
  }

  // Atomic status claim
  batch.status = "COMMITTING";
  if (idempotencyKey) {
    batch.idempotency_key = idempotencyKey;
  }

  // Take deep snapshot of state for true ATOMIC rollback if an error occurs
  const snapshot = JSON.stringify({
    assets: state.assets,
    equipment: state.equipment,
    asset_equipment_mappings: state.asset_equipment_mappings,
    equipment_relationships: state.equipment_relationships,
    equipment_active_parent: state.equipment_active_parent,
    mapping_change_requests: state.mapping_change_requests,
    mapping_history: state.mapping_history,
    audit_logs: state.audit_logs,
  });

  let insertedCount = 0;
  let replacedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  try {
    const rows = batch.rows || [];

    // In ATOMIC mode, if there are any INVALID rows, abort and rollback immediately (AC-10)
    if (batch.commit_mode === "ATOMIC") {
      const invalidRows = rows.filter((r) => r.validation_status === "INVALID");
      if (invalidRows.length > 0) {
        for (const ir of invalidRows) {
          ir.result_status = "FAILED";
          ir.result_message = ir.errors.map((e) => e.message).join("; ");
        }
        throw new AemsError(
          "VALIDATION",
          `Mode ATOMIC membatalkan seluruh import karena terdapat ${invalidRows.length} baris tidak valid.`,
          422,
          { invalid_count: invalidRows.length },
        );
      }
    }

    if (batch.import_type === "ASSET_MASTER") {
      const normOpts = {
        padNumeric: state.app_settings.normalization.pad_numeric_sap_asset,
        padLength: state.app_settings.normalization.sap_asset_pad_length,
      };

      for (const row of rows) {
        if (row.validation_status === "INVALID") {
          row.result_status = "FAILED";
          row.result_message = row.errors.map((e) => e.message).join("; ");
          failedCount++;
          continue;
        }

        if (row.action === "SKIP" || row.match_status === "IDENTICAL") {
          row.result_status = "SKIPPED";
          row.result_message = "Dilewati (Skip)";
          skippedCount++;
          continue;
        }

        const m = row.mapped_data;
        const companyCode = String(
          m.company_code ||
            state.app_settings.normalization.default_company_code,
        );
        const sapAssetNo = String(m.sap_asset_no).trim();
        const sapSubNo = String(
          m.sap_sub_no || state.app_settings.normalization.default_sub_no,
        );
        const keyNorm = buildAssetCompositeKey(
          companyCode,
          sapAssetNo,
          sapSubNo,
          normOpts,
        );

        const existing = state.assets.find(
          (a) =>
            buildAssetCompositeKey(
              a.company_code,
              a.sap_asset_no,
              a.sap_sub_no,
              normOpts,
            ) === keyNorm,
        );

        if (!existing) {
          createAsset(actor, {
            company_code: companyCode,
            sap_asset_no: sapAssetNo,
            sap_sub_no: sapSubNo,
            name: String(m.name).trim(),
            description: m.description ? String(m.description) : null,
            asset_category_id: (m.asset_category_id as string) || null,
            location_id: (m.location_id as string) || null,
            cost_center: m.cost_center ? String(m.cost_center) : null,
            acquisition_date: m.acquisition_date
              ? String(m.acquisition_date)
              : null,
            acquisition_value:
              m.acquisition_value !== undefined && m.acquisition_value !== ""
                ? Number(m.acquisition_value)
                : null,
            status:
              (m.status as "ACTIVE" | "INACTIVE" | "DISPOSED") || "ACTIVE",
            source_type: "EXCEL",
            source_batch_id: batch.id,
          });
          row.result_status = "INSERTED";
          row.result_message = "Berhasil ditambahkan";
          insertedCount++;
        } else if (row.action === "REPLACE") {
          // BR-IM-07: Check row_version conflict since preview
          if (
            row.base_row_version !== null &&
            existing.row_version !== row.base_row_version
          ) {
            row.result_status = "CONFLICT";
            row.result_message =
              "Konflik versi: Data aset telah diubah pengguna lain sejak pratinjau (BR-IM-07)";
            failedCount++;
            if (batch.commit_mode === "ATOMIC") {
              throw new AemsError("VERSION_CONFLICT", row.result_message, 409);
            }
            continue;
          }

          // BR-IM-03 & A-08: Replace only updates mapped non-blank fields; never touches children/relationships
          const patch: Partial<Asset> & { row_version: number } = {
            row_version: existing.row_version,
          };
          if (m.name && String(m.name).trim() !== "")
            patch.name = String(m.name).trim();
          if (m.description && String(m.description).trim() !== "")
            patch.description = String(m.description).trim();
          if (m.asset_category_id)
            patch.asset_category_id = String(m.asset_category_id);
          if (m.location_id) patch.location_id = String(m.location_id);
          if (m.cost_center && String(m.cost_center).trim() !== "")
            patch.cost_center = String(m.cost_center).trim();
          if (
            m.acquisition_value !== undefined &&
            String(m.acquisition_value).trim() !== ""
          )
            patch.acquisition_value = Number(m.acquisition_value);

          updateAsset(actor, existing.id, patch);
          row.result_status = "REPLACED";
          row.result_message = "Berhasil diperbarui (Replace)";
          replacedCount++;
        }
      }
    } else if (batch.import_type === "EQUIPMENT_MASTER") {
      for (const row of rows) {
        if (row.validation_status === "INVALID") {
          row.result_status = "FAILED";
          row.result_message = row.errors.map((e) => e.message).join("; ");
          failedCount++;
          continue;
        }

        if (row.action === "SKIP" || row.match_status === "IDENTICAL") {
          row.result_status = "SKIPPED";
          row.result_message = "Dilewati (Skip)";
          skippedCount++;
          continue;
        }

        const m = row.mapped_data;
        const sourceSystem = String(
          m.source_system ||
            state.app_settings.normalization.default_source_system,
        );
        const eqNo = String(m.equipment_no).trim();
        const keyNorm = buildEquipmentCompositeKey(sourceSystem, eqNo);

        const existing = state.equipment.find(
          (e) =>
            buildEquipmentCompositeKey(e.source_system, e.equipment_no) ===
            keyNorm,
        );

        if (!existing) {
          createEquipment(actor, {
            source_system: sourceSystem,
            equipment_no: eqNo,
            kind: (m.kind as EquipmentKind) || "OTHER",
            name: String(m.name).trim(),
            specification: m.specification ? String(m.specification) : null,
            serial_no: m.serial_no ? String(m.serial_no) : null,
            condition: (m.condition as EquipmentCondition) || "BAIK",
            location_id: (m.location_id as string) || null,
            status: (m.status as EquipmentStatus) || "ACTIVE",
            source_type: "EXCEL",
            source_batch_id: batch.id,
          });
          row.result_status = "INSERTED";
          row.result_message = "Berhasil ditambahkan (Unmapped)";
          insertedCount++;
        } else if (row.action === "REPLACE") {
          if (
            row.base_row_version !== null &&
            existing.row_version !== row.base_row_version
          ) {
            row.result_status = "CONFLICT";
            row.result_message =
              "Konflik versi: Data equipment telah diubah pengguna lain sejak pratinjau (BR-IM-07)";
            failedCount++;
            if (batch.commit_mode === "ATOMIC") {
              throw new AemsError("VERSION_CONFLICT", row.result_message, 409);
            }
            continue;
          }

          const patch: Partial<Equipment> & { row_version: number } = {
            row_version: existing.row_version,
          };
          if (m.name && String(m.name).trim() !== "")
            patch.name = String(m.name).trim();
          if (m.kind && String(m.kind).trim() !== "")
            patch.kind = String(m.kind).trim() as EquipmentKind;
          if (m.specification && String(m.specification).trim() !== "")
            patch.specification = String(m.specification).trim();
          if (m.serial_no && String(m.serial_no).trim() !== "")
            patch.serial_no = String(m.serial_no).trim();
          if (m.condition && String(m.condition).trim() !== "")
            patch.condition = String(m.condition).trim() as EquipmentCondition;
          if (m.location_id) patch.location_id = String(m.location_id);

          updateEquipment(actor, existing.id, patch);
          row.result_status = "REPLACED";
          row.result_message =
            "Berhasil diperbarui (relasi & histori tetap utuh)";
          replacedCount++;
        }
      }
    } else if (batch.import_type === "MAPPING") {
      // BR-MP-08: Mapping import by Accounting/Maintenance creates a batch request;
      // by Administrator can be applied directly.
      const itemsToSubmit: Array<{
        row: ImportRowRecord;
        equipment_id: string;
        to_parent_kind: ParentKind;
        to_parent_id: string;
      }> = [];

      for (const row of rows) {
        if (row.validation_status === "INVALID") {
          row.result_status = "FAILED";
          row.result_message = row.errors.map((e) => e.message).join("; ");
          failedCount++;
          continue;
        }
        if (row.action === "SKIP" || row.match_status === "IDENTICAL") {
          row.result_status = "SKIPPED";
          row.result_message = "Dilewati (Skip)";
          skippedCount++;
          continue;
        }

        itemsToSubmit.push({
          row,
          equipment_id: String(row.mapped_data.equipment_id),
          to_parent_kind: row.mapped_data.to_parent_kind as ParentKind,
          to_parent_id: String(row.mapped_data.to_parent_id),
        });
      }

      if (itemsToSubmit.length > 0) {
        const req = submitMappingRequest(actor, {
          items: itemsToSubmit.map((i) => ({
            equipment_id: i.equipment_id,
            to_parent_kind: i.to_parent_kind,
            to_parent_id: i.to_parent_id,
          })),
          reason: `Import Mapping Batch (${batch.file_name})`,
          batch_id: batch.id,
          apply_immediately: actor.role === "ADMIN",
        });

        for (const item of itemsToSubmit) {
          if (req.status === "APPLIED") {
            if (item.row.match_status === "NEW") {
              item.row.result_status = "INSERTED";
              insertedCount++;
            } else {
              item.row.result_status = "REPLACED";
              replacedCount++;
            }
            item.row.result_message = `Mapping diterapkan (${req.request_code})`;
          } else {
            item.row.result_status = "PENDING_APPROVAL";
            item.row.result_message = `Menunggu persetujuan Admin (${req.request_code})`;
            insertedCount++;
          }
        }
      }
    }

    batch.inserted_count = insertedCount;
    batch.replaced_count = replacedCount;
    batch.skipped_count = skippedCount;
    batch.failed_count = failedCount;
    batch.finished_at = new Date().toISOString();
    batch.status = failedCount > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED";

    appendAuditLog(
      state,
      actor,
      "IMPORT_BATCH",
      batch.id,
      batch.file_name,
      "COMMIT_IMPORT",
      null,
      {
        import_type: batch.import_type,
        status: batch.status,
        inserted: insertedCount,
        replaced: replacedCount,
        skipped: skippedCount,
        failed: failedCount,
      },
      ["status"],
      batch.id,
    );

    return batch;
  } catch (err) {
    // Rollback entire transaction in ATOMIC mode
    const parsed = JSON.parse(snapshot);
    state.assets = parsed.assets;
    state.equipment = parsed.equipment;
    state.asset_equipment_mappings = parsed.asset_equipment_mappings;
    state.equipment_relationships = parsed.equipment_relationships;
    state.equipment_active_parent = parsed.equipment_active_parent;
    state.mapping_change_requests = parsed.mapping_change_requests;
    state.mapping_history = parsed.mapping_history;
    state.audit_logs = parsed.audit_logs;

    batch.status = "FAILED";
    batch.failed_count = (batch.rows || []).filter(
      (r) =>
        r.validation_status === "INVALID" || r.result_status === "CONFLICT",
    ).length;
    batch.finished_at = new Date().toISOString();
    throw err;
  }
}

// -----------------------------------------------------------------------------
// Reconciliation Scanner & Resolution (Bab 18.7 Table 62)
// -----------------------------------------------------------------------------

export function runReconciliationScan(actor: Profile): ReconciliationFinding[] {
  if (!hasPermission(actor, "reconciliation:resolve")) {
    throw new AemsError(
      "FORBIDDEN",
      "Hanya Administrator yang dapat menjalankan pemindaian rekonsiliasi.",
      403,
    );
  }

  const state = getAemsState();
  const now = new Date().toISOString();

  function upsertFinding(
    findingType: ReconciliationFinding["finding_type"],
    severity: ReconciliationFinding["severity"],
    entityType: ReconciliationFinding["entity_type"],
    entityId: string,
    entityCode: string,
    entityName: string,
    description: string,
    details: Record<string, unknown>,
  ) {
    const existing = state.reconciliation_findings.find(
      (f) =>
        f.finding_type === findingType &&
        f.entity_id === entityId &&
        f.status === "OPEN",
    );
    if (!existing) {
      state.reconciliation_findings.unshift({
        id: crypto.randomUUID(),
        finding_type: findingType,
        severity,
        entity_type: entityType,
        entity_id: entityId,
        entity_code: entityCode,
        entity_name: entityName,
        description,
        details,
        status: "OPEN",
        resolution_note: null,
        resolved_by: null,
        resolver_name: null,
        resolved_at: null,
        detected_at: now,
      });
    }
  }

  // 1. Check active equipment without effective root asset (UNMAPPED_EQUIPMENT)
  for (const eq of state.equipment) {
    if (eq.deleted_at !== null || eq.status !== "ACTIVE") continue;
    const resolved = resolveEffectiveRootAssetId(eq.id, state);
    if (!resolved.rootAssetId) {
      upsertFinding(
        "UNMAPPED_EQUIPMENT",
        "MEDIUM",
        "EQUIPMENT",
        eq.id,
        eq.equipment_no,
        eq.name,
        "Equipment aktif belum memiliki aset induk efektif (mandiri atau rantai parent tanpa aset).",
        { kind: eq.kind },
      );
    }

    // 2. Check stale root_asset_id cache (STALE_ROOT_CACHE)
    if (eq.root_asset_id !== resolved.rootAssetId) {
      eq.root_asset_id = resolved.rootAssetId;
      eq.depth = resolved.depth;
      eq.path_ids = resolved.pathIds;
      upsertFinding(
        "STALE_ROOT_CACHE",
        "HIGH",
        "EQUIPMENT",
        eq.id,
        eq.equipment_no,
        eq.name,
        "Cache root_asset_id ditemukan tidak sinkron dan telah diperbaiki otomatis.",
        { corrected_root_asset_id: resolved.rootAssetId },
      );
    }
  }

  // 3. Check inactive/disposed asset with active equipment
  for (const asset of state.assets) {
    if (asset.status !== "ACTIVE" || asset.deleted_at !== null) {
      const activeChildren = state.asset_equipment_mappings.filter(
        (m) => m.asset_id === asset.id && m.valid_to === null,
      );
      if (activeChildren.length > 0) {
        upsertFinding(
          "INACTIVE_ASSET_ACTIVE_EQUIPMENT",
          "HIGH",
          "ASSET",
          asset.id,
          asset.sap_asset_no,
          asset.name,
          `Aset berstatus ${asset.status} masih memiliki ${activeChildren.length} equipment aktif.`,
          { active_equipment_count: activeChildren.length },
        );
      }
    }
  }

  // 4. Check active child equipment whose parent equipment is inactive
  for (const rel of state.equipment_relationships) {
    if (rel.valid_to !== null) continue;
    const parent = state.equipment.find(
      (e) => e.id === rel.parent_equipment_id,
    );
    const child = state.equipment.find((e) => e.id === rel.child_equipment_id);
    if (
      parent &&
      child &&
      parent.status !== "ACTIVE" &&
      child.status === "ACTIVE"
    ) {
      upsertFinding(
        "INACTIVE_PARENT_ACTIVE_CHILD",
        "HIGH",
        "EQUIPMENT",
        child.id,
        child.equipment_no,
        child.name,
        `Equipment aktif ${child.equipment_no} memiliki parent nonaktif (${parent.equipment_no}).`,
        { parent_equipment_no: parent.equipment_no },
      );
    }
  }

  appendAuditLog(
    state,
    actor,
    "RECONCILIATION",
    null,
    "SCAN",
    "RUN_SCAN",
    null,
    {
      open_findings: state.reconciliation_findings.filter(
        (f) => f.status === "OPEN",
      ).length,
    },
    [],
  );

  return state.reconciliation_findings;
}

export function resolveReconciliationFinding(
  actor: Profile,
  findingId: string,
  status: "RESOLVED" | "IGNORED",
  resolutionNote: string,
): ReconciliationFinding {
  if (!hasPermission(actor, "reconciliation:resolve")) {
    throw new AemsError(
      "FORBIDDEN",
      "Hanya Administrator yang dapat menyelesaikan temuan rekonsiliasi.",
      403,
    );
  }

  const state = getAemsState();
  const finding = state.reconciliation_findings.find((f) => f.id === findingId);
  if (!finding) {
    throw new AemsError(
      "NOT_FOUND",
      "Temuan rekonsiliasi tidak ditemukan.",
      404,
    );
  }

  finding.status = status;
  finding.resolution_note = resolutionNote.trim();
  finding.resolved_by = actor.id;
  finding.resolver_name = actor.full_name;
  finding.resolved_at = new Date().toISOString();

  appendAuditLog(
    state,
    actor,
    "RECONCILIATION",
    finding.id,
    finding.entity_code,
    `FINDING_${status}`,
    { status: "OPEN" },
    { status, resolution_note: finding.resolution_note },
    ["status", "resolution_note"],
  );

  return finding;
}

// -----------------------------------------------------------------------------
// Dashboard Summary & Bidirectional Search (Bab 8.1, 16.2, FR-MAP-03)
// -----------------------------------------------------------------------------

export function getDashboardSummary() {
  const state = getAemsState();
  const activeAssets = state.assets.filter((a) => a.deleted_at === null);
  const activeEquipment = state.equipment.filter((e) => e.deleted_at === null);

  const mappedAssetIds = new Set<string>();
  for (const eq of activeEquipment) {
    if (eq.root_asset_id) {
      mappedAssetIds.add(eq.root_asset_id);
    }
  }

  const assetsWithMapping = activeAssets.filter((a) =>
    mappedAssetIds.has(a.id),
  ).length;
  const assetsWithoutMapping = activeAssets.length - assetsWithMapping;

  const equipmentMapped = activeEquipment.filter(
    (e) => e.root_asset_id !== null,
  ).length;
  const equipmentUnmapped = activeEquipment.filter(
    (e) => e.root_asset_id === null,
  ).length;

  const openFindingsCount = state.reconciliation_findings.filter(
    (f) => f.status === "OPEN",
  ).length;

  const pendingApprovalsCount = state.mapping_change_requests.filter(
    (r) => r.status === "SUBMITTED",
  ).length;

  // Category distribution
  const byCategory = state.asset_categories.map((cat) => ({
    category_id: cat.id,
    category_code: cat.code,
    category_name: cat.name,
    count: activeAssets.filter((a) => a.asset_category_id === cat.id).length,
  }));

  // Location distribution
  const byLocation = state.locations.map((loc) => ({
    location_id: loc.id,
    location_code: loc.code,
    location_name: loc.name,
    count: activeAssets.filter((a) => a.location_id === loc.id).length,
  }));

  const recentImports = state.import_batches.slice(0, 5);

  return {
    total_assets: activeAssets.length,
    total_equipment: activeEquipment.length,
    assets_mapped: assetsWithMapping,
    assets_unmapped: assetsWithoutMapping,
    equipment_mapped: equipmentMapped,
    equipment_unmapped: equipmentUnmapped,
    open_findings: openFindingsCount,
    pending_approvals: pendingApprovalsCount,
    by_category: byCategory,
    by_location: byLocation,
    recent_imports: recentImports,
  };
}

/**
 * Bidirectional Search (FR-MAP-03, UC-03):
 * - Searches assets by SAP Asset No, Name, Serial, or Cost Center -> returns Asset + direct/total equipment count
 * - Searches equipment by Equipment No, Name, or Serial -> returns Equipment + Breadcrumb + Root Asset SAP No
 */
export function searchBidirectional(
  query: string,
  viewerRole?: AppRole | null,
) {
  const state = getAemsState();
  const qNorm = normalizeKey(query);
  const qLower = query.trim().toLowerCase();

  if (!qLower) {
    return { assets: [], equipment: [] };
  }

  const assets = getEnrichedAssets(false, viewerRole)
    .filter(
      (a) =>
        a.asset_key_norm.includes(qNorm) ||
        a.sap_asset_no.toLowerCase().includes(qLower) ||
        a.name.toLowerCase().includes(qLower) ||
        (a.serial_no && a.serial_no.toLowerCase().includes(qLower)),
    )
    .map((a) => {
      const attachedEquipment = state.equipment.filter(
        (e) => e.deleted_at === null && e.root_asset_id === a.id,
      );
      return {
        ...a,
        attached_equipment_count: attachedEquipment.length,
        attached_equipment_nos: attachedEquipment.map((e) => e.equipment_no),
      };
    });

  const equipment = getEnrichedEquipment(false)
    .filter(
      (e) =>
        e.equipment_key_norm.includes(qNorm) ||
        e.equipment_no.toLowerCase().includes(qLower) ||
        e.name.toLowerCase().includes(qLower) ||
        (e.serial_no && e.serial_no.toLowerCase().includes(qLower)),
    )
    .map((e) => ({
      ...e,
      breadcrumb: getEquipmentBreadcrumb(e.id, state),
    }));

  return { assets, equipment };
}

// -----------------------------------------------------------------------------
// User, Role & Settings Administration (Bab 8.7, 20.2)
// -----------------------------------------------------------------------------

export function manageUserProfile(
  actor: Profile,
  input: {
    id?: string;
    email: string;
    full_name: string;
    role: AppRole | null;
    is_active: boolean;
    department?: string | null;
    account_level?: "MANAGER" | "STAFF";
    manager_id?: string | null;
    expected_updated_at?: string;
  },
): Profile {
  if (!hasPermission(actor, "users:manage")) {
    throw new AemsError(
      "FORBIDDEN",
      "Hanya Administrator yang memiliki wewenang mengelola pengguna dan role.",
      403,
    );
  }

  const state = getAemsState();
  const now = new Date().toISOString();

  if (input.id) {
    const existing = state.profiles.find((p) => p.id === input.id);
    if (!existing) {
      throw new AemsError("NOT_FOUND", "Profil pengguna tidak ditemukan.", 404);
    }
    if (
      input.expected_updated_at &&
      input.expected_updated_at !== existing.updated_at
    )
      throw new AemsError(
        "VERSION_CONFLICT",
        "Profil berubah. Muat ulang sebelum memperbarui pengguna.",
        409,
      );
    if (
      existing.role === "ADMIN" &&
      existing.is_active &&
      (input.role !== "ADMIN" || !input.is_active) &&
      state.profiles.filter((p) => p.role === "ADMIN" && p.is_active).length <=
        1
    ) {
      throw new AemsError(
        "FORBIDDEN",
        "Administrator aktif terakhir tidak dapat dinonaktifkan atau diubah jenis akunnya.",
        403,
      );
    }
    if (input.role === "ADMIN" && existing.role !== "ADMIN") {
      throw new AemsError(
        "FORBIDDEN",
        "Pilih jenis akun Accounting atau Equipment untuk pengguna ini.",
        403,
      );
    }
    const level = input.account_level ?? existing.account_level ?? "STAFF";
    const managerId =
      input.manager_id === undefined
        ? (existing.manager_id ?? null)
        : input.manager_id;
    if (level === "MANAGER" && managerId)
      throw new AemsError(
        "VALIDATION",
        "Manajer tidak ditempatkan di bawah Staff.",
      );
    if (managerId) {
      const manager = state.profiles.find((p) => p.id === managerId);
      if (
        managerId === existing.id ||
        !manager?.is_active ||
        manager.account_level !== "MANAGER" ||
        manager.role !== input.role
      )
        throw new AemsError(
          "VALIDATION",
          "Atasan harus Manajer aktif pada bagian yang sama.",
        );
    }
    if (
      state.profiles.some((p) => p.manager_id === existing.id && p.is_active) &&
      (level !== "MANAGER" || input.role !== existing.role || !input.is_active)
    )
      throw new AemsError(
        "VALIDATION",
        "Pindahkan penempatan staff terlebih dahulu sebelum mengubah manajer ini.",
      );
    const hierarchyBefore = {
      account_level: existing.account_level ?? "STAFF",
      manager_id: existing.manager_id ?? null,
    };
    existing.account_level = level;
    existing.manager_id = managerId;
    const oldVals = {
      ...hierarchyBefore,
      role: existing.role,
      is_active: existing.is_active,
      full_name: existing.full_name,
    };
    existing.full_name = input.full_name.trim();
    existing.role = input.role;
    existing.is_active = input.is_active;
    existing.department = input.department ?? existing.department;
    existing.updated_at = now;

    appendAuditLog(
      state,
      actor,
      "USER_PROFILE",
      existing.id,
      existing.email,
      "UPDATE_USER",
      oldVals,
      {
        account_level: existing.account_level,
        manager_id: existing.manager_id,
        role: existing.role,
        is_active: existing.is_active,
        full_name: existing.full_name,
      },
      ["role", "account_level", "manager_id", "is_active", "full_name"],
    );
    return existing;
  } else {
    const newProfile: Profile = {
      id: crypto.randomUUID(),
      email: input.email.trim().toLowerCase(),
      full_name: input.full_name.trim(),
      role: input.role,
      is_active: input.is_active,
      department: input.department ?? null,
      last_login_at: null,
      created_at: now,
      updated_at: now,
    };
    state.profiles.push(newProfile);
    appendAuditLog(
      state,
      actor,
      "USER_PROFILE",
      newProfile.id,
      newProfile.email,
      "CREATE_USER",
      null,
      {
        email: newProfile.email,
        role: newProfile.role,
        is_active: newProfile.is_active,
      },
      ["email", "role", "is_active"],
    );
    return newProfile;
  }
}

export function updateAppSettings(
  actor: Profile,
  newSettings: Partial<AppSettingsConfig>,
): AppSettingsConfig {
  if (!hasPermission(actor, "settings:manage")) {
    throw new AemsError(
      "FORBIDDEN",
      "Hanya Administrator yang dapat mengubah konfigurasi sistem.",
      403,
    );
  }
  const state = getAemsState();
  const oldSettings = JSON.parse(JSON.stringify(state.app_settings));

  if (newSettings.hierarchy) {
    state.app_settings.hierarchy = {
      ...state.app_settings.hierarchy,
      ...newSettings.hierarchy,
    };
  }
  if (newSettings.normalization) {
    state.app_settings.normalization = {
      ...state.app_settings.normalization,
      ...newSettings.normalization,
    };
  }
  if (newSettings.imports) {
    state.app_settings.imports = {
      ...state.app_settings.imports,
      ...newSettings.imports,
    };
  }
  if (newSettings.security) {
    state.app_settings.security = {
      ...state.app_settings.security,
      ...newSettings.security,
    };
  }

  appendAuditLog(
    state,
    actor,
    "APP_SETTINGS",
    null,
    "CONFIG",
    "UPDATE_SETTINGS",
    oldSettings,
    state.app_settings as unknown as Record<string, unknown>,
    Object.keys(newSettings),
  );

  return state.app_settings;
}

export function recordReportExportAudit(
  actor: Profile,
  reportName: string,
  format: "EXCEL" | "PDF",
  filterSummary: Record<string, unknown>,
): void {
  const state = getAemsState();
  appendAuditLog(
    state,
    actor,
    "REPORT_EXPORT",
    null,
    reportName,
    `EXPORT_${format}`,
    null,
    { report_name: reportName, format, filters: filterSummary },
    [],
  );
}
