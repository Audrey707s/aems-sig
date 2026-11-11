"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, Box, Cpu, GitBranch } from "lucide-react";

type AssetResult = { id: string; sap_asset_no: string; sap_sub_no: string; name: string; status: string; location_name?: string; attached_equipment_count: number; attached_equipment_nos: string[] };
type EquipmentResult = { id: string; equipment_no: string; name: string; kind: string; condition: string; root_asset_no?: string | null; root_asset_id?: string | null; active_parent_no?: string | null; breadcrumb?: Array<{ id: string; code: string; name: string; kind: string }> };
export default function UniversalSearchPage() {
  const params = useSearchParams();
  const q = params.get("q")?.trim() || "";
  const [results, setResults] = useState<{assets: AssetResult[]; equipment: EquipmentResult[]}>({assets: [], equipment: []});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!q) { setResults({assets: [], equipment: []}); return; }
    const ctrl = new AbortController();
    setLoading(true); setError("");
    fetch(`/api/v1/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
      .then(async r => { if (!r.ok) throw new Error("Pencarian tidak tersedia."); return r.json(); })
      .then(data => setResults({ assets: data.assets || [], equipment: data.equipment || [] }))
      .catch(e => { if (e.name !== "AbortError") setError(e.message); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [q]);
  return <div className="space-y-5">
    <div><h1 className="text-2xl font-bold text-[#1A3263]">Pencarian Universal</h1><p className="text-sm text-[#547792]">Temukan aset SAP, equipment, komponen, dan relasi hierarkinya dalam satu pencarian.</p></div>
    <form action="/search" className="flex gap-2 rounded-xl border bg-white p-3"><Search className="mt-2 h-5 w-5 text-[#547792]" /><input name="q" defaultValue={q} key={q} autoFocus placeholder="Nomor aset, equipment, serial, atau nama..." className="min-w-0 flex-1 px-2 outline-none" /><button className="rounded-lg bg-[#1A3263] px-4 py-2 text-sm font-semibold text-white">Cari</button></form>
    {loading && <p role="status">Mencari data...</p>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {!q && <p className="text-sm text-[#547792]">Masukkan kata kunci untuk melihat hasil lintas modul.</p>}
    {q && !loading && !error && <div className="grid gap-5 xl:grid-cols-2">
      <section className="rounded-xl border bg-white p-4"><h2 className="mb-4 flex items-center gap-2 font-bold"><Box className="h-5 w-5" /> Aset SAP ({results.assets.length})</h2>
        {results.assets.length === 0 && <p className="text-sm text-[#547792]">Tidak ada aset yang cocok.</p>}
        <div className="space-y-3">{results.assets.map(a => <Link href={`/assets/${a.id}`} key={a.id} className="block rounded-lg border p-3 hover:border-[#1A3263] hover:bg-[#F6F4F0]"><div className="flex justify-between gap-3"><span className="font-mono text-xs font-bold">{a.sap_asset_no} / {a.sap_sub_no}</span><span className="text-xs">{a.status}</span></div><div className="mt-1 font-semibold">{a.name}</div><div className="mt-2 text-xs text-[#547792]">{a.location_name || "Lokasi belum tersedia"} · {a.attached_equipment_count} equipment terkait</div>{a.attached_equipment_nos.length > 0 && <div className="mt-2 text-xs">Equipment: {a.attached_equipment_nos.slice(0,6).join(", ")}{a.attached_equipment_nos.length > 6 ? "…" : ""}</div>}</Link>)}</div>
      </section>
      <section className="rounded-xl border bg-white p-4"><h2 className="mb-4 flex items-center gap-2 font-bold"><Cpu className="h-5 w-5" /> Equipment ({results.equipment.length})</h2>
        {results.equipment.length === 0 && <p className="text-sm text-[#547792]">Tidak ada equipment yang cocok.</p>}
        <div className="space-y-3">{results.equipment.map(e => <div key={e.id} className="rounded-lg border p-3"><Link href={`/equipment/${e.id}`} className="block hover:underline"><span className="font-mono text-xs font-bold">{e.equipment_no}</span><div className="mt-1 font-semibold">{e.name}</div></Link><div className="mt-1 text-xs text-[#547792]">{e.kind} · {e.condition} · Induk: {e.active_parent_no || "Tidak ada"}</div>{e.root_asset_id && <Link href={`/assets/${e.root_asset_id}`} className="mt-2 block text-xs font-semibold text-[#1A3263] underline">Aset SAP: {e.root_asset_no}</Link>}{e.breadcrumb && e.breadcrumb.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-1 text-xs text-[#547792]"><GitBranch className="h-3.5 w-3.5" />{e.breadcrumb.map((n,i) => <span key={n.id}>{i > 0 ? " › " : ""}{n.code}</span>)}</div>}</div>)}</div>
      </section>
    </div>}
  </div>;
}
