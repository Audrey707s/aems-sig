import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { getAemsState, getAssetEquipmentTree } from "@/lib/db/store";
import { EquipmentTreeNode, HierarchyNode } from "@/lib/types/domain";
import { formatErrorResponse } from "@/lib/utils/errors";

function mapEquipmentTreeNode(node: EquipmentTreeNode): HierarchyNode {
  return {
    id: node.id,
    type: "EQUIPMENT",
    code: node.equipment_no,
    name: node.name,
    kind: node.kind,
    status: node.status,
    condition: node.condition,
    depth: node.depth,
    specs: node.spec_items,
    children: (node.children || []).map(mapEquipmentTreeNode),
  };
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await getCurrentProfile();
    const { id } = await context.params;
    const asOf = req.nextUrl.searchParams.get("as_of");
    const state = getAemsState();
    const asset = state.assets.find((a) => a.id === id);
    const eqTree = getAssetEquipmentTree(id, asOf, state);

    if (asset) {
      const rootNode: HierarchyNode = {
        id: asset.id,
        type: "ASSET",
        code: asset.sap_asset_no,
        name: asset.name,
        status: asset.status,
        depth: 0,
        specs: state.equipment_spec_items.filter((s) => s.asset_id === asset.id),
        children: eqTree.map(mapEquipmentTreeNode),
      };
      return NextResponse.json({
        data: rootNode,
        equipment_tree: eqTree,
        as_of: asOf || null,
      });
    }

    return NextResponse.json({ data: eqTree, as_of: asOf || null });
  } catch (err) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}
