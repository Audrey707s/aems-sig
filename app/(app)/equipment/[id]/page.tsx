"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  GitBranch,
  Trash2,
  ArrowUpCircle,
  Wrench,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/components/ui/AppShell";

export default function EquipmentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { can, user } = useAuth();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [specForm, setSpecForm] = useState({ spec_name: "", spec_value: "", spec_group: "General" });
  const [promotingSpecId, setPromotingSpecId] = useState<string | null>(null);
  const [promoteNo, setPromoteNo] = useState("");

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [cascadeSubtree, setCascadeSubtree] = useState(false);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/equipment/${params.id}`);
      const json = await res.json();
      if (json.data) setDetail(json.data);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleAddSpec = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const res = await fetch(`/api/v1/equipment/${params.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ADD_SPEC", ...specForm }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErrorMsg(json.error?.message || "Gagal menambah spesifikasi.");
      return;
    }
    setSpecForm({ spec_name: "", spec_value: "", spec_group: "General" });
    loadDetail();
  };

  const handlePromoteSpec = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promotingSpecId) return;
    setErrorMsg(null);
    const res = await fetch(`/api/v1/equipment/${params.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "PROMOTE_SPEC",
        spec_item_id: promotingSpecId,
        equipment_no: promoteNo,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErrorMsg(json.error?.message || "Gagal mempromosikan spesifikasi.");
      return;
    }
    setPromotingSpecId(null);
    setPromoteNo("");
    loadDetail();
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const res = await fetch(`/api/v1/equipment/${params.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: deleteReason, cascade_subtree: cascadeSubtree }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErrorMsg(json.error?.message || "Gagal menghapus equipment.");
      return;
    }
    router.push("/equipment");
  };

  if (loading || !detail) {
    return <div className="text-sm text-[#547792]">Memuat detail equipment...</div>;
  }

  const { equipment, active_parent, root_asset, direct_children, specs, history } = detail;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/equipment"
            className="p-2 rounded-lg border border-[#E8E2DB] bg-white hover:bg-[#F6F4F0] text-[#1A3263]"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-[#1A3263] text-[#FAB95B]">
                {equipment.equipment_no}
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-[#EDF2F6] text-[#547792] font-bold">
                {equipment.kind === "WHOLE_UNIT"
                  ? "Perangkat Utuh"
                  : equipment.kind === "COMPONENT"
                  ? "Komponen"
                  : "Lainnya"}
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                {equipment.condition}
              </span>
            </div>
            <h1 className="text-xl font-bold mt-1 text-[#1A3263]">{equipment.name}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/mapping?equipmentId=${equipment.id}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1A3263] hover:bg-[#122347] text-white text-xs font-bold"
          >
            <GitBranch className="w-3.5 h-3.5 text-[#FAB95B]" />
            <span>Pindahkan / Ubah Mapping</span>
          </Link>
          {can("equipment:write") && (
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
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Details & Hierarchy Context */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="p-5 rounded-xl bg-white border border-[#E8E2DB] space-y-3 text-xs shadow-sm">
          <h2 className="text-sm font-bold text-[#1A3263] border-b border-[#E8E2DB] pb-2">
            Identitas &amp; Posisi Hierarki
          </h2>
          <div className="grid grid-cols-2 gap-y-2.5">
            <span className="text-[#547792]">Source System:</span>
            <span className="font-mono font-bold text-[#1A3263]">{equipment.source_system}</span>
            <span className="text-[#547792]">Nomor Equipment:</span>
            <span className="font-mono font-bold text-[#1A3263]">{equipment.equipment_no}</span>
            <span className="text-[#547792]">Spesifikasi:</span>
            <span className="text-[#1A3263]">{equipment.specification || "-"}</span>
            <span className="text-[#547792]">Nomor Seri:</span>
            <span className="font-mono text-[#1A3263]">{equipment.serial_no || "-"}</span>
            <span className="text-[#547792]">Kedalaman (Depth):</span>
            <span className="font-bold text-[#1A3263]">
              {equipment.depth > 0 ? `Level ${equipment.depth}` : "Mandiri (0)"}
            </span>
            <span className="text-[#547792]">Induk Langsung:</span>
            <span className="font-mono font-bold text-[#1A3263]">
              {active_parent ? `${active_parent.parent_kind}` : "Belum Termapping"}
            </span>
            <span className="text-[#547792]">Aset Induk (Root):</span>
            <span>
              {root_asset ? (
                <Link
                  href={`/assets/${root_asset.id}`}
                  className="font-mono font-bold text-[#1A3263] hover:text-[#547792] underline"
                >
                  {root_asset.sap_asset_no} ({root_asset.name})
                </Link>
              ) : (
                "-"
              )}
            </span>
          </div>
        </div>

        {/* Direct Children */}
        <div className="p-5 rounded-xl bg-white border border-[#E8E2DB] space-y-3 text-xs shadow-sm">
          <h2 className="text-sm font-bold text-[#1A3263] border-b border-[#E8E2DB] pb-2">
            Sub-Equipment / Komponen Anak ({direct_children.length})
          </h2>
          {direct_children.length === 0 ? (
            <p className="text-[#547792]">Tidak ada sub-equipment langsung di bawah unit ini.</p>
          ) : (
            <div className="space-y-2">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {direct_children.map((ch: any) => (
                <Link
                  key={ch.id}
                  href={`/equipment/${ch.id}`}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-[#F6F4F0] hover:bg-[#E8E2DB]/60 border border-[#E8E2DB] transition"
                >
                  <div>
                    <span className="font-mono font-bold text-[#1A3263] mr-2">
                      {ch.equipment_no}
                    </span>
                    <span className="font-semibold text-[#1A3263]">{ch.name}</span>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#EDF2F6] text-[#547792]">
                    Level {ch.depth}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Unnumbered Specification Items & Promotion */}
        <div className="p-5 rounded-xl bg-white border border-[#E8E2DB] space-y-3 text-xs shadow-sm">
          <h2 className="text-sm font-bold text-[#1A3263] border-b border-[#E8E2DB] pb-2 flex items-center gap-1.5">
            <Wrench className="w-4 h-4 text-[#FAB95B]" />
            <span>Komponen Spesifikasi</span>
          </h2>
          <div className="space-y-2">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {specs.map((sp: any) => (
              <div
                key={sp.id}
                className="p-2.5 rounded-lg bg-[#F6F4F0] border border-[#E8E2DB] space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#1A3263]">{sp.spec_name}</span>
                  {sp.promoted_equipment_id ? (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                      Telah Dipromosikan
                    </span>
                  ) : (
                    can("spec:write") && (
                      <button
                        type="button"
                        onClick={() => setPromotingSpecId(sp.id)}
                        className="inline-flex items-center gap-1 text-[11px] text-[#1A3263] hover:text-[#547792] font-bold"
                      >
                        <ArrowUpCircle className="w-3.5 h-3.5 text-[#FAB95B]" />
                        <span>Promosikan ke Equipment</span>
                      </button>
                    )
                  )}
                </div>
                <div className="text-[#547792]">{sp.spec_value}</div>
              </div>
            ))}
          </div>

          {promotingSpecId && (
            <form
              onSubmit={handlePromoteSpec}
              className="p-3 rounded-lg bg-[#FEF6E7] border border-[#FAB95B] space-y-2"
            >
              <div className="font-bold text-[#8A580C]">
                Promosikan Spesifikasi menjadi Equipment Resmi
              </div>
              <input
                type="text"
                required
                placeholder="Nomor Equipment Baru (mis. EQ-109)"
                value={promoteNo}
                onChange={(e) => setPromoteNo(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded border border-[#FAB95B] bg-white text-[#1A3263]"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPromotingSpecId(null)}
                  className="px-2.5 py-1 text-[#547792] font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 rounded bg-[#1A3263] text-white font-bold"
                >
                  Promosikan
                </button>
              </div>
            </form>
          )}

          {can("spec:write") && (
            <form onSubmit={handleAddSpec} className="pt-2 border-t border-[#E8E2DB] space-y-2">
              <div className="font-semibold text-[#547792]">Tambah Atribut Spesifikasi</div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  placeholder="Nama (mis. Layar)"
                  value={specForm.spec_name}
                  onChange={(e) => setSpecForm({ ...specForm, spec_name: e.target.value })}
                  className="px-2.5 py-1.5 rounded border border-[#E8E2DB] text-[#1A3263]"
                />
                <input
                  type="text"
                  required
                  placeholder="Nilai (mis. 14 inci)"
                  value={specForm.spec_value}
                  onChange={(e) => setSpecForm({ ...specForm, spec_value: e.target.value })}
                  className="px-2.5 py-1.5 rounded border border-[#E8E2DB] text-[#1A3263]"
                />
              </div>
              <button
                type="submit"
                className="w-full py-1.5 rounded bg-[#547792] hover:bg-[#1A3263] text-white font-bold transition"
              >
                + Tambah Spesifikasi
              </button>
            </form>
          )}
        </div>
      </div>

      {/* History */}
      <div className="p-5 rounded-xl bg-white border border-[#E8E2DB] shadow-sm">
        <h2 className="text-sm font-bold text-[#1A3263] mb-3">
          Riwayat Perpindahan &amp; Mapping Equipment
        </h2>
        {history.length === 0 ? (
          <p className="text-xs text-[#547792]">Belum ada riwayat perubahan mapping.</p>
        ) : (
          <div className="space-y-2 text-xs">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {history.map((h: any) => (
              <div
                key={h.id}
                className="p-3 rounded-lg bg-[#F6F4F0] border border-[#E8E2DB] flex justify-between"
              >
                <div>
                  <span className="font-bold text-[#1A3263] mr-2">{h.event_type}</span>
                  <span className="text-[#1A3263]">
                    Dari: <b>{h.from_parent_no || "Unmapped"}</b> → Ke:{" "}
                    <b>{h.to_parent_no || "Unmapped"}</b> (Aset: {h.to_asset_no || "-"})
                  </span>
                  <div className="text-[#547792] mt-0.5">Alasan: {h.reason}</div>
                </div>
                <div className="text-right text-[11px] text-[#547792]">
                  {new Date(h.occurred_at).toLocaleString("id-ID")}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-[#1A3263]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleDelete}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#E8E2DB] space-y-4 text-xs"
          >
            <h2 className="text-base font-bold text-red-700">
              Konfirmasi Penghapusan Equipment
            </h2>
            <p className="text-[#547792]">
              Equipment yang masih memiliki sub-equipment aktif tidak dapat dihapus secara langsung kecuali menggunakan opsi penghapusan bertingkat oleh Administrator.
            </p>
            {user?.role === "ADMIN" && direct_children.length > 0 && (
              <label className="flex items-center gap-2 p-2.5 rounded-lg bg-[#FEF6E7] border border-[#FAB95B] text-[#8A580C] font-semibold">
                <input
                  type="checkbox"
                  checked={cascadeSubtree}
                  onChange={(e) => setCascadeSubtree(e.target.checked)}
                />
                <span>Nonaktifkan beserta seluruh sub-equipment di bawahnya</span>
              </label>
            )}
            <div>
              <label className="block font-semibold text-[#1A3263] mb-1">Alasan Penghapusan *</label>
              <textarea
                required
                rows={2}
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Alasan penghapusan..."
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
                Hapus Equipment
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
