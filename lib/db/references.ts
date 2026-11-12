import { getAemsState } from "./store";
import type { Profile, ReferenceItem } from "@/lib/types/domain";
import { AemsError } from "@/lib/utils/errors";
export const referenceKinds = [
  "asset_categories",
  "equipment_categories",
  "locations",
] as const;
export type ReferenceKind = (typeof referenceKinds)[number];
export function saveReference(
  actor: Profile,
  kind: ReferenceKind,
  input: {
    id?: string;
    code: string;
    name: string;
    parent_id: string | null;
    is_active: boolean;
    expected?: ReferenceItem;
  },
) {
  if (actor.role !== "ADMIN" || !actor.is_active)
    throw new AemsError(
      "FORBIDDEN",
      "Hanya Admin dapat mengelola master data.",
      403,
    );
  const state = getAemsState(),
    rows = state[kind];
  const old = input.id ? rows.find((r) => r.id === input.id) : undefined;
  if (input.id && !old)
    throw new AemsError("NOT_FOUND", "Data referensi tidak ditemukan.", 404);
  if (
    old &&
    (!input.expected ||
      ["code", "name", "parent_id", "is_active"].some(
        (k) =>
          old[k as keyof ReferenceItem] !==
          input.expected![k as keyof ReferenceItem],
      ))
  )
    throw new AemsError(
      "VERSION_CONFLICT",
      "Data berubah. Muat ulang sebelum menyimpan.",
      409,
    );
  if (
    rows.some(
      (r) =>
        r.id !== input.id &&
        r.code.trim().toUpperCase() === input.code.toUpperCase(),
    )
  )
    throw new AemsError("DUPLICATE_KEY", "Kode sudah digunakan.", 409);
  if (input.parent_id) {
    let cursor: string | null = input.parent_id;
    const seen = new Set<string>();
    while (cursor) {
      if (cursor === input.id || seen.has(cursor))
        throw new AemsError(
          "VALIDATION",
          "Hierarki tidak boleh membentuk siklus.",
        );
      seen.add(cursor);
      const p = rows.find((r) => r.id === cursor);
      if (!p || !p.is_active)
        throw new AemsError(
          "VALIDATION",
          "Induk tidak tersedia atau tidak aktif.",
        );
      cursor = p.parent_id;
    }
  }
  if (!input.is_active) {
    const used =
      kind === "locations"
        ? state.assets.some(
            (a) => !a.deleted_at && a.location_id === input.id,
          ) ||
          state.equipment.some(
            (e) => !e.deleted_at && e.location_id === input.id,
          )
        : kind === "asset_categories"
          ? state.assets.some(
              (a) => !a.deleted_at && a.asset_category_id === input.id,
            )
          : state.equipment.some(
              (e) => !e.deleted_at && e.equipment_category_id === input.id,
            );
    if (used || rows.some((r) => r.is_active && r.parent_id === input.id))
      throw new AemsError(
        "VALIDATION",
        "Data masih digunakan atau memiliki anak aktif. Pindahkan pemakaian terlebih dahulu.",
      );
  }
  const before = old ? structuredClone(old) : null;
  const value: ReferenceItem = {
    id: old?.id || crypto.randomUUID(),
    code: input.code.trim(),
    name: input.name.trim(),
    parent_id: input.parent_id,
    is_active: input.is_active,
  };
  if (old) Object.assign(old, value);
  else rows.push(value);
  state.audit_logs.unshift({
    id: Math.max(0, ...state.audit_logs.map((a) => a.id)) + 1,
    occurred_at: new Date().toISOString(),
    actor_id: actor.id,
    actor_name: actor.full_name,
    actor_role: actor.role,
    entity_type: kind,
    entity_id: value.id,
    entity_code: value.code,
    action: old
      ? value.is_active
        ? "UPDATE_REFERENCE"
        : "DEACTIVATE_REFERENCE"
      : "CREATE_REFERENCE",
    old_values: before ? { ...before } : null,
    new_values: { ...value },
    changed_fields: ["code", "name", "parent_id", "is_active"],
    request_id: crypto.randomUUID(),
    ip_address: "127.0.0.1",
    user_agent: "AEMS-Server",
    import_batch_id: null,
  });
  return value;
}
