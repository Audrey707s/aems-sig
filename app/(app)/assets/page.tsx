"use client";

import React, { useEffect, useState, useCallback, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, Search, ExternalLink, AlertCircle } from "lucide-react";
import { useAuth } from "@/components/ui/AppShell";

interface EnrichedAsset {
  id: string;
  company_code: string;
  sap_asset_no: string;
  sap_sub_no: string;
  asset_key_norm: string;
  name: string;
  description: string | null;
  category_name: string;
  location_name: string;
  cost_center: string | null;
  acquisition_date: string | null;
  acquisition_value: number | null;
  currency: string;
  status: string;
  direct_equipment_count: number;
  total_equipment_count: number;
}

function AssetsContent() {
  const { can } = useAuth();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") || "";

  const { current: requestSequence } = useRef({ value: 0 });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [references, setReferences] = useState<{ categories: Array<{id: string; name: string}>; locations: Array<{id: string; name: string}> }>({categories: [], locations: []});
  const [items, setItems] = useState<EnrichedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(initialQ);
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [saving, setSaving] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    company_code: "MAIN",
    sap_asset_no: "",
    sap_sub_no: "0000",
    name: "",
    description: "",
    cost_center: "",
    acquisition_date: "",
    acquisition_value: "",
    asset_category_id: "",
    location_id: "",
    status: "ACTIVE",
  });

  const loadAssets = useCallback(async () => {
    const sequence = ++requestSequence.value;
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      if (q) params.set("q", q);
      if (status) params.set("status", status);
      const res = await fetch(`/api/v1/assets?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Data aset gagal dimuat.");
      if (sequence !== requestSequence.value) return;
      setItems(json.data || []);
      setTotal(json.meta?.total || 0);
      setTotalPages(json.meta?.total_pages || 1);
      setReferences({categories: json.references?.asset_categories || [], locations: json.references?.locations || []});
    } catch (error) {
      if (sequence === requestSequence.value) setErrorMsg(error instanceof Error ? error.message : "Periksa koneksi dan coba kembali.");
    } finally {
      if (sequence === requestSequence.value) setLoading(false);
    }
  }, [q, status, page, requestSequence]);

  useEffect(() => {
    const timer = setTimeout(() => { void loadAssets(); }, 200);
    return () => { clearTimeout(timer); requestSequence.value++; };
  }, [loadAssets, requestSequence]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setErrorMsg(null);
    try {
    const res = await fetch("/api/v1/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...formData, acquisition_value: formData.acquisition_value === "" ? null : Number(formData.acquisition_value), acquisition_date: formData.acquisition_date || null, asset_category_id: formData.asset_category_id || null, location_id: formData.location_id || null }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErrorMsg(json.error?.message || "Gagal menyimpan aset.");
      return;
    }
    setShowCreateModal(false);
    setFormData((prev) => ({ ...prev, sap_asset_no: "", name: "", description: "" }));
    loadAssets();
    } catch { setErrorMsg("Data gagal disimpan. Periksa koneksi dan coba kembali."); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1A3263]">
            Master Asset (SAP)
          </h1>
        </div>

        {can("asset:write") && (
          <button
            type="button"
            onClick={() => {
              setErrorMsg(null);
              setShowCreateModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1A3263] hover:bg-[#122347] text-white text-xs font-bold shadow-sm transition"
          >
            <Plus className="w-4 h-4 text-[#FAB95B]" />
            <span>Tambah Aset SAP</span>
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-xl bg-white border border-[#E8E2DB] flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#547792] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); } }
            placeholder="Cari Nomor Aset SAP, Nama Aset, Serial, atau Cost Center..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-lg border border-[#E8E2DB] text-[#1A3263] bg-[#F6F4F0]/50 focus:bg-white outline-none focus:border-[#1A3263]"
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); } }
          className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#E8E2DB] text-[#1A3263] bg-white"
        >
          <option value="">Semua Status</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
          <option value="DISPOSED">DISPOSED</option>
        </select>
      </div>

      {errorMsg && !showCreateModal && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorMsg} <button type="button" onClick={() => void loadAssets()} className="ml-3 underline">Coba kembali</button></div>}
      {/* Table */}
      <div className="rounded-xl bg-white border border-[#E8E2DB] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#E8E2DB]/60 border-b border-[#E8E2DB] text-[#1A3263]">
              <tr>
                <th className="py-3 px-4 font-bold">No. Aset SAP</th>
                <th className="py-3 px-4 font-bold">Sub</th>
                <th className="py-3 px-4 font-bold">Nama Aset</th>
                <th className="py-3 px-4 font-bold">Kategori</th>
                <th className="py-3 px-4 font-bold">Lokasi</th>
                <th className="py-3 px-4 font-bold">Nilai Perolehan</th>
                <th className="py-3 px-4 font-bold">Equipment Terhubung</th>
                <th className="py-3 px-4 font-bold">Status</th>
                <th className="py-3 px-4 font-bold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E2DB]/70">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-[#547792]">
                    Memuat data aset...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-[#547792]">
                    Tidak ada aset yang sesuai kriteria pencarian.
                  </td>
                </tr>
              ) : (
                items.map((asset) => (
                  <tr key={asset.id} className="hover:bg-[#F6F4F0]/60 transition">
                    <td className="py-3 px-4 font-mono font-bold text-[#1A3263]">
                      {asset.sap_asset_no}
                    </td>
                    <td className="py-3 px-4 font-mono text-[#547792]">{asset.sap_sub_no}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#1A3263]">{asset.name}</div>
                      {asset.description && (
                        <div className="text-[11px] text-[#547792] truncate max-w-xs">
                          {asset.description}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-[#1A3263]">{asset.category_name}</td>
                    <td className="py-3 px-4 text-[#547792]">{asset.location_name}</td>
                    <td className="py-3 px-4 font-mono font-semibold text-[#1A3263]">
                      {asset.acquisition_value !== null
                        ? `Rp ${Number(asset.acquisition_value).toLocaleString("id-ID")}`
                        : "Terbatas"}
                    </td>
                    <td className="py-3 px-4">
                      {asset.total_equipment_count > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#E8EEF7] text-[#1A3263]">
                          {asset.direct_equipment_count} Langsung / {asset.total_equipment_count} Total
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FEF6E7] text-[#8A580C] border border-[#FAB95B]/60">
                          Belum Ada Equipment
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          asset.status === "ACTIVE"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-[#E8E2DB] text-[#1A3263]"
                        }`}
                      >
                        {asset.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/assets/${asset.id}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#1A3263] hover:text-[#547792]"
                      >
                        <span>Detail &amp; Tree</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                      {can("asset:write") && <Link href={`/assets/${asset.id}?edit=1`} className="ml-3 inline-flex rounded-lg border border-[#E8E2DB] px-3 py-1.5 text-xs font-semibold text-[#1A3263]">Ubah</Link>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Asset Modal */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <span role="status">{total} data ditemukan · Halaman {page} dari {totalPages}</span>
        <div className="flex gap-2">
          <button type="button" disabled={loading || page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-lg border bg-white px-3 py-2">Sebelumnya</button>
          <button type="button" disabled={loading || page >= totalPages} onClick={() => setPage(p => p + 1)} className="rounded-lg border bg-white px-3 py-2">Berikutnya</button>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-[#1A3263]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-[#E8E2DB] space-y-4">
            <div className="flex items-center justify-between border-b border-[#E8E2DB] pb-3">
              <h2 className="text-base font-bold text-[#1A3263]">Tambah Master Asset (SAP)</h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-xs font-semibold text-[#547792] hover:text-[#1A3263]"
              >
                Tutup ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#1A3263] mb-1">Company Code *</label>
                  <input
                    type="text"
                    required
                    value={formData.company_code}
                    onChange={(e) => setFormData({ ...formData, company_code: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#E8E2DB] text-[#1A3263]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#1A3263] mb-1">No. Aset SAP *</label>
                  <input
                    type="text"
                    required
                    placeholder="SAP-005"
                    value={formData.sap_asset_no}
                    onChange={(e) => setFormData({ ...formData, sap_asset_no: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#E8E2DB] text-[#1A3263]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#1A3263] mb-1">Sub-Number *</label>
                  <input
                    type="text"
                    required
                    value={formData.sap_sub_no}
                    onChange={(e) => setFormData({ ...formData, sap_sub_no: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#E8E2DB] text-[#1A3263]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#1A3263] mb-1">Nama Aset *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#E8E2DB] text-[#1A3263]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#1A3263] mb-1">Cost Center</label>
                  <input
                    type="text"
                    value={formData.cost_center}
                    onChange={(e) => setFormData({ ...formData, cost_center: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#E8E2DB] text-[#1A3263]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#1A3263] mb-1">Nilai Perolehan (IDR)</label>
                  <input
                    type="number"
                    min={0}
                    value={formData.acquisition_value}
                    onChange={(e) =>
                      setFormData({ ...formData, acquisition_value: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[#E8E2DB] text-[#1A3263]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="font-semibold">Kategori
                  <select value={formData.asset_category_id} onChange={e => setFormData({...formData, asset_category_id: e.target.value})} className="mt-1 w-full rounded-lg border p-2">
                    <option value="">Pilih kategori</option>
                    {references.categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
                <label className="font-semibold">Lokasi
                  <select value={formData.location_id} onChange={e => setFormData({...formData, location_id: e.target.value})} className="mt-1 w-full rounded-lg border p-2">
                    <option value="">Pilih lokasi</option>
                    {references.locations.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
              </div>
              <div>
                <label className="block font-semibold text-[#1A3263] mb-1">Deskripsi</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#E8E2DB] text-[#1A3263]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E8E2DB]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg border border-[#E8E2DB] text-[#547792] font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-[#1A3263] hover:bg-[#122347] text-white font-bold"
                >
                  Simpan Aset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AssetsPage() {
  return (
    <Suspense fallback={<div className="text-sm text-[#547792]">Memuat daftar aset...</div>}>
      <AssetsContent />
    </Suspense>
  );
}
