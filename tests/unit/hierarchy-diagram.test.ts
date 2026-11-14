import { describe, expect, it } from "vitest";
import { layoutHierarchy, NODE_HEIGHT } from "@/lib/hierarchy-diagram";
import type { HierarchyNode } from "@/lib/types/domain";
function node(id: string, children: HierarchyNode[] = []): HierarchyNode {return {id, code: id, name: id, type: "EQUIPMENT", depth: 0, status: "ACTIVE", children};}
describe("mapping diagram layout", () => {
  it("keeps branch relationships, nonoverlapping siblings and search ancestor paths", () => {
    const root = node("asset", [node("a", [node("a1"), node("a2")]), node("b")]);
    const result = layoutHierarchy(root);
    expect(result.nodes).toHaveLength(5);
    const positions = new Map(result.nodes.map(item => [item.node.id, item]));
    expect(positions.get("a1")!.path).toEqual(["asset", "a"]);
    expect(positions.get("a1")!.parentId).toBe("a");
    expect(positions.get("a2")!.y - positions.get("a1")!.y).toBeGreaterThan(NODE_HEIGHT);
    expect(positions.get("a")!.y).toBe((positions.get("a1")!.y + positions.get("a2")!.y) / 2);
    expect(positions.get("a1")!.x).toBeGreaterThan(positions.get("a")!.x);
  });
  it("collapses only the selected branch while retaining its peers", () => {
    const result = layoutHierarchy(node("root", [node("a", [node("a1")]), node("b")]), new Set(["a"]));
    expect(result.nodes.map(item => item.node.id)).toEqual(["root", "a", "b"]);
    expect(layoutHierarchy(node("root", [node("a")]), new Set(["root"])).nodes).toHaveLength(1);
  });
  it("terminates safely if malformed data contains a cycle or repeated node", () => {
    const root = node("root"); const a = node("a", [root]); root.children = [a, a];
    expect(layoutHierarchy(root).nodes.map(item => item.node.id)).toEqual(["root", "a"]);
  });
  it("fits an empty asset without fabricating equipment", () => {
    const result = layoutHierarchy(node("asset"));
    expect(result.nodes).toHaveLength(1); expect(result.width).toBeGreaterThan(230); expect(result.height).toBeGreaterThan(NODE_HEIGHT);
  });
});
