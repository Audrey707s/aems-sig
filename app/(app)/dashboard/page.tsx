"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/ui/AppShell";
import {
  Box,
  Cpu,
  Unlink,
  Clock,
  ArrowUpRight,
  GitBranch,
  FileSpreadsheet,
  ShieldAlert,
} from "lucide-react";

interface DashboardSummary {
  kpis: {
    total_assets: number;
    total_equipment: number;
    unmapped_equipment: number;
    assets_without_equipment: number;
    pending_mapping_requests: number;
    open_reconciliation_findings: number;
  };
  assets_by_category: Array<{ category: string; count: number }>;
  equipment_by_condition: Array<{ condition: string; count: number }>;
  assets_by_location: Array<{
    location: string;
    assets: number;
    equipment: number;
  }>;
  recent_activities: Array<{
    id: number;
    occurred_at: string;
    actor_name: string;
    actor_role: string;
    entity_type: string;
    entity_code: string;
    action: string;
  }>;
}

export default function DashboardPage() {
  const { can, user } = useAuth();
  const [error, setError] = useState("");
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError("");
    fetch(
      `/api/v1/dashboard/summary${statusFilter ? `?status=${statusFilter}` : ""}`,
      { signal: ctrl.signal },
    )
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok)
          throw new Error(body.error?.message || "Dashboard gagal dimuat.");
        return body;
      })
      .then((res) => setData(res.data))
      .catch((e) => {
        if (e.name !== "AbortError")
          setError("Dashboard gagal dimuat. Silakan muat ulang halaman.");
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [statusFilter]);

  if (error)
    return (
      <div role="alert" className="rounded-xl border bg-white p-6">
        {error}{" "}
        <button
          onClick={() => window.location.reload()}
          className="ml-3 underline"
        >
          Coba kembali
        </button>
      </div>
    );

  if (loading || !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-[#E8E2DB] rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-28 bg-white rounded-xl border border-[#E8E2DB]"
            />
          ))}
        </div>
      </div>
    );
  }

  const maxCatCount = Math.max(
    ...data.assets_by_category.map((c) => c.count),
    1,
  );

  return (
    <div className="space-y-6">
      {/* Header & Global Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1A3263]">
            Dashboard Eksekutif
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#E8E2DB] bg-white text-[#1A3263] focus:outline-none focus:border-[#547792]"
          >
            <option value="">Semua Status Siklus Hidup</option>
            <option value="ACTIVE">Hanya Status: ACTIVE</option>
            <option value="INACTIVE">Hanya Status: INACTIVE</option>
          </select>
        </div>
      </div>

      {/* 4 Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          href={statusFilter ? `/assets?status=${statusFilter}` : "/assets"}
          className="group p-5 rounded-xl bg-white border border-[#E8E2DB] hover:border-[#1A3263] shadow-sm transition flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#547792]">
              Total Aset SAP
            </span>
            <span className="p-2 rounded-lg bg-[#E8EEF7] text-[#1A3263]">
              <Box className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-[#1A3263]">
              {data.kpis.total_assets}
            </span>
            <span className="text-xs font-semibold text-[#547792] group-hover:text-[#1A3263] inline-flex items-center gap-0.5">
              Lihat Aset <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </Link>

        <Link
          href={
            statusFilter ? `/equipment?status=${statusFilter}` : "/equipment"
          }
          className="group p-5 rounded-xl bg-white border border-[#E8E2DB] hover:border-[#547792] shadow-sm transition flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#547792]">
              Total Equipment
            </span>
            <span className="p-2 rounded-lg bg-[#EDF2F6] text-[#547792]">
              <Cpu className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-[#1A3263]">
              {data.kpis.total_equipment}
            </span>
            <span className="text-xs font-semibold text-[#547792] group-hover:text-[#1A3263] inline-flex items-center gap-0.5">
              Lihat Equipment <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </Link>

        <Link
          href="/equipment/unmapped"
          className="group p-5 rounded-xl bg-white border border-[#E8E2DB] hover:border-[#FAB95B] shadow-sm transition flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#547792]">
              Equipment Belum Termapping
            </span>
            <span className="p-2 rounded-lg bg-[#FEF6E7] text-[#8A580C]">
              <Unlink className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-[#1A3263]">
              {data.kpis.unmapped_equipment}
            </span>
            <span className="text-xs font-semibold text-[#8A580C] inline-flex items-center gap-0.5">
              Tinjau Antrean <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </Link>

        <Link
          href={
            can("mapping:approve")
              ? "/mapping?tab=inbox"
              : "/mapping?tab=history"
          }
          className="group p-5 rounded-xl bg-[#1A3263] text-white border border-[#1A3263] shadow-sm transition flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#E8E2DB]">
              Menunggu Persetujuan
            </span>
            <span className="p-2 rounded-lg bg-white/10 text-[#FAB95B]">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-[#FAB95B]">
              {data.kpis.pending_mapping_requests}
            </span>
            <span className="text-xs font-semibold text-[#E8E2DB] group-hover:text-[#FAB95B] inline-flex items-center gap-0.5">
              Kotak Masuk <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </Link>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar Chart: Asset by Category */}
        <div className="p-5 rounded-xl bg-white border border-[#E8E2DB] shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-[#1A3263]">
              Aset per Kategori
            </h2>
            <span className="text-[11px] font-medium text-[#547792]">
              Distribusi Unit
            </span>
          </div>
          <div className="space-y-3">
            {data.assets_by_category.map((item) => (
              <Link
                key={item.category}
                href={`/assets?q=${encodeURIComponent(item.category)}${statusFilter ? `&status=${statusFilter}` : ""}`}
                className="cursor-pointer group"
              >
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-[#1A3263] group-hover:text-[#547792] transition">
                    {item.category}
                  </span>
                  <span className="font-bold text-[#1A3263]">
                    {item.count} unit
                  </span>
                </div>
                <div className="w-full h-2.5 bg-[#F6F4F0] rounded-full overflow-hidden border border-[#E8E2DB]">
                  <div
                    className="h-full bg-[#1A3263] group-hover:bg-[#547792] rounded-full transition-all"
                    style={{
                      width: `${Math.max((item.count / maxCatCount) * 100, 12)}%`,
                    }}
                  />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Condition Breakdown */}
        <div className="p-5 rounded-xl bg-white border border-[#E8E2DB] shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-[#1A3263]">
              Equipment per Kondisi Fisik
            </h2>
            <span className="text-[11px] font-medium text-[#547792]">
              Status Teknis
            </span>
          </div>
          <div className="space-y-3">
            {data.equipment_by_condition.map((c) => (
              <Link
                key={c.condition}
                href={`/equipment?condition=${encodeURIComponent(c.condition)}`}
                className="flex items-center justify-between p-3 rounded-lg bg-[#F6F4F0] hover:bg-[#E8E2DB]/60 border border-[#E8E2DB] cursor-pointer transition"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-3 h-3 rounded-full ${
                      c.condition === "BAIK"
                        ? "bg-[#547792]"
                        : c.condition === "RUSAK_RINGAN"
                          ? "bg-[#FAB95B]"
                          : "bg-[#1A3263]"
                    }`}
                  />
                  <span className="text-xs font-semibold text-[#1A3263]">
                    {c.condition.replace("_", " ")}
                  </span>
                </div>
                <span className="text-sm font-bold text-[#1A3263]">
                  {c.count} unit
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Distribution by Location */}
        <div className="p-5 rounded-xl bg-white border border-[#E8E2DB] shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-[#1A3263]">
              Sebaran Lokasi Pabrik &amp; Gudang
            </h2>
            <span className="text-[11px] font-medium text-[#547792]">
              Aset &amp; Equipment
            </span>
          </div>
          <div className="space-y-2.5">
            {data.assets_by_location.map((loc) => (
              <Link
                key={loc.location}
                href={`/reports?report=all-equipment&q=${encodeURIComponent(loc.location)}`}
                className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-[#F6F4F0] cursor-pointer text-xs border-b border-[#E8E2DB]/60 last:border-0"
              >
                <span className="font-semibold text-[#1A3263]">
                  {loc.location}
                </span>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-[#E8EEF7] text-[#1A3263] font-semibold">
                    {loc.assets} Aset
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#EDF2F6] text-[#547792] font-semibold">
                    {loc.equipment} Eqp
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row: Recent Activities & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-5 rounded-xl bg-white border border-[#E8E2DB] shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-[#1A3263]">
              Aktivitas Terbaru
            </h2>
            {can("audit:view_full") && (
              <Link
                href="/admin/audit"
                className="text-xs text-[#547792] hover:text-[#1A3263] font-bold"
              >
                Lihat Audit Trail →
              </Link>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E8E2DB] text-[#547792] bg-[#F6F4F0]">
                  <th className="py-2.5 px-3 font-bold">Waktu</th>
                  <th className="py-2.5 px-3 font-bold">Pelaku</th>
                  <th className="py-2.5 px-3 font-bold">Entitas</th>
                  <th className="py-2.5 px-3 font-bold">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E2DB]/60">
                {data.recent_activities.map((act) => (
                  <tr key={act.id} className="hover:bg-[#F6F4F0]/50">
                    <td className="py-2.5 px-3 text-[#547792] whitespace-nowrap">
                      {new Date(act.occurred_at).toLocaleString("id-ID")}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-[#1A3263]">
                      {act.actor_name}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-mono font-bold px-2 py-0.5 rounded bg-[#E8E2DB]/60 text-[#1A3263]">
                        {act.entity_type}: {act.entity_code}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-bold text-[#547792]">
                      {act.action}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions Card */}
        <div className="p-5 rounded-xl bg-white border border-[#E8E2DB] shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-[#1A3263]">Aksi Cepat</h2>
          <Link
            href="/mapping"
            className="flex items-center justify-between p-3.5 rounded-xl border border-[#E8E2DB] bg-[#F6F4F0]/60 hover:border-[#1A3263] hover:bg-[#E8EEF7]/40 transition"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#1A3263] text-[#FAB95B]">
                <GitBranch className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-[#1A3263]">
                  Workspace Mapping &amp; Hierarki
                </div>
                <div className="text-[11px] text-[#547792]">
                  Hubungkan atau pindahkan equipment
                </div>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-[#547792]" />
          </Link>

          <Link
            href={
              user?.role === "MAINTENANCE"
                ? "/equipment/import"
                : "/assets/import"
            }
            className="flex items-center justify-between p-3.5 rounded-xl border border-[#E8E2DB] bg-[#F6F4F0]/60 hover:border-[#547792] hover:bg-[#EDF2F6]/60 transition"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#547792] text-white">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-[#1A3263]">
                  Import Massal Excel (.xlsx)
                </div>
                <div className="text-[11px] text-[#547792]">
                  Pratinjau &amp; validasi bertahap
                </div>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-[#547792]" />
          </Link>

          {can("reconciliation:read") && (
            <Link
              href="/admin/reconciliation"
              className="flex items-center justify-between p-3.5 rounded-xl border border-[#E8E2DB] bg-[#F6F4F0]/60 hover:border-[#FAB95B] hover:bg-[#FEF6E7]/60 transition"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#FAB95B] text-[#1A3263]">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#1A3263]">
                    Rekonsiliasi ({data.kpis.open_reconciliation_findings}{" "}
                    Temuan)
                  </div>
                  <div className="text-[11px] text-[#547792]">
                    Periksa kualitas dan integritas data
                  </div>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-[#547792]" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
