"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2, GitBranch, AlertTriangle, Edit3 } from "lucide-react";
import { HierarchyTree } from "@/components/hierarchy/HierarchyTree";
import { HierarchyNode } from "@/lib/types/domain";
import { useAuth } from "@/components/ui/AppShell";

export default function AssetDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useAuth();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [detail, setDetail] = useState<any>(null);
  const [tree, setTree] = useState<HierarchyNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState("ACTIVE");

  const loadData = useCallback(async () => {
    setLoading(true);
    setDetail(null);
    setErrorMsg(null);
    try {
      const [resAsset, resTree] = await Promise.all([
        fetch(`/api/v1/assets/${params.id}`),
        fetch(`/api/v1/assets/${params.id}/tree`),
      ]);
      const jsonAsset = await resAsset.json();
      const jsonTree = await resTree.json();
      if (!resAsset.ok || !resTree.ok) throw new Error(jsonAsset.error?.message || jsonTree.error?.message || "Detail aset gagal dimuat.");
      if (jsonAsset.data) {
        setDetail(jsonAsset.data);
        setEditName(jsonAsset.data.asset.name);
        setEditStatus(jsonAsset.data.asset.status);
      }
      if (jsonTree.data) {
        setTree(jsonTree.data);
      }
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Periksa koneksi dan coba kembali.");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const res = await fetch(`/api/v1/assets/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName,
        status: editStatus,
        row_version: detail.asset.row_version,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErrorMsg(json.error?.message || "Gagal memperbarui aset.");
      return;
    }
    setEditing(false);
    loadData();
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const res = await fetch(`/api/v1/assets/${params.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: deleteReason }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErrorMsg(json.error?.message || "Gagal menghapus aset.");
      return;
    }
    router.push("/assets");
  };

  if (!loading && !detail) return <div role="alert" className="space-y-4 rounded-xl border bg-white p-6">
    <h1 className="text-xl font-bold">Detail tidak tersedia</h1>
    <p>{errorMsg || "Data tidak ditemukan."}</p>
    <button type="button" onClick={() => void loadData()} className="rounded-lg border px-4 py-2">Coba kembali</button>
    <Link href="/assets" className="ml-3 underline">Kembali ke daftar</Link>
  </div>;

  if (loading || !detail) {
    return <div className="text-sm text-[#547792]">Memuat detail aset...</div>;
  }

  const { asset, category_name, location_name, direct_equipment, history, audit_logs } = detail;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/assets"
            className="p-2 rounded-lg border border-[#E8E2DB] bg-white hover:bg-[#F6F4F0] text-[#1A3263]"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-[#1A3263] text-[#FAB95B]">
                {asset.sap_asset_no} (Sub {asset.sap_sub_no})
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                {asset.status}
              </span>
            </div>
            <h1 className="text-xl font-bold mt-1 text-[#1A3263]">{asset.name}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/mapping?assetId=${asset.id}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#547792]/40 bg-white text-xs font-bold text-[#1A3263] hover:bg-[#F6F4F0]"
          >
            <GitBranch className="w-3.5 h-3.5 text-[#547792]" />
            <span>Ajukan Mapping</span>
          </Link>
          {can("asset:write") && (
            <>
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1A3263] text-white text-xs font-bold"
              >
                <Edit3 className="w-3.5 h-3.5 text-[#FAB95B]" />
                <span>Ubah Aset</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setShowDeleteModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs font-bold hover:bg-red-100"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus</span>
              </button>
            </>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {editing && (
        <form
          onSubmit={handleUpdate}
          className="p-4 rounded-xl bg-white border border-[#E8E2DB] flex flex-wrap items-end gap-4 text-xs"
        >
          <div className="flex-1 min-w-[220px]">
            <label className="block font-semibold text-[#1A3263] mb-1">Nama Aset</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#E8E2DB] text-[#1A3263]"
            />
          </div>
          <div>
            <label className="block font-semibold text-[#1A3263] mb-1">Status Siklus Hidup</label>
            <select
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value)}
              className="px-3 py-2 rounded-lg border border-[#E8E2DB] bg-white text-[#1A3263]"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="DISPOSED">DISPOSED</option>
            </select>
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-[#1A3263] text-white font-bold"
          >
            Simpan Perubahan
          </button>
        </form>
      )}

      {/* Asset Metadata Card & Tree */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="p-5 rounded-xl bg-white border border-[#E8E2DB] space-y-3 text-xs shadow-sm">
          <h2 className="text-sm font-bold text-[#1A3263] border-b border-[#E8E2DB] pb-2">
            Informasi Induk Aset SAP
          </h2>
          <div className="grid grid-cols-2 gap-y-2.5">
            <span className="text-[#547792]">Company Code:</span>
            <span className="font-mono font-bold text-[#1A3263]">{asset.company_code}</span>
            <span className="text-[#547792]">Business Key:</span>
            <span className="font-mono font-bold text-[#1A3263]">{asset.asset_key_norm}</span>
            <span className="text-[#547792]">Kategori:</span>
            <span className="font-semibold text-[#1A3263]">{category_name}</span>
            <span className="text-[#547792]">Lokasi:</span>
            <span className="font-semibold text-[#1A3263]">{location_name}</span>
            <span className="text-[#547792]">Cost Center:</span>
            <span className="font-mono text-[#1A3263]">{asset.cost_center || "-"}</span>
            <span className="text-[#547792]">Tanggal Perolehan:</span>
            <span className="text-[#1A3263]">{asset.acquisition_date || "-"}</span>
            <span className="text-[#547792]">Nilai Perolehan:</span>
            <span className="font-mono font-bold text-[#1A3263]">
              {asset.acquisition_value !== null
                ? `Rp ${Number(asset.acquisition_value).toLocaleString("id-ID")}`
                : "Terbatas"}
            </span>
            <span className="text-[#547792]">Pabrikan / Model:</span>
            <span className="text-[#1A3263]">
              {asset.manufacturer || "-"} / {asset.model || "-"}
            </span>
            <span className="text-[#547792]">Nomor Seri:</span>
            <span className="font-mono text-[#1A3263]">{asset.serial_no || "-"}</span>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#1A3263]">
              Struktur Hierarki Aset &amp; Equipment ({direct_equipment.length} Level-1)
            </h2>
          </div>
          {tree ? (
            <HierarchyTree root={tree} highlightId={asset.id} />
          ) : (
            <div className="p-6 rounded-xl bg-white border border-[#E8E2DB] text-xs text-[#547792]">
              Belum ada struktur hierarki untuk aset ini.
            </div>
          )}
        </div>
      </div>

      {/* History & Audit Log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-5 rounded-xl bg-white border border-[#E8E2DB] shadow-sm">
          <h2 className="text-sm font-bold text-[#1A3263] mb-3">Riwayat Mapping pada Aset Ini</h2>
          {history.length === 0 ? (
            <p className="text-xs text-[#547792]">Belum ada histori perubahan mapping.</p>
          ) : (
            <div className="space-y-2 text-xs">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {history.map((h: any) => (
                <div
                  key={h.id}
                  className="p-3 rounded-lg bg-[#F6F4F0] border border-[#E8E2DB] flex justify-between"
                >
                  <div>
                    <div className="font-bold text-[#1A3263]">
                      {h.event_type} — {h.equipment_no} ({h.equipment_name})
                    </div>
                    <div className="text-[#547792] mt-0.5">Alasan: {h.reason}</div>
                  </div>
                  <div className="text-right text-[11px] text-[#547792]">
                    {new Date(h.occurred_at).toLocaleDateString("id-ID")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-5 rounded-xl bg-white border border-[#E8E2DB] shadow-sm">
          <h2 className="text-sm font-bold text-[#1A3263] mb-3">Log Audit Entitas</h2>
          <div className="space-y-2 text-xs">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {audit_logs.map((log: any) => (
              <div
                key={log.id}
                className="p-3 rounded-lg bg-[#F6F4F0] border border-[#E8E2DB] flex justify-between"
              >
                <div>
                  <span className="font-bold text-[#1A3263]">{log.action}</span> oleh{" "}
                  <span className="font-medium text-[#547792]">{log.actor_name}</span>
                </div>
                <span className="text-[11px] text-[#547792]">
                  {new Date(log.occurred_at).toLocaleString("id-ID")}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-[#1A3263]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleDelete}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#E8E2DB] space-y-4 text-xs"
          >
            <h2 className="text-base font-bold text-red-700">
              Konfirmasi Penghapusan Aset
            </h2>
            <p className="text-[#547792]">
              Aset yang masih memiliki equipment aktif terhubung tidak dapat dihapus sebelum seluruh relasi equipment dilepas terlebih dahulu.
            </p>
            <div>
              <label className="block font-semibold text-[#1A3263] mb-1">Alasan Penghapusan *</label>
              <textarea
                required
                rows={2}
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Contoh: Aset telah di-write-off..."
                className="w-full px-3 py-2 rounded-lg border border-[#E8E2DB] text-[#1A3263]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-lg border border-[#E8E2DB] text-[#547792] font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-red-600 text-white font-bold"
              >
                Hapus Aset
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
