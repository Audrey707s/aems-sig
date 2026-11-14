import type { HierarchyNode } from "@/lib/types/domain";
export const NODE_WIDTH = 230;
export const NODE_HEIGHT = 86;
export interface DiagramNode {node: HierarchyNode; x: number; y: number; parentId: string | null; path: string[]}
/** A tidy horizontal tree; paths are retained to reveal collapsed search matches. */
export function layoutHierarchy(root: HierarchyNode, collapsed: ReadonlySet<string> = new Set()) {
  const nodes: DiagramNode[] = [];
  const seen = new Set<string>();
  let leaf = 0;
  let maxDepth = 0;
  function visit(node: HierarchyNode, depth: number, path: string[], parentId: string | null): number | null {
    if (seen.has(node.id)) return null;
    seen.add(node.id); maxDepth = Math.max(maxDepth, depth);
    const position: DiagramNode = {node, x: 24 + depth * 300, y: 0, parentId, path};
    nodes.push(position);
    const ys = collapsed.has(node.id) ? [] : node.children.map(child => visit(child, depth + 1, [...path, node.id], node.id)).filter((y): y is number => y !== null);
    position.y = ys.length ? (ys[0] + ys[ys.length - 1]) / 2 : 24 + leaf++ * 112;
    return position.y;
  }
  visit(root, 0, [], null);
  return {nodes, width: 48 + maxDepth * 300 + NODE_WIDTH, height: 48 + Math.max(0, leaf - 1) * 112 + NODE_HEIGHT};
}
