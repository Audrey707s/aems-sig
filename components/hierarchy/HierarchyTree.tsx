"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ChevronRight, ChevronDown, Box, Cpu, Wrench, ExternalLink } from "lucide-react";
import { HierarchyNode } from "@/lib/types/domain";

interface HierarchyTreeProps {
  root: HierarchyNode;
  highlightId?: string;
  onSelectNode?: (node: HierarchyNode) => void;
}

export function HierarchyTree({ root, highlightId, onSelectNode }: HierarchyTreeProps) {
  return (
    <div className="rounded-xl border border-[#E8E2DB] bg-white p-4">
      <TreeNodeItem
        node={root}
        level={0}
        highlightId={highlightId}
        onSelectNode={onSelectNode}
      />
    </div>
  );
}

function TreeNodeItem({
  node,
  level,
  highlightId,
  onSelectNode,
}: {
  node: HierarchyNode;
  level: number;
  highlightId?: string;
  onSelectNode?: (node: HierarchyNode) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = (node.children && node.children.length > 0) || (node.specs && node.specs.length > 0);
  const isHighlighted = highlightId === node.id;

  const detailHref =
    node.type === "ASSET" ? `/assets/${node.id}` : `/equipment/${node.id}`;

  return (
    <div className="select-none">
      <div
        style={{ paddingLeft: `${level * 20}px` }}
        className={`flex items-center justify-between py-2 px-2.5 rounded-lg transition group ${
          isHighlighted
            ? "bg-[#E8EEF7] border border-[#1A3263]/30"
            : "hover:bg-[#F6F4F0]"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="p-0.5 rounded hover:bg-[#E8E2DB] text-[#547792]"
            >
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ) : (
            <span className="w-5" />
          )}

          {node.type === "ASSET" ? (
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-[#1A3263] text-[#FAB95B] shrink-0">
              <Box className="w-3.5 h-3.5" />
            </span>
          ) : (
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-[#EDF2F6] text-[#547792] shrink-0">
              <Cpu className="w-3.5 h-3.5" />
            </span>
          )}

          <div
            onClick={() => onSelectNode?.(node)}
            className="min-w-0 cursor-pointer flex items-center gap-2 flex-wrap"
          >
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#E8E2DB]/70 text-[#1A3263]">
              {node.code}
            </span>
            <span className="text-sm font-semibold text-[#1A3263] truncate">
              {node.name}
            </span>
            {node.kind && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#EDF2F6] text-[#547792]">
                {node.kind === "WHOLE_UNIT"
                  ? "Perangkat Utuh"
                  : node.kind === "COMPONENT"
                  ? "Komponen"
                  : "Lainnya"}
              </span>
            )}
            <span className="text-[10px] text-[#547792] font-medium">
              Level {node.depth}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {node.condition && (
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                node.condition === "BAIK"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-[#FEF6E7] text-[#8A580C] border border-[#FAB95B]"
              }`}
            >
              {node.condition.replace("_", " ")}
            </span>
          )}
          <Link
            href={detailHref}
            className="opacity-80 group-hover:opacity-100 inline-flex items-center gap-1 text-xs text-[#547792] hover:text-[#1A3263] font-semibold"
          >
            <span>Detail</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {expanded && hasChildren && (
        <div className="mt-0.5 border-l border-[#E8E2DB] ml-4">
          {node.specs &&
            node.specs.map((sp) => (
              <div
                key={sp.id}
                style={{ paddingLeft: `${(level + 1) * 20}px` }}
                className="flex items-center justify-between py-1.5 px-2.5 text-xs text-[#547792] hover:bg-[#F6F4F0] rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <span className="w-5" />
                  <Wrench className="w-3.5 h-3.5 text-[#FAB95B]" />
                  <span className="font-medium text-[#1A3263]">
                    Spesifikasi: {sp.spec_name}
                  </span>
                  <span className="text-[#547792]">— {sp.spec_value}</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FEF6E7] text-[#8A580C] border border-[#FAB95B]/50 font-semibold">
                  Atribut Spesifikasi
                </span>
              </div>
            ))}

          {node.children.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              level={level + 1}
              highlightId={highlightId}
              onSelectNode={onSelectNode}
            />
          ))}
        </div>
      )}
    </div>
  );
}
