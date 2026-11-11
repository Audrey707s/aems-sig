"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Unlink, GitBranch, ExternalLink } from "lucide-react";

interface UnmappedItem {
  id: string;
  equipment_no: string;
  name: string;
  kind: string;
  specification: string | null;
  condition: string;
  location_name: string;
  status: string;
}

export default function UnmappedEquipmentPage() {
  const [items, setItems] = useState<UnmappedItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/equipment?unmapped_only=true")
      .then(async r => { const body = await r.json(); if (!r.ok) throw new Error(body.error?.message || "Data gagal dimuat."); return body; })
      .then((res) => setItems(res.data || []))
      .catch(() => setError("Data gagal dimuat. Silakan muat ulang halaman."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-[#1A3263]">
            <Unlink className="w-6 h-6 text-[#547792]" />
            <span>Unmapped Equipment</span>
          </h1>
        </div>

        <Link
          href="/mapping"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1A3263] hover:bg-[#122347] text-white text-xs font-bold shadow-sm transition"
        >
          <GitBranch className="w-4 h-4 text-[#FAB95B]" />
          <span>Hubungkan ke Aset / Equipment Induk</span>
        </Link>
      </div>

      <div className="rounded-xl bg-white border border-[#E8E2DB] overflow-x-auto shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#E8E2DB]/60 border-b border-[#E8E2DB] text-[#1A3263]">
            <tr>
              <th className="py-3 px-4 font-bold">No. Equipment</th>
              <th className="py-3 px-4 font-bold">Nama Equipment</th>
              <th className="py-3 px-4 font-bold">Jenis</th>
              <th className="py-3 px-4 font-bold">Spesifikasi</th>
              <th className="py-3 px-4 font-bold">Lokasi</th>
              <th className="py-3 px-4 font-bold">Kondisi</th>
              <th className="py-3 px-4 font-bold text-right">Tindakan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E8E2DB]/70">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-[#547792]">
                  Memuat antrean unmapped equipment...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-[#547792]">
                  Seluruh equipment aktif telah termapping ke aset induk.
                </td>
              </tr>
            ) : (
              items.map((eq) => (
                <tr key={eq.id} className="hover:bg-[#F6F4F0]/60 transition">
                  <td className="py-3 px-4 font-mono font-bold text-[#1A3263]">
                    {eq.equipment_no}
                  </td>
                  <td className="py-3 px-4 font-bold text-[#1A3263]">{eq.name}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded bg-[#EDF2F6] text-[#547792] font-semibold">
                      {eq.kind === "WHOLE_UNIT"
                        ? "Perangkat Utuh"
                        : eq.kind === "COMPONENT"
                        ? "Komponen"
                        : "Lainnya"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-[#547792]">{eq.specification || "-"}</td>
                  <td className="py-3 px-4 text-[#1A3263]">{eq.location_name}</td>
                  <td className="py-3 px-4 font-bold text-[#1A3263]">{eq.condition}</td>
                  <td className="py-3 px-4 text-right space-x-3">
                    <Link
                      href={`/mapping?equipmentId=${eq.id}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#1A3263] hover:text-[#547792]"
                    >
                      <GitBranch className="w-3.5 h-3.5 text-[#FAB95B]" />
                      <span>Ajukan Mapping</span>
                    </Link>
                    <Link
                      href={`/equipment/${eq.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#547792] hover:text-[#1A3263]"
                    >
                      <span>Detail</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
