"use client";

import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  Suspense,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Cpu,
  FileSpreadsheet,
  Plus,
  Search,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/components/ui/AppShell";

interface EnrichedEquipment {
  id: string;
  source_system: string;
  equipment_no: string;
  kind: string;
  name: string;
  specification: string | null;
  serial_no: string | null;
  condition: string;
  status: string;
  depth: number;
  is_unmapped: boolean;
  parent_kind: "ASSET" | "EQUIPMENT" | null;
  parent_label: string;
  root_asset_no: string | null;
  category_name: string;
  location_name: string;
  child_count: number;
}

function EquipmentContent() {
  const { can } = useAuth();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") || "";
  const initialCond = searchParams.get("condition") || "";

  const { current: requestSequence } = useRef({ value: 0 });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [references, setReferences] = useState<{
    categories: Array<{ id: string; name: string }>;
    locations: Array<{ id: string; name: string }>;
  }>({ categories: [], locations: [] });
  const [items, setItems] = useState<EnrichedEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(initialQ);
  const [condition, setCondition] = useState(initialCond);
  const [kind, setKind] = useState("");
  const status = searchParams.get("status") || "";
  const [saving, setSaving] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    equipment_category_id: "",
    location_id: "",
    source_system: "SAP_PM",
    equipment_no: "",
    name: "",
    kind: "COMPONENT",
    specification: "",
    serial_no: "",
    condition: "BAIK",
    status: "ACTIVE",
  });

  const loadEquipment = useCallback(async () => {
    const sequence = ++requestSequence.value;
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      if (q) params.set("q", q);
      if (condition) params.set("condition", condition);
      if (kind) params.set("kind", kind);
      if (status) params.set("status", status);
      const res = await fetch(`/api/v1/equipment?${params.toString()}`);
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error?.message || "Data equipment gagal dimuat.");
      if (sequence !== requestSequence.value) return;
      setItems(json.data || []);
      setTotal(json.meta?.total || 0);
      setTotalPages(json.meta?.total_pages || 1);
      setReferences({
        categories: json.references?.equipment_categories || [],
        locations: json.references?.locations || [],
      });
    } catch (error) {
      if (sequence === requestSequence.value)
        setErrorMsg(
          error instanceof Error
            ? error.message
            : "Periksa koneksi dan coba kembali.",
        );
    } finally {
      if (sequence === requestSequence.value) setLoading(false);
    }
  }, [q, condition, kind, page, requestSequence, status]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadEquipment();
    }, 200);
    return () => {
      clearTimeout(timer);
      requestSequence.value++;
    };
  }, [loadEquipment, requestSequence]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/v1/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          equipment_category_id: formData.equipment_category_id || null,
          location_id: formData.location_id || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error?.message || "Gagal menambah equipment.");
        return;
      }
      setShowCreateModal(false);
      setFormData((prev) => ({
        ...prev,
        equipment_no: "",
        name: "",
        specification: "",
        serial_no: "",
      }));
      loadEquipment();
    } catch {
      setErrorMsg("Data gagal disimpan. Periksa koneksi dan coba kembali.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-[#1A3263]">
            <Cpu className="h-6 w-6 text-[#547792]" />
            Daftar Equipment
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/equipment/unmapped"
            className="px-3.5 py-2.5 rounded-lg border border-[#FAB95B] bg-[#FEF6E7] text-[#8A580C] text-xs font-bold hover:bg-[#FAB95B]/30 transition"
          >
            Lihat Unmapped Equipment
          </Link>
          {can("import:equipment") && (
            <Link
              href="/equipment/import"
              className="inline-flex items-center gap-2 rounded-lg border border-[#E8E2DB] bg-white px-3.5 py-2 text-xs font-bold"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Import Excel
            </Link>
          )}
          {can("equipment:write") && (
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setShowCreateModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1A3263] hover:bg-[#122347] text-white text-xs font-bold shadow-sm transition"
            >
              <Plus className="w-4 h-4 text-[#FAB95B]" />
              <span>Tambah Equipment</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 rounded-xl bg-white border border-[#E8E2DB] flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#547792] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Cari Nomor Equipment, Nama, Spesifikasi, atau Serial Number..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-lg border border-[#E8E2DB] text-[#1A3263] bg-[#F6F4F0]/50 focus:bg-white outline-none focus:border-[#1A3263]"
          />
        </div>
        <select
          value={kind}
          onChange={(e) => {
            setKind(e.target.value);
            setPage(1);
          }}
          className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#E8E2DB] text-[#1A3263] bg-white"
        >
          <option value="">Semua Jenis Equipment</option>
          <option value="WHOLE_UNIT">Perangkat Utuh</option>
          <option value="COMPONENT">Komponen / Sub-Assembly</option>
          <option value="OTHER">Lainnya</option>
        </select>
        <select
          value={condition}
          onChange={(e) => {
            setCondition(e.target.value);
            setPage(1);
          }}
          className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#E8E2DB] text-[#1A3263] bg-white"
        >
          <option value="">Semua Kondisi Fisik</option>
          <option value="BAIK">BAIK</option>
          <option value="RUSAK_RINGAN">RUSAK RINGAN</option>
          <option value="RUSAK_BERAT">RUSAK BERAT</option>
          <option value="DALAM_PERBAIKAN">DALAM PERBAIKAN</option>
        </select>
      </div>

      {errorMsg && !showCreateModal && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {errorMsg}{" "}
          <button
            type="button"
            onClick={() => void loadEquipment()}
            className="ml-3 underline"
          >
            Coba kembali
          </button>
        </div>
      )}
      {/* Table */}
      <div className="rounded-xl bg-white border border-[#E8E2DB] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#E8E2DB]/60 border-b border-[#E8E2DB] text-[#1A3263]">
              <tr>
                <th className="py-3 px-4 font-bold">No. Equipment</th>
                <th className="py-3 px-4 font-bold">Nama &amp; Spesifikasi</th>
                <th className="py-3 px-4 font-bold">Jenis</th>
                <th className="py-3 px-4 font-bold">Induk Langsung</th>
                <th className="py-3 px-4 font-bold">Aset Induk (Root)</th>
                <th className="py-3 px-4 font-bold">Level</th>
                <th className="py-3 px-4 font-bold">Kondisi</th>
                <th className="py-3 px-4 font-bold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E2DB]/70">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#547792]">
                    Memuat data equipment...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#547792]">
                    Tidak ada equipment ditemukan.
                  </td>
                </tr>
              ) : (
                items.map((eq) => (
                  <tr key={eq.id} className="hover:bg-[#F6F4F0]/60 transition">
                    <td className="py-3 px-4 font-mono font-bold text-[#1A3263]">
                      {eq.equipment_no}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#1A3263]">{eq.name}</div>
                      {eq.specification && (
                        <div className="text-[11px] text-[#547792] truncate max-w-xs">
                          {eq.specification}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-[#EDF2F6] text-[#547792] font-semibold">
                        {eq.kind === "WHOLE_UNIT"
                          ? "Perangkat Utuh"
                          : eq.kind === "COMPONENT"
                            ? "Komponen"
                            : "Lainnya"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {eq.is_unmapped ? (
                        <span className="px-2 py-0.5 rounded bg-[#FEF6E7] text-[#8A580C] border border-[#FAB95B]/60 font-semibold">
                          Belum Termapping
                        </span>
                      ) : (
                        <span className="font-mono font-bold text-[#1A3263]">
                          {eq.parent_label}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-[#1A3263]">
                      {eq.root_asset_no || "-"}
                    </td>
                    <td className="py-3 px-4 text-[#547792] font-medium">
                      {eq.depth > 0 ? `Level ${eq.depth}` : "-"}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          eq.condition === "BAIK"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-[#FEF6E7] text-[#8A580C] border border-[#FAB95B]"
                        }`}
                      >
                        {eq.condition.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/equipment/${eq.id}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#1A3263] hover:text-[#547792]"
                      >
                        <span>Detail</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                      {can("equipment:write") && (
                        <Link
                          href={`/equipment/${eq.id}?edit=1`}
                          className="ml-3 inline-flex rounded-lg border border-[#E8E2DB] px-3 py-1.5 text-xs font-semibold text-[#1A3263]"
                        >
                          Ubah
                        </Link>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <span role="status">
          {total} data ditemukan · Halaman {page} dari {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={loading || page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border bg-white px-3 py-2"
          >
            Sebelumnya
          </button>
          <button
            type="button"
            disabled={loading || page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border bg-white px-3 py-2"
          >
            Berikutnya
          </button>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-[#1A3263]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-[#E8E2DB] space-y-4">
            <div className="flex items-center justify-between border-b border-[#E8E2DB] pb-3">
              <h2 className="text-base font-bold text-[#1A3263]">
                Tambah Daftar Equipment
              </h2>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="font-semibold">
                  Kategori
                  <select
                    value={formData.equipment_category_id}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        equipment_category_id: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-lg border p-2"
                  >
                    <option value="">Pilih kategori</option>
                    {references.categories.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="font-semibold">
                  Lokasi
                  <select
                    value={formData.location_id}
                    onChange={(e) =>
                      setFormData({ ...formData, location_id: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border p-2"
                  >
                    <option value="">Pilih lokasi</option>
                    {references.locations.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#1A3263] mb-1">
                    Nomor Equipment *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="EQ-401"
                    value={formData.equipment_no}
                    onChange={(e) =>
                      setFormData({ ...formData, equipment_no: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[#E8E2DB] text-[#1A3263]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#1A3263] mb-1">
                    Jenis Equipment *
                  </label>
                  <select
                    value={formData.kind}
                    onChange={(e) =>
                      setFormData({ ...formData, kind: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[#E8E2DB] bg-white text-[#1A3263]"
                  >
                    <option value="WHOLE_UNIT">Perangkat Utuh</option>
                    <option value="COMPONENT">Komponen</option>
                    <option value="OTHER">Lainnya</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#1A3263] mb-1">
                  Nama Equipment *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-[#E8E2DB] text-[#1A3263]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#1A3263] mb-1">
                    Nomor Seri
                  </label>
                  <input
                    type="text"
                    value={formData.serial_no}
                    onChange={(e) =>
                      setFormData({ ...formData, serial_no: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[#E8E2DB] text-[#1A3263]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#1A3263] mb-1">
                    Kondisi Fisik
                  </label>
                  <select
                    value={formData.condition}
                    onChange={(e) =>
                      setFormData({ ...formData, condition: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[#E8E2DB] bg-white text-[#1A3263]"
                  >
                    <option value="BAIK">BAIK</option>
                    <option value="RUSAK_RINGAN">RUSAK RINGAN</option>
                    <option value="RUSAK_BERAT">RUSAK BERAT</option>
                    <option value="DALAM_PERBAIKAN">DALAM PERBAIKAN</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#1A3263] mb-1">
                  Spesifikasi Teknis
                </label>
                <textarea
                  rows={2}
                  value={formData.specification}
                  onChange={(e) =>
                    setFormData({ ...formData, specification: e.target.value })
                  }
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
                  Simpan Equipment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EquipmentPage() {
  return (
    <Suspense
      fallback={
        <div className="text-sm text-[#547792]">Memuat daftar equipment...</div>
      }
    >
      <EquipmentContent />
    </Suspense>
  );
}
