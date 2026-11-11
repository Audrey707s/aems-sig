"use client";

import React, { useEffect, useState, useCallback } from "react";
import { ShieldAlert, RefreshCw, CheckCircle2 } from "lucide-react";
import { ReconciliationFinding, ReconciliationStatus } from "@/lib/types/domain";
import { useAuth } from "@/components/ui/AppShell";

export default function ReconciliationPage() {
  const { can } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [findings, setFindings] = useState<ReconciliationFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});

  const loadFindings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/reconciliation/scan");
      const json = await res.json();
      if (!res.ok) throw new Error();
      setFindings(json.data || []);
    } catch { setError("Hasil rekonsiliasi gagal dimuat. Silakan coba kembali."); } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFindings();
  }, [loadFindings]);

  const handleScan = async () => {
    setLoading(true); setError("");
    try {
    const res = await fetch("/api/v1/admin/reconciliation/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SCAN" }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error();
    setFindings(json.data || []);
    } catch { setError("Pemindaian gagal. Silakan coba kembali."); }
    finally { setLoading(false); }
  };

  const handleResolve = async (findingId: string, status: ReconciliationStatus) => {
    if (busy) return;
    setBusy(true); setError("");
    try {
    const response = await fetch(`/api/v1/admin/findings/${findingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        resolution_note: noteMap[findingId] || `Ditandai ${status}`,
      }),
    });
    if (!response.ok) throw new Error();
    await loadFindings();
    } catch { setError("Status temuan gagal diperbarui. Silakan coba kembali."); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-[#1A3263]">
            <ShieldAlert className="w-6 h-6 text-[#547792]" />
            <span>Rekonsiliasi &amp; Kualitas Data</span>
          </h1>
        </div>

        <button
          type="button"
          onClick={handleScan}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1A3263] hover:bg-[#122347] text-white text-xs font-bold shadow-sm transition"
        >
          <RefreshCw className={`w-4 h-4 text-[#FAB95B] ${loading ? "animate-spin" : ""}`} />
          <span>Jalankan Pemindaian Rekonsiliasi</span>
        </button>
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div className="space-y-3">
        {findings.map((f) => (
          <div
            key={f.id}
            className="p-5 rounded-xl bg-white border border-[#E8E2DB] shadow-sm space-y-3 text-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded font-bold ${
                    f.severity === "HIGH"
                      ? "bg-red-100 text-red-800"
                      : f.severity === "MEDIUM"
                      ? "bg-[#FEF6E7] text-[#8A580C] border border-[#FAB95B]"
                      : "bg-[#EDF2F6] text-[#547792]"
                  }`}
                >
                  {f.severity}
                </span>
                <span className="font-mono font-bold px-2 py-0.5 rounded bg-[#E8EEF7] text-[#1A3263]">
                  {f.finding_type}
                </span>
                <span className="font-bold text-[#1A3263]">
                  {f.entity_code} — {f.entity_name}
                </span>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded font-bold ${
                  f.status === "OPEN"
                    ? "bg-[#FEF6E7] text-[#8A580C] border border-[#FAB95B]"
                    : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {f.status}
              </span>
            </div>

            <p className="text-[#547792]">{f.description}</p>

            {f.status === "OPEN" && can("reconciliation:resolve") && (
              <div className="pt-2 border-t border-[#E8E2DB] flex flex-col sm:flex-row items-center gap-2">
                <input
                  type="text"
                  placeholder="Catatan penyelesaian..."
                  value={noteMap[f.id] || ""}
                  onChange={(e) => setNoteMap({ ...noteMap, [f.id]: e.target.value })}
                  className="flex-1 px-3 py-1.5 rounded-lg border border-[#E8E2DB] text-[#1A3263]"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleResolve(f.id, "RESOLVED")}
                  className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Tandai Selesai</span>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
