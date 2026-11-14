"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Box, ChevronDown, ChevronRight, Cpu, GitBranch, Minus, Plus, RotateCcw } from "lucide-react";
import type { HierarchyNode } from "@/lib/types/domain";
import { layoutHierarchy, NODE_HEIGHT, NODE_WIDTH } from "@/lib/hierarchy-diagram";
import { SearchField } from "@/components/ui/SearchField";

type AssetOption = {id: string; sap_asset_no: string; name: string};
const conditionLabels: Record<string, string> = {BAIK: "Baik", RUSAK_RINGAN: "Rusak ringan", RUSAK_BERAT: "Rusak berat", DALAM_PERBAIKAN: "Dalam perbaikan"};
export function MappingDiagram({initialAssetId = "", revision}: {initialAssetId?: string; revision: unknown}) {
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [assetId, setAssetId] = useState(initialAssetId);
  const [assetQuery, setAssetQuery] = useState("");
  const [query, setQuery] = useState("");
  const [root, setRoot] = useState<HierarchyNode | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{x: number; y: number; left: number; top: number} | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    async function loadAssets() {
      const all: AssetOption[] = [];
      let pages = 1;
      for (let page = 1; page <= pages; page++) {
        const response = await fetch(`/api/v1/assets?page_size=100&page=${page}`, {signal: controller.signal, cache: "no-store"});
        if (!response.ok) throw new Error("Daftar aset gagal dimuat.");
        const json = await response.json();
        all.push(...json.data); pages = json.meta.total_pages;
      }
      if (controller.signal.aborted) return;
      setAssets(all); setAssetId(current => current || all[0]?.id || "");
      if (!all.length) setLoading(false);
    }
    loadAssets().catch(e => { if (!controller.signal.aborted) {setError(e.message); setLoading(false);} });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => {
    if (!assetId) return;
    const controller = new AbortController();
    setRoot(null); setLoading(true); setError(""); setCollapsed(new Set()); setZoom(1); setQuery("");
    fetch(`/api/v1/assets/${encodeURIComponent(assetId)}/tree`, {signal: controller.signal, cache: "no-store"})
      .then(async response => {if (!response.ok) throw new Error("Diagram gagal dimuat. Silakan coba lagi."); return response.json();})
      .then(json => {if (!controller.signal.aborted) {if (json.data?.type !== "ASSET") throw new Error("Aset tidak ditemukan."); setRoot(json.data); setSelectedId(json.data.id);}})
      .catch(e => {if (!controller.signal.aborted) setError(e.message);})
      .finally(() => {if (!controller.signal.aborted) setLoading(false);});
    return () => controller.abort();
  }, [assetId, revision, retry]);
  const full = useMemo(() => root ? layoutHierarchy(root) : null, [root]);
  const diagram = useMemo(() => root ? layoutHierarchy(root, collapsed) : null, [root, collapsed]);
  const selected = full?.nodes.find(item => item.node.id === selectedId)?.node;
  const matchingAssets = assets.filter(a => `${a.sap_asset_no} ${a.name}`.toLocaleLowerCase("id").includes(assetQuery.toLocaleLowerCase("id")) || a.id === assetId);
  const matches = query.trim() ? full?.nodes.filter(item => `${item.node.code} ${item.node.name}`.toLocaleLowerCase("id").includes(query.trim().toLocaleLowerCase("id"))) || [] : [];
  function selectNode(id: string) {
    const item = full?.nodes.find(item => item.node.id === id);
    if (!item) return;
    setCollapsed(previous => {const next = new Set(previous); item.path.forEach(parent => next.delete(parent)); return next;});
    setSelectedId(id);
  }
  useEffect(() => {
    if (!diagram || !viewport.current) return;
    const position = diagram.nodes.find(item => item.node.id === selectedId);
    if (position) viewport.current.scrollTo({left: Math.max(0, position.x * zoom - viewport.current.clientWidth / 2 + NODE_WIDTH * zoom / 2), top: Math.max(0, position.y * zoom - viewport.current.clientHeight / 2 + NODE_HEIGHT * zoom / 2), behavior: "auto"});
  }, [selectedId, diagram, zoom]);
  return <section className="space-y-4" aria-label="Diagram mapping dan hierarki">
    <div className="dashboard-panel space-y-3">
      <h2 className="dashboard-heading"><GitBranch className="h-4 w-4" />Diagram aset &amp; equipment</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5 text-xs font-semibold"><span>Cari aset</span><SearchField aria-label="Cari aset untuk diagram" value={assetQuery} onChange={e => setAssetQuery(e.target.value)} placeholder="Nomor atau nama aset…" /></label>
        <label className="space-y-1.5 text-xs font-semibold"><span>Pilih aset</span><select aria-label="Pilih aset untuk diagram" value={assetId} onChange={e => setAssetId(e.target.value)} className="w-full rounded-lg border border-[#E8E2DB] bg-[#F6F4F0]/50 px-3 py-2 text-xs">{!assets.length && <option value="">Belum ada aset</option>}{matchingAssets.map(asset => <option key={asset.id} value={asset.id}>{asset.sap_asset_no} · {asset.name}</option>)}</select></label>
      </div>
    </div>
    {loading && <div role="status" className="dashboard-panel py-12 text-center text-sm text-[#547792]">Memuat diagram…</div>}
    {error && <div role="alert" className="dashboard-panel text-sm text-red-700">{error} <button type="button" onClick={() => {setError(""); setLoading(true); setRetry(n => n + 1);}} className="ml-2 underline">Coba lagi</button></div>}
    {!loading && !error && !root && <div className="dashboard-panel text-sm text-[#547792]">Belum ada aset untuk ditampilkan.</div>}
    {!loading && !error && root && diagram && <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[#547792]">{(full?.nodes.length || 1) - 1} equipment terikat · Klik simpul untuk detail. Geser area untuk menjelajah.</p>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button type="button" className="diagram-tool" onClick={() => setCollapsed(new Set())}>Buka semua</button>
          <button type="button" className="diagram-tool" onClick={() => setCollapsed(new Set(full?.nodes.map(item => item.node.id)))}>Tutup semua</button>
          <button type="button" className="diagram-tool" aria-label="Perkecil diagram" disabled={zoom <= .5} onClick={() => setZoom(z => Math.max(.5, +(z - .1).toFixed(1)))}><Minus className="h-4 w-4" /></button>
          <span aria-live="polite">{Math.round(zoom * 100)}%</span>
          <button type="button" className="diagram-tool" aria-label="Perbesar diagram" disabled={zoom >= 1.5} onClick={() => setZoom(z => Math.min(1.5, +(z + .1).toFixed(1)))}><Plus className="h-4 w-4" /></button>
          <button type="button" className="diagram-tool" aria-label="Reset tampilan diagram" onClick={() => {setZoom(1); setCollapsed(new Set()); setSelectedId(root.id); viewport.current?.scrollTo(0, 0);}}><RotateCcw className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0 space-y-2">
          <SearchField aria-label="Cari simpul diagram" value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari equipment pada diagram…" />
          {query.trim() && <div className="flex max-h-36 flex-wrap gap-2 overflow-auto rounded-lg border border-[#E8E2DB] bg-white p-2 text-xs" aria-label="Hasil pencarian simpul">{matches.length ? matches.map(item => <button type="button" className="diagram-tool" key={item.node.id} onClick={() => selectNode(item.node.id)}>{item.node.code} · {item.node.name}</button>) : <span>Tidak ada simpul yang cocok.</span>}</div>}
          <div ref={viewport} role="region" aria-label="Kanvas diagram interaktif" tabIndex={0} className="diagram-viewport h-[440px] overflow-auto rounded-xl border border-[#E8E2DB]" onPointerDown={event => {if (event.button !== 0 || (event.target as HTMLElement).closest('button,a')) return; const element = event.currentTarget; drag.current = {x: event.clientX, y: event.clientY, left: element.scrollLeft, top: element.scrollTop}; element.setPointerCapture(event.pointerId);}} onPointerMove={event => {if (!drag.current) return; event.currentTarget.scrollLeft = drag.current.left - (event.clientX - drag.current.x); event.currentTarget.scrollTop = drag.current.top - (event.clientY - drag.current.y);}} onPointerUp={() => {drag.current = null;}} onPointerCancel={() => {drag.current = null;}}>
            <div style={{width: diagram.width * zoom, height: diagram.height * zoom, minWidth: "100%", minHeight: "100%"}}>
              <div className="relative" style={{width: diagram.width, height: diagram.height, transform: `scale(${zoom})`, transformOrigin: "top left"}}>
                <svg aria-hidden="true" className="pointer-events-none absolute inset-0" width={diagram.width} height={diagram.height}>{diagram.nodes.filter(item => item.parentId).map(item => {const parent = diagram.nodes.find(p => p.node.id === item.parentId)!; const x = parent.x + NODE_WIDTH; const y = parent.y + NODE_HEIGHT / 2; return <path key={item.node.id} d={`M ${x} ${y} C ${x + 35} ${y}, ${item.x - 35} ${item.y + NODE_HEIGHT / 2}, ${item.x} ${item.y + NODE_HEIGHT / 2}`} fill="none" stroke="var(--diagram-line)" strokeWidth="2" />;})}</svg>
                {diagram.nodes.map(({node, x, y}) => <div key={node.id} className={`diagram-node ${selectedId === node.id ? "diagram-node-selected" : ""}`} style={{left: x, top: y, width: NODE_WIDTH, height: NODE_HEIGHT}}>
                  <button type="button" aria-pressed={selectedId === node.id} aria-label={`Lihat simpul ${node.code} ${node.name}`} onClick={() => selectNode(node.id)} className="flex h-full w-full items-start gap-2 p-3 text-left">
                    {node.type === "ASSET" ? <Box className="mt-1 h-4 w-4 shrink-0 text-[#FAB95B]" /> : <Cpu className="mt-1 h-4 w-4 shrink-0 text-[#547792]" />}
                    <span className="min-w-0 flex-1"><span className="block font-mono text-xs font-bold">{node.code}</span><span className="mt-1 block truncate text-xs" title={node.name}>{node.name}</span><span className="mt-1 block text-[10px] text-[#547792]">{node.type === "ASSET" ? "Aset SAP" : conditionLabels[node.condition || ""] || "Equipment"}</span></span>
                  </button>
                  {node.children.length > 0 && <button type="button" aria-expanded={!collapsed.has(node.id)} aria-label={`${collapsed.has(node.id) ? "Buka" : "Tutup"} cabang ${node.code}`} className="diagram-branch" onClick={() => setCollapsed(previous => {const next = new Set(previous); if (next.has(node.id)) next.delete(node.id); else next.add(node.id); return next;})}>{collapsed.has(node.id) ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}</button>}
                </div>)}
              </div>
            </div>
          </div>
          {root.children.length === 0 && <p className="text-xs text-[#547792]">Aset ini belum memiliki equipment terikat.</p>}
        </div>
        <aside className="dashboard-panel space-y-3 text-xs" aria-label="Detail simpul terpilih">
          <h3 className="dashboard-heading">Detail simpul</h3>
          {selected && <><p className="font-mono font-bold text-[#547792]">{selected.code}</p><p className="text-sm font-semibold">{selected.name}</p><dl className="space-y-2"><div><dt className="text-[#547792]">Jenis</dt><dd>{selected.type === "ASSET" ? "Aset SAP" : selected.kind === "COMPONENT" ? "Komponen" : "Equipment"}</dd></div><div><dt className="text-[#547792]">Status</dt><dd>{({ACTIVE: "Aktif", INACTIVE: "Nonaktif", DISPOSED: "Dilepas"} as Record<string,string>)[selected.status] || selected.status}</dd></div>{selected.condition && <div><dt className="text-[#547792]">Kondisi</dt><dd>{conditionLabels[selected.condition] || selected.condition}</dd></div>}<div><dt className="text-[#547792]">Equipment langsung di bawahnya</dt><dd>{selected.children.length}</dd></div></dl>{selected.specs?.length ? <ul className="space-y-1 border-t border-[#E8E2DB] pt-3">{selected.specs.map(spec => <li key={spec.id}>{spec.spec_name}: {spec.spec_value}</li>)}</ul> : null}<Link href={`/${selected.type === "ASSET" ? "assets" : "equipment"}/${selected.id}`} className="inline-flex rounded-lg bg-[#1A3263] px-3 py-2 font-semibold text-white">Buka detail lengkap</Link></>}
        </aside>
      </div>
    </>}
  </section>;
}
