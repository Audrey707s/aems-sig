"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Play,
} from "lucide-react";
import {
  CommitMode,
  DuplicateRowDecision,
  ImportBatchRecord,
  ImportType,
} from "@/lib/types/domain";

export default function ImportsPage() {
  const demoControlsEnabled = process.env.NEXT_PUBLIC_AEMS_DEMO_MODE === "true";
  const [importType, setImportType] = useState<ImportType>("ASSET_MASTER");
  const [commitMode, setCommitMode] = useState<CommitMode>("PARTIAL");
  const [defaultDuplicateAction, setDefaultDuplicateAction] =
    useState<DuplicateRowDecision>("SKIP");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [activeBatch, setActiveBatch] = useState<ImportBatchRecord | null>(null);
  const [rowDecisions, setRowDecisions] = useState<Record<number, DuplicateRowDecision>>({});
  const [history, setHistory] = useState<ImportBatchRecord[]>([]);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/imports");
      const json = await res.json();
      if (!res.ok) throw new Error();
      setHistory(json.data || []);
    } catch { setErrorMsg("Riwayat import gagal dimuat. Silakan coba kembali."); }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleUploadPreview = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setUploading(true);
    try {
      let res: Response;
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("import_type", importType);
        fd.append("commit_mode", commitMode);
        fd.append("default_duplicate_action", defaultDuplicateAction);
        res = await fetch("/api/v1/imports", { method: "POST", body: fd });
      } else {
        setErrorMsg("Silakan pilih berkas Excel (.xlsx).");
        setUploading(false);
        return;
      }

      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error?.message || "Gagal memvalidasi berkas Excel.");
        return;
      }
      setActiveBatch(json.data);
      setRowDecisions({});
      loadHistory();
    } catch { setErrorMsg("Pratinjau gagal dimuat. Periksa koneksi dan coba kembali."); } finally {
      setUploading(false);
    }
  };

  const handleQuickDemoSample = async () => {
    setErrorMsg(null);
    setUploading(true);
    try {
      const sampleRows =
        importType === "ASSET_MASTER"
          ? [
              {
                company_code: "MAIN",
                sap_asset_no: "SAP-010",
                sap_sub_no: "0000",
                name: "Kompresor Udara Screw Atlas Copco",
                cost_center: "CC-3100",
                acquisition_date: "2026-10-01",
                acquisition_value: 125000000,
                status: "ACTIVE",
                description: "Unit kompresor tekanan tinggi area utilitas",
              },
              {
                company_code: "MAIN",
                sap_asset_no: "SAP-001",
                sap_sub_no: "0000",
                name: "Laptop Lenovo ThinkPad T14 (Pembaruan)",
                cost_center: "CC-1100",
                acquisition_date: "2026-01-15",
                acquisition_value: 19200000,
                status: "ACTIVE",
                description: "Pembaruan spesifikasi dan nilai perolehan",
              },
            ]
          : importType === "EQUIPMENT_MASTER"
          ? [
              {
                source_system: "SAP_PM",
                equipment_no: "EQ-501",
                name: "Inverter VFD 55kW",
                kind: "COMPONENT",
                serial_no: "SN-VFD-501",
                condition: "BAIK",
                status: "ACTIVE",
                specification: "ABB ACS580 3-Phase",
              },
              {
                source_system: "SAP_PM",
                equipment_no: "EQ-101",
                name: "SSD NVMe 512GB Enterprise",
                kind: "COMPONENT",
                serial_no: "SN-SSD-101",
                condition: "BAIK",
                status: "ACTIVE",
                specification: "PCIe 4.0 M.2 2280",
              },
            ]
          : [
              {
                equipment_no: "EQ-900",
                parent_type: "ASSET",
                parent_no: "SAP-004",
                company_code: "MAIN",
                sap_sub_no: "0000",
                reason: "Mapping printer cadangan ke aset SAP-004",
              },
            ];

      const res = await fetch("/api/v1/imports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          import_type: importType,
          file_name: `Contoh_${importType}.xlsx`,
          commit_mode: commitMode,
          default_duplicate_action: defaultDuplicateAction,
          rows: sampleRows,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error?.message || "Gagal membuat pratinjau contoh.");
        return;
      }
      setActiveBatch(json.data);
      setRowDecisions({});
      loadHistory();
    } catch { setErrorMsg("Pratinjau gagal dimuat. Periksa koneksi dan coba kembali."); } finally {
      setUploading(false);
    }
  };

  const handleCommit = async () => {
    if (!activeBatch) return;
    setErrorMsg(null);
    setCommitting(true);
    try {
      const decisions = Object.entries(rowDecisions).map(([rowNumber, action]) => ({
        row_number: Number(rowNumber),
        action,
      }));
      const res = await fetch(`/api/v1/imports/${activeBatch.id}/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commit_mode: commitMode,
          default_duplicate_action: defaultDuplicateAction,
          decisions,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error?.message || "Gagal menjalankan commit import.");
        return;
      }
      setActiveBatch(json.data);
      loadHistory();
    } catch { setErrorMsg("Import gagal diproses. Periksa koneksi dan status batch sebelum mencoba kembali."); } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1A3263]">
            Import Data Massal Excel (.xlsx)
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/api/v1/imports/templates/${importType}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#E8E2DB] bg-white text-xs font-bold text-[#1A3263] hover:bg-[#F6F4F0]"
          >
            <Download className="w-3.5 h-3.5 text-[#547792]" />
            <span>Unduh Template ({importType})</span>
          </a>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="font-semibold">{errorMsg}</span>
        </div>
      )}

      {/* Upload & Stage Configuration Card */}
      <div className="p-6 rounded-xl bg-white border border-[#E8E2DB] shadow-sm space-y-4 text-xs">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block font-semibold text-[#1A3263] mb-1">
              1. Pilih Jenis Import Excel
            </label>
            <select
              value={importType}
              onChange={(e) => setImportType(e.target.value as ImportType)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#E8E2DB] bg-white font-semibold text-[#1A3263]"
            >
              <option value="ASSET_MASTER">Master Asset (SAP)</option>
              <option value="EQUIPMENT_MASTER">Master Equipment</option>
              <option value="MAPPING">Mapping Awal / Massal</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-[#1A3263] mb-1">
              2. Mode Penyimpanan (Commit Mode)
            </label>
            <select
              value={commitMode}
              onChange={(e) => setCommitMode(e.target.value as CommitMode)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#E8E2DB] bg-white font-semibold text-[#1A3263]"
            >
              <option value="PARTIAL">PARTIAL — Simpan baris valid, lewati baris galat</option>
              <option value="ATOMIC">ATOMIC — Batalkan seluruh batch jika ada 1 baris galat</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-[#1A3263] mb-1">
              3. Kebijakan Default Baris Duplikat
            </label>
            <select
              value={defaultDuplicateAction}
              onChange={(e) => setDefaultDuplicateAction(e.target.value as DuplicateRowDecision)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#E8E2DB] bg-white font-semibold text-[#1A3263]"
            >
              <option value="SKIP">SKIP — Pertahankan data lama di sistem</option>
              <option value="REPLACE">REPLACE — Perbarui atribut dari berkas Excel</option>
            </select>
          </div>
        </div>

        <form
          onSubmit={handleUploadPreview}
          className="pt-3 border-t border-[#E8E2DB] flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <input
              type="file"
              accept=".xlsx"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="text-xs file:mr-3 file:py-2 file:px-3.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#E8EEF7] file:text-[#1A3263] hover:file:bg-[#E8E2DB]"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {demoControlsEnabled && <button
              type="button"
              onClick={handleQuickDemoSample}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-[#E8E2DB] bg-[#F6F4F0] hover:bg-[#E8E2DB]/70 text-[#1A3263] font-bold transition"
            >
              <Play className="w-3.5 h-3.5 text-[#547792]" />
              <span>Muat Data Contoh</span>
            </button>}
            <button
              type="submit"
              disabled={uploading}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#1A3263] hover:bg-[#122347] text-white font-bold shadow-sm transition"
            >
              <Upload className="w-3.5 h-3.5 text-[#FAB95B]" />
              <span>{uploading ? "Memvalidasi..." : "Unggah & Pratinjau"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Stage 3 & 4: Preview & Duplicate Resolution Table */}
      {activeBatch && (
        <div className="p-6 rounded-xl bg-white border border-[#E8E2DB] shadow-sm space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E8E2DB] pb-3">
            <div>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-[#1A3263]" />
                <h2 className="text-base font-bold text-[#1A3263]">
                  Pratinjau Batch: {activeBatch.file_name}
                </h2>
                <span className="px-2.5 py-0.5 rounded bg-[#E8EEF7] text-[#1A3263] font-bold">
                  {activeBatch.status}
                </span>
              </div>
              <p className="text-[#547792] mt-1">
                Total: <b>{activeBatch.total_count}</b> baris | Baru:{" "}
                <b className="text-emerald-700">{activeBatch.new_count}</b> | Duplikat:{" "}
                <b className="text-[#8A580C]">{activeBatch.dup_count}</b> | Tidak Valid:{" "}
                <b className="text-red-700">{activeBatch.invalid_count}</b>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={`/api/v1/imports/${activeBatch.id}/error-report`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E8E2DB] text-[#1A3263] font-bold hover:bg-[#F6F4F0]"
              >
                <Download className="w-3.5 h-3.5 text-[#547792]" />
                <span>Unduh Laporan Validasi (.xlsx)</span>
              </a>

              {(activeBatch.status === "READY_FOR_REVIEW" || activeBatch.status === "READY") && (
                <button
                  type="button"
                  onClick={handleCommit}
                  disabled={committing}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{committing ? "Menyimpan..." : "Proses & Simpan Batch"}</span>
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#E8E2DB]/60 border-b border-[#E8E2DB] text-[#1A3263]">
                <tr>
                  <th className="py-2.5 px-3 font-bold">Baris</th>
                  <th className="py-2.5 px-3 font-bold">Business Key</th>
                  <th className="py-2.5 px-3 font-bold">Validasi</th>
                  <th className="py-2.5 px-3 font-bold">Status Kecocokan</th>
                  <th className="py-2.5 px-3 font-bold">Keputusan Duplikat</th>
                  <th className="py-2.5 px-3 font-bold">Hasil Commit</th>
                  <th className="py-2.5 px-3 font-bold">Keterangan / Diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E2DB]/70">
                {(activeBatch.rows || []).map((r) => (
                  <tr key={r.row_number} className="hover:bg-[#F6F4F0]/60">
                    <td className="py-2.5 px-3 font-mono text-[#547792]">#{r.row_number}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-[#1A3263]">{r.display_key}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded font-bold ${
                          r.validation_status === "VALID"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {r.validation_status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded font-bold ${
                          r.match_status === "NEW"
                            ? "bg-[#E8EEF7] text-[#1A3263]"
                            : r.match_status === "DUPLICATE_DIFF" || r.match_status === "IDENTICAL"
                            ? "bg-[#FEF6E7] text-[#8A580C] border border-[#FAB95B]"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {r.match_status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      {r.match_status === "DUPLICATE_DIFF" &&
                      (activeBatch.status === "READY_FOR_REVIEW" || activeBatch.status === "READY") ? (
                        <select
                          value={rowDecisions[r.row_number] || r.action}
                          onChange={(e) =>
                            setRowDecisions({
                              ...rowDecisions,
                              [r.row_number]: e.target.value as DuplicateRowDecision,
                            })
                          }
                          className="px-2 py-1 rounded border border-[#FAB95B] bg-[#FEF6E7] font-bold text-[#8A580C]"
                        >
                          <option value="SKIP">SKIP</option>
                          <option value="REPLACE">REPLACE</option>
                        </select>
                      ) : (
                        <span className="font-mono font-bold text-[#1A3263]">{r.action}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-[#1A3263]">
                      {r.result_status || "-"}
                    </td>
                    <td className="py-2.5 px-3 text-[#547792]">
                      {r.errors.length > 0 ? (
                        <span className="text-red-600 font-semibold">
                          {r.errors.map((e) => e.message).join("; ")}
                        </span>
                      ) : r.diff && Object.keys(r.diff).length > 0 ? (
                        <span>
                          Perubahan:{" "}
                          {Object.entries(r.diff)
                            .map(([k, v]) => `${k} (${v.old} → ${v.new})`)
                            .join(", ")}
                        </span>
                      ) : (
                        r.result_message || "Siap diproses"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Batch History */}
      <div className="p-5 rounded-xl bg-white border border-[#E8E2DB] shadow-sm">
        <h2 className="text-sm font-bold text-[#1A3263] mb-3">Riwayat Batch Import</h2>
        {history.length === 0 ? (
          <p className="text-xs text-[#547792]">Belum ada riwayat batch import.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E8E2DB] text-[#1A3263] bg-[#F6F4F0]">
                <tr>
                  <th className="py-2.5 px-3 font-bold">Waktu</th>
                  <th className="py-2.5 px-3 font-bold">Nama Berkas</th>
                  <th className="py-2.5 px-3 font-bold">Tipe</th>
                  <th className="py-2.5 px-3 font-bold">Status</th>
                  <th className="py-2.5 px-3 font-bold">Hasil (Insert / Replace / Skip / Gagal)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E2DB]/70">
                {history.map((b) => (
                  <tr
                    key={b.id}
                    onClick={() => setActiveBatch(b)}
                    className="hover:bg-[#F6F4F0]/60 cursor-pointer"
                  >
                    <td className="py-2.5 px-3 text-[#547792]">
                      {new Date(b.started_at).toLocaleString("id-ID")}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-[#1A3263]">{b.file_name}</td>
                    <td className="py-2.5 px-3 font-mono text-[#547792]">{b.import_type}</td>
                    <td className="py-2.5 px-3 font-bold text-[#1A3263]">{b.status}</td>
                    <td className="py-2.5 px-3 font-mono text-[#1A3263]">
                      {b.inserted_count} / {b.replaced_count} / {b.skipped_count} / {b.failed_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
