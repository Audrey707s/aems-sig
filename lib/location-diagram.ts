import type { ReferenceItem, HierarchyNode } from "@/lib/types/domain";
/** Retain orphaned/inactive locations; guard malformed cycles without losing nodes. */
export function locationForest(rows: ReferenceItem[]): HierarchyNode {
  const seen = new Set<string>();
  function visit(row: ReferenceItem, depth: number): HierarchyNode {
    seen.add(row.id);
    return {id: row.id, type: "ASSET", code: row.code, name: row.name, status: row.is_active ? "ACTIVE" : "INACTIVE", depth,
      children: rows.filter(child => child.parent_id === row.id && !seen.has(child.id)).map(child => visit(child, depth + 1))};
  }
  const children = rows.filter(row => !row.parent_id || !rows.some(parent => parent.id === row.parent_id)).map(row => visit(row, 1));
  rows.forEach(row => {if (!seen.has(row.id)) children.push(visit(row, 1));});
  return {id: "__locations__", type: "ASSET", code: "LOKASI", name: "Seluruh lokasi", status: "ACTIVE", depth: 0, children};
}
