"use client";

import React from "react";
import { UserCheck, Shield } from "lucide-react";
import { useAuth } from "@/components/ui/AppShell";
import { getRoleBadgeColor, getRoleLabel, PermissionAction } from "@/lib/permissions/rbac";

const PERMISSION_LIST: Array<{ action: PermissionAction; label: string }> = [
  { action: "asset:read", label: "Melihat Daftar & Detail Master Asset SAP" },
  { action: "asset:write", label: "Menambah, Mengubah & Menghapus Master Asset SAP" },
  { action: "equipment:read", label: "Melihat Daftar & Detail Master Equipment" },
  { action: "equipment:write", label: "Menambah, Mengubah & Menghapus Master Equipment" },
  { action: "spec:write", label: "Mengelola & Mempromosikan Komponen Spesifikasi" },
  { action: "mapping:request", label: "Mengajukan Permintaan Mapping (LINK / MOVE / UNLINK / REPLACE)" },
  { action: "mapping:approve", label: "Menyetujui / Menolak Pengajuan Mapping" },
  { action: "import:asset", label: "Menjalankan Import Excel Master Asset" },
  { action: "import:equipment", label: "Menjalankan Import Excel Master Equipment" },
  { action: "import:mapping", label: "Menjalankan Import Excel Mapping" },
  { action: "report:export", label: "Mengekspor Laporan ke Excel (.xlsx) & PDF" },
  { action: "audit:view_full", label: "Mengakses Audit Trail Terpusat" },
  { action: "users:manage", label: "Mengelola Peran & Status Pengguna" },
];

export default function ProfilePage() {
  const { user, can } = useAuth();

  if (!user) {
    return <div className="text-sm text-[#547792]">Memuat profil...</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-[#1A3263]">
          <UserCheck className="w-6 h-6 text-[#547792]" />
          <span>Profil &amp; Hak Akses Saya</span>
        </h1>
        <p className="text-sm text-[#547792] mt-0.5">
          Informasi akun pengguna aktif dan daftar kewenangan akses di dalam sistem.
        </p>
      </div>

      <div className="p-6 rounded-xl bg-white border border-[#E8E2DB] shadow-sm space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-[#E8E2DB] pb-4">
          <div>
            <div className="text-base font-bold text-[#1A3263]">{user.full_name}</div>
            <div className="font-mono text-[#547792] mt-0.5">{user.email}</div>
          </div>
          <span
            className={`px-3 py-1 rounded-md border font-bold ${getRoleBadgeColor(user.role)}`}
          >
            {getRoleLabel(user.role)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-y-2">
          <span className="text-[#547792]">Departemen:</span>
          <span className="font-semibold text-[#1A3263]">{user.department || "-"}</span>
          <span className="text-[#547792]">Status Akun:</span>
          <span className="font-bold text-emerald-700">
            {user.is_active ? "AKTIF" : "NONAKTIF"}
          </span>
        </div>
      </div>

      <div className="p-6 rounded-xl bg-white border border-[#E8E2DB] shadow-sm space-y-3 text-xs">
        <h2 className="text-sm font-bold text-[#1A3263] flex items-center gap-2 border-b border-[#E8E2DB] pb-2">
          <Shield className="w-4 h-4 text-[#1A3263]" />
          <span>Matriks Kewenangan Aktif</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {PERMISSION_LIST.map((p) => {
            const allowed = can(p.action);
            return (
              <div
                key={p.action}
                className={`p-3 rounded-lg border flex items-center justify-between ${
                  allowed
                    ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                    : "bg-[#F6F4F0] border-[#E8E2DB] text-[#547792]"
                }`}
              >
                <span className="font-semibold">{p.label}</span>
                <span className="font-bold text-[10px] px-2 py-0.5 rounded bg-white border border-[#E8E2DB]">
                  {allowed ? "DIIZINKAN" : "DIBATASI"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
