"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Users, AlertCircle } from "lucide-react";
import { AppRole, Profile } from "@/lib/types/domain";
import { getRoleBadgeColor, getRoleLabel } from "@/lib/permissions/rbac";

export default function AdminUsersPage() {
  const [filter, setFilter] = useState<"all" | "pending">("all");
  const [saving, setSaving] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
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
    } catch { setErrorMsg("Daftar pengguna gagal dimuat. Silakan coba kembali."); } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleUpdateUser = async (id: string, role: AppRole | null, is_active: boolean) => {
    if (saving) return;
    setSaving(id); setErrorMsg(null); setSuccess("");
    try {
    const targetUser = users.find((u) => u.id === id);
    const res = await fetch(`/api/v1/admin/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        email: targetUser?.email || "",
        full_name: targetUser?.full_name || "",
        department: targetUser?.department || null,
        role,
        is_active,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErrorMsg(json.error?.message || "Gagal memperbarui pengguna.");
      return;
    }
    await loadUsers();
    setSuccess("Jenis akun dan status pengguna berhasil disimpan.");
    } catch { setErrorMsg("Perubahan pengguna gagal disimpan. Silakan coba kembali."); }
    finally {setSaving(null);}
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-[#1A3263]">
          <Users className="w-6 h-6 text-[#547792]" />
          <span>Manajemen Pengguna &amp; Hak Akses</span>
        </h1>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilter("all")} aria-pressed={filter === "all"} className="rounded-lg border bg-white px-4 py-2 text-sm">Semua Pengguna ({users.length})</button>
        <button onClick={() => setFilter("pending")} aria-pressed={filter === "pending"} className="rounded-lg border bg-white px-4 py-2 text-sm">Menunggu Penetapan ({users.filter(u => !u.role).length})</button>
      </div>
      {success && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</p>}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="rounded-xl bg-white border border-[#E8E2DB] overflow-x-auto shadow-sm">
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
              users.filter(u => filter === "all" || !u.role).map((u) => (
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
                    {u.role === "ADMIN" ? <span className="text-xs font-semibold">Administrator</span> : <select
                      aria-label={`Jenis akun ${u.full_name}`}
                      disabled={saving !== null}
                      value={u.role || ""}
                      onChange={(e) =>
                        handleUpdateUser(u.id, e.target.value as AppRole, u.is_active)
                      }
                      className="px-2.5 py-1 rounded border border-[#E8E2DB] bg-white font-semibold text-[#1A3263]"
                    >
                      <option value="" disabled>Belum ditetapkan</option>
                      <option value="ACCOUNTING">Accounting</option>
                      <option value="MAINTENANCE">Equipment</option>
                    </select>}
                    <button
                      type="button"
                      disabled={saving !== null}
                      onClick={() =>
                        handleUpdateUser(u.id, u.role, !u.is_active)
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


    </div>
  );
}
