"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Users, Shield, AlertCircle } from "lucide-react";
import { AppRole, Profile } from "@/lib/types/domain";
import { getRoleBadgeColor, getRoleLabel } from "@/lib/permissions/rbac";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/users");
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error?.message || "Akses ditolak.");
        return;
      }
      setUsers(json.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleUpdateUser = async (id: string, role: AppRole, is_active: boolean) => {
    setErrorMsg(null);
    const res = await fetch(`/api/v1/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, is_active }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErrorMsg(json.error?.message || "Gagal memperbarui pengguna.");
      return;
    }
    loadUsers();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-[#1A3263]">
          <Users className="w-6 h-6 text-[#547792]" />
          <span>Manajemen Pengguna &amp; Hak Akses</span>
        </h1>
        <p className="text-sm text-[#547792] mt-0.5">
          Kelola peran pengguna (Accounting, Maintenance, Administrator) serta status keaktifan akun.
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="rounded-xl bg-white border border-[#E8E2DB] overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#E8E2DB]/60 border-b border-[#E8E2DB] text-[#1A3263]">
            <tr>
              <th className="py-3 px-4 font-bold">Nama Lengkap</th>
              <th className="py-3 px-4 font-bold">Email</th>
              <th className="py-3 px-4 font-bold">Departemen</th>
              <th className="py-3 px-4 font-bold">Peran Saat Ini</th>
              <th className="py-3 px-4 font-bold">Status Akun</th>
              <th className="py-3 px-4 font-bold text-right">Ubah Peran / Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E8E2DB]/70">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-[#547792]">
                  Memuat daftar pengguna...
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="hover:bg-[#F6F4F0]/60 transition">
                  <td className="py-3 px-4 font-bold text-[#1A3263]">{u.full_name}</td>
                  <td className="py-3 px-4 font-mono text-[#547792]">{u.email}</td>
                  <td className="py-3 px-4 text-[#1A3263]">{u.department}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2.5 py-0.5 rounded border font-bold ${getRoleBadgeColor(
                        u.role
                      )}`}
                    >
                      {getRoleLabel(u.role)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded font-bold ${
                        u.is_active
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {u.is_active ? "AKTIF" : "NONAKTIF"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    <select
                      value={u.role || "ACCOUNTING"}
                      onChange={(e) =>
                        handleUpdateUser(u.id, e.target.value as AppRole, u.is_active)
                      }
                      className="px-2.5 py-1 rounded border border-[#E8E2DB] bg-white font-semibold text-[#1A3263]"
                    >
                      <option value="ACCOUNTING">Accounting</option>
                      <option value="MAINTENANCE">Maintenance</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateUser(u.id, u.role || "ACCOUNTING", !u.is_active)
                      }
                      className="px-2.5 py-1 rounded border border-[#E8E2DB] hover:bg-[#F6F4F0] font-semibold text-[#1A3263]"
                    >
                      {u.is_active ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="p-4 rounded-xl bg-white border border-[#E8E2DB] flex items-center gap-3 text-xs text-[#547792]">
        <Shield className="w-4 h-4 text-[#1A3263] shrink-0" />
        <span>
          Sistem menjaga ketersediaan minimal satu Administrator aktif setiap saat agar fungsi tata kelola tetap berjalan.
        </span>
      </div>
    </div>
  );
}
