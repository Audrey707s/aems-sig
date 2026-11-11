"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { FileSpreadsheet, FileText, Search } from "lucide-react";
import { ReportName } from "@/lib/db/reports";

const REPORT_Catalog: Array<{ name: ReportName; label: string; desc: string }> = [
  { name: "all-assets", label: "1. Seluruh Aset SAP", desc: "Daftar aset dan jumlah equipment terkait" },
  { name: "all-equipment", label: "2. Seluruh Equipment", desc: "Daftar perangkat, komponen, dan aset induk" },
  { name: "equipment-without-asset", label: "3. Equipment Tanpa Aset", desc: "Equipment yang belum terhubung ke aset SAP" },
  { name: "assets-without-equipment", label: "4. Aset Tanpa Equipment", desc: "Aset tanpa equipment terhubung" },
  { name: "inconsistent-data", label: "5. Data Tidak Konsisten", desc: "Temuan validasi dan rekonsiliasi" },
  { name: "movement-history", label: "6. Riwayat Perpindahan", desc: "Perubahan relasi dan perpindahan equipment" },
  { name: "master-change-history", label: "7. Riwayat Perubahan Master", desc: "Jejak perubahan data master" },
  { name: "import-history", label: "8. Riwayat Import", desc: "Riwayat pemrosesan data Excel" },
];

function ReportsContent() {
  const searchParams = useSearchParams();
  const initialReport = (searchParams.get("report") as ReportName) || "all-assets";

  const [selectedReport, setSelectedReport] = useState<ReportName>(initialReport);
  const [q, setQ] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      const res = await fetch(`/api/v1/reports/${selectedReport}?${params.toString()}`);
      const json = await res.json();
      setReportData(json.data);
    } finally {
      setLoading(false);
    }
  }, [selectedReport, q]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1A3263]">
            Pusat Laporan &amp; Ekspor
          </h1>
          <p className="text-sm text-[#547792] mt-0.5">
            Tinjau laporan operasional di layar dan unduh dokumen dalam format Excel (.xlsx) atau PDF.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`/api/v1/reports/${selectedReport}/export?format=xlsx${
              q ? `&q=${encodeURIComponent(q)}` : ""
            }`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Ekspor Excel (.xlsx)</span>
          </a>
          <a
            href={`/api/v1/reports/${selectedReport}/export?format=pdf${
              q ? `&q=${encodeURIComponent(q)}` : ""
            }`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-[#1A3263] hover:bg-[#122347] text-white text-xs font-bold shadow-sm transition"
          >
            <FileText className="w-4 h-4 text-[#FAB95B]" />
            <span>Ekspor PDF</span>
          </a>
        </div>
      </div>

      {/* Report Selector Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {REPORT_Catalog.map((item) => {
          const active = selectedReport === item.name;
          return (
            <button
              key={item.name}
              type="button"
              onClick={() => setSelectedReport(item.name)}
              className={`p-3.5 rounded-xl border text-left transition ${
                active
                  ? "bg-[#1A3263] text-white border-[#1A3263] shadow-sm"
                  : "bg-white border-[#E8E2DB] hover:border-[#547792]"
              }`}
            >
              <div className={`text-xs font-bold ${active ? "text-[#FAB95B]" : "text-[#1A3263]"}`}>
                {item.label}
              </div>
              <div className={`text-[11px] mt-1 line-clamp-2 ${active ? "text-[#E8E2DB]" : "text-[#547792]"}`}>
                {item.desc}
              </div>
            </button>
          );
        })}
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-xl bg-white border border-[#E8E2DB] flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#547792] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter kata kunci pada laporan aktif..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-lg border border-[#E8E2DB] text-[#1A3263] bg-[#F6F4F0]/50 focus:bg-white outline-none focus:border-[#1A3263]"
          />
        </div>
        <div className="text-xs text-[#547792] font-semibold">
          Total Baris: <b className="text-[#1A3263]">{reportData?.rows?.length || 0}</b>
        </div>
      </div>

      {/* Report Data Table */}
      <div className="rounded-xl bg-white border border-[#E8E2DB] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          {loading || !reportData ? (
            <div className="py-10 text-center text-xs text-[#547792]">Memuat laporan...</div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-[#E8E2DB]/60 border-b border-[#E8E2DB] text-[#1A3263]">
                <tr>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {reportData.columns.map((col: any) => (
                    <th key={col.key} className="py-3 px-4 font-bold">
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E2DB]/70">
                {reportData.rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={reportData.columns.length}
                      className="py-8 text-center text-[#547792]"
                    >
                      Tidak ada data untuk laporan ini.
                    </td>
                  </tr>
                ) : (
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  reportData.rows.map((row: any, idx: number) => (
                    <tr key={idx} className="hover:bg-[#F6F4F0]/60 transition">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {reportData.columns.map((col: any) => (
                        <td key={col.key} className="py-3 px-4 text-[#1A3263]">
                          {String(row[col.key] ?? "-")}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<div className="text-sm text-[#547792]">Memuat pusat laporan...</div>}>
      <ReportsContent />
    </Suspense>
  );
}
