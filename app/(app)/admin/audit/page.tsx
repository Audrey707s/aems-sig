"use client";

import React, { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import { AuditLogRecord } from "@/lib/types/domain";

export default function AuditTrailPage() {
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [entityType, setEntityType] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/v1/audit-logs${entityType ? `?entity_type=${entityType}` : ""}`)
      .then(async r => { const body = await r.json(); if (!r.ok) throw new Error(body.error?.message || "Data gagal dimuat."); return body; })
      .then((res) => setLogs(res.data || []))
      .catch(() => setError("Data gagal dimuat. Silakan muat ulang halaman."))
      .finally(() => setLoading(false));
  }, [entityType]);

  return (
    <div className="space-y-6">
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-[#1A3263]">
            <ClipboardList className="w-6 h-6 text-[#547792]" />
            <span>Audit Trail Terpusat</span>
          </h1>
        </div>

        <select
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#E8E2DB] bg-white text-[#1A3263]"
        >
          <option value="">Semua Entitas</option>
          <option value="ASSET">ASSET</option>
          <option value="EQUIPMENT">EQUIPMENT</option>
          <option value="MAPPING">MAPPING</option>
          <option value="IMPORT_BATCH">IMPORT_BATCH</option>
          <option value="USER">USER</option>
          <option value="RECONCILIATION">RECONCILIATION</option>
          <option value="SETTINGS">SETTINGS</option>
        </select>
      </div>

      <div className="rounded-xl bg-white border border-[#E8E2DB] overflow-x-auto shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#E8E2DB]/60 border-b border-[#E8E2DB] text-[#1A3263]">
              <tr>
                <th className="py-3 px-4 font-bold">ID</th>
                <th className="py-3 px-4 font-bold">Waktu</th>
                <th className="py-3 px-4 font-bold">Pelaku &amp; Role</th>
                <th className="py-3 px-4 font-bold">Entitas</th>
                <th className="py-3 px-4 font-bold">Tindakan</th>
                <th className="py-3 px-4 font-bold">Perubahan Nilai</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E2DB]/70">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#547792]">
                    Memuat audit log...
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#F6F4F0]/60 transition">
                    <td className="py-3 px-4 font-mono text-[#547792]">#{log.id}</td>
                    <td className="py-3 px-4 text-[#547792] whitespace-nowrap">
                      {new Date(log.occurred_at).toLocaleString("id-ID")}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#1A3263]">{log.actor_name}</div>
                      <div className="text-[11px] text-[#547792]">{log.actor_role}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold px-2 py-0.5 rounded bg-[#E8EEF7] text-[#1A3263]">
                        {log.entity_type}: {log.entity_code}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-[#547792]">{log.action}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-[#547792] max-w-md truncate">
                      {log.new_values ? <details className="whitespace-normal min-w-40"><summary className="cursor-pointer font-sans">Lihat perubahan</summary><dl className="mt-2 space-y-1 font-sans">{Object.entries(log.new_values).filter(([key]) => !["id", "password", "token", "row_version", "request_id"].includes(key)).map(([key, value]) => <div key={key}><dt className="font-semibold">{key.replaceAll("_", " ")}</dt><dd>{value === null ? "Kosong" : typeof value === "object" ? "Data terstruktur diperbarui" : String(value)}</dd></div>)}</dl></details> : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
