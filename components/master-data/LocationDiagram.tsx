"use client";
import {useMemo, useRef, useState, useEffect} from "react";
import Link from "next/link";
import {MapPin, ChevronDown, ChevronRight, Minus, Plus, RotateCcw} from "lucide-react";
import type {ReferenceItem} from "@/lib/types/domain";
import {locationForest} from "@/lib/location-diagram";
import {layoutHierarchy, NODE_WIDTH, NODE_HEIGHT} from "@/lib/hierarchy-diagram";
import {SearchField} from "@/components/ui/SearchField";
export function LocationDiagram({rows, onEdit}: {rows: ReferenceItem[]; onEdit?: (row: ReferenceItem) => void}) {
 const [rootId,setRootId]=useState("");
 const [query,setQuery]=useState("");
 const [selectedId,setSelectedId]=useState("");
 const [collapsed,setCollapsed]=useState<Set<string>>(new Set());
 const [zoom,setZoom]=useState(1);
 const viewport=useRef<HTMLDivElement>(null);
 const drag=useRef<{x:number;y:number;left:number;top:number}|null>(null);
 const forest=useMemo(()=>locationForest(rows),[rows]);
 const full=useMemo(()=>layoutHierarchy(forest),[forest]);
 const root=full.nodes.find(item=>item.node.id===rootId)?.node || forest;
 const diagram=useMemo(()=>layoutHierarchy(root,collapsed),[root,collapsed]);
 const selected=full.nodes.find(item=>item.node.id===selectedId);
 const row=rows.find(item=>item.id===selectedId);
 const matches=query.trim() ? full.nodes.filter(item=>item.node.id!==forest.id && `${item.node.code} ${item.node.name}`.toLocaleLowerCase("id").includes(query.trim().toLocaleLowerCase("id"))) : [];
 function selectNode(id:string) {const item=full.nodes.find(item=>item.node.id===id); if(!item)return; if(rootId && id!==rootId && !item.path.includes(rootId))setRootId(""); setCollapsed(previous=>{const next=new Set(previous);item.path.forEach(parent=>next.delete(parent));return next;});setSelectedId(id);}
 useEffect(()=>{const item=diagram.nodes.find(item=>item.node.id===selectedId);if(item)viewport.current?.scrollTo({left:Math.max(0,item.x*zoom-100),top:Math.max(0,item.y*zoom-100)});},[diagram,selectedId,zoom]);
 return <section className="space-y-4" aria-label="Denah lokasi interaktif">
 <div className="dashboard-panel space-y-3"><h2 className="dashboard-heading"><MapPin size={16}/>Denah hierarki lokasi</h2>
 <p className="text-sm text-[#547792]">Pilih lokasi untuk menjelajahi cabangnya. Garis menunjukkan susunan lokasi induk dan anak.</p>
 <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm">Fokus lokasi<select className="w-full rounded-lg border bg-white p-2.5" value={rootId} onChange={e=>{setRootId(e.target.value);setCollapsed(new Set());setSelectedId(e.target.value);}}><option value="">Seluruh lokasi</option>{rows.map(row=><option key={row.id} value={row.id}>{row.name} ({row.code})</option>)}</select></label><label className="space-y-1 text-sm">Cari lokasi<SearchField aria-label="Cari lokasi di denah" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nama atau kode lokasi…"/></label></div>
 {query.trim() && <div className="flex max-h-36 flex-wrap gap-2 overflow-auto" aria-label="Hasil pencarian lokasi">{matches.length ? matches.map(item=><button className="diagram-tool" key={item.node.id} onClick={()=>selectNode(item.node.id)}>{item.node.name} · {item.node.code}</button>):<p className="text-sm">Lokasi tidak ditemukan.</p>}</div>}
 <div className="flex flex-wrap items-center gap-2"><button className="diagram-tool" aria-label="Perkecil denah" disabled={zoom<=0.4} onClick={()=>setZoom(z=>Math.max(.4,z-.2))}><Minus size={16}/></button><span className="text-xs">{Math.round(zoom*100)}%</span><button className="diagram-tool" aria-label="Perbesar denah" disabled={zoom>=2} onClick={()=>setZoom(z=>Math.min(2,z+.2))}><Plus size={16}/></button><button className="diagram-tool" onClick={()=>{setZoom(1);setCollapsed(new Set());setRootId("");setSelectedId("");viewport.current?.scrollTo(0,0);}}><RotateCcw size={14}/>Reset denah</button><button className="diagram-tool" onClick={()=>setCollapsed(new Set())}>Buka semua cabang</button></div></div>
 {!rows.length ? <p className="dashboard-panel text-sm">Belum ada lokasi. Tambahkan lokasi untuk membentuk denah.</p> : <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]"><div className="min-w-0">
          <div ref={viewport} role="region" aria-label="Kanvas diagram interaktif" tabIndex={0} className="diagram-viewport h-[440px] overflow-auto rounded-xl border border-[#E8E2DB]" onPointerDown={event => {if (event.button !== 0 || (event.target as HTMLElement).closest('button,a')) return; const element = event.currentTarget; drag.current = {x: event.clientX, y: event.clientY, left: element.scrollLeft, top: element.scrollTop}; element.setPointerCapture(event.pointerId);}} onPointerMove={event => {if (!drag.current) return; event.currentTarget.scrollLeft = drag.current.left - (event.clientX - drag.current.x); event.currentTarget.scrollTop = drag.current.top - (event.clientY - drag.current.y);}} onPointerUp={() => {drag.current = null;}} onPointerCancel={() => {drag.current = null;}}>
            <div style={{width: diagram.width * zoom, height: diagram.height * zoom, minWidth: "100%", minHeight: "100%"}}>
              <div className="relative" style={{width: diagram.width, height: diagram.height, transform: `scale(${zoom})`, transformOrigin: "top left"}}>
                <svg aria-hidden="true" className="pointer-events-none absolute inset-0" width={diagram.width} height={diagram.height}>{diagram.nodes.filter(item => item.parentId).map(item => {const parent = diagram.nodes.find(p => p.node.id === item.parentId)!; const x = parent.x + NODE_WIDTH; const y = parent.y + NODE_HEIGHT / 2; return <path key={item.node.id} d={`M ${x} ${y} C ${x + 35} ${y}, ${item.x - 35} ${item.y + NODE_HEIGHT / 2}, ${item.x} ${item.y + NODE_HEIGHT / 2}`} fill="none" stroke="var(--diagram-line)" strokeWidth="2" />;})}</svg>
                {diagram.nodes.map(({node, x, y}) => <div key={node.id} className={`diagram-node ${selectedId === node.id ? "diagram-node-selected" : ""}`} style={{left: x, top: y, width: NODE_WIDTH, height: NODE_HEIGHT}}>
                  <button type="button" aria-pressed={selectedId === node.id} aria-label={`Lihat simpul ${node.code} ${node.name}`} onClick={() => selectNode(node.id)} className="flex h-full w-full items-start gap-2 p-3 text-left">
                    {node.type === "ASSET" ? <MapPin className="mt-1 h-4 w-4 shrink-0 text-[#FAB95B]" /> : <MapPin className="mt-1 h-4 w-4 shrink-0 text-[#547792]" />}
                    <span className="min-w-0 flex-1"><span className="block font-mono text-xs font-bold">{node.code}</span><span className="mt-1 block truncate text-xs" title={node.name}>{node.name}</span><span className="mt-1 block text-[10px] text-[#547792]">{node.status === "ACTIVE" ? "Aktif" : "Nonaktif"}</span></span>
                  </button>
                  {node.children.length > 0 && <button type="button" aria-expanded={!collapsed.has(node.id)} aria-label={`${collapsed.has(node.id) ? "Buka" : "Tutup"} cabang ${node.code}`} className="diagram-branch" onClick={() => setCollapsed(previous => {const next = new Set(previous); if (next.has(node.id)) next.delete(node.id); else next.add(node.id); return next;})}>{collapsed.has(node.id) ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}</button>}
                </div>)}
              </div>
            </div>
          </div>
</div><aside className="dashboard-panel space-y-3 text-sm" aria-label="Detail lokasi"><h3 className="dashboard-heading">Detail lokasi</h3>{row && selected ? <><p className="font-semibold">{row.name}</p><p className="font-mono text-xs">{row.code}</p><p className="text-xs text-[#547792]">{[...selected.path.map(id=>rows.find(r=>r.id===id)?.name).filter(Boolean),row.name].join(" → ")}</p><dl className="space-y-2"><div><dt>Induk</dt><dd>{rows.find(r=>r.id===row.parent_id)?.name || "Tanpa induk"}</dd></div><div><dt>Status</dt><dd>{row.is_active ? "Aktif":"Nonaktif"}</dd></div><div><dt>Lokasi anak langsung</dt><dd>{selected.node.children.length}</dd></div></dl><Link className="diagram-tool" href={`/assets?location_id=${encodeURIComponent(row.id)}`}>Lihat aset di lokasi</Link>{onEdit && <button className="diagram-tool" onClick={()=>onEdit(row)}>Ubah lokasi</button>}</>:<p className="text-[#547792]">Klik lokasi pada denah untuk melihat detail.</p>}</aside></div>}
 <p className="text-xs text-[#547792]">Denah ini menggambarkan hierarki lokasi, bukan ukuran atau posisi geografis sebenarnya. Geser kanvas atau gunakan scroll untuk menjelajah.</p>
 </section>;
}
