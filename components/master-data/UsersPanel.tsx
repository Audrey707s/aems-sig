"use client";

import { useSearchParams } from "next/navigation";
import { ColumnHeader } from "@/components/table/ColumnHeader";
import { useColumnFilters } from "@/components/table/useColumnFilters";
import { matchesSelected, sortTableRows, NONE_VALUE } from "@/lib/table-query";
import React, { useEffect, useState, useCallback } from "react";
import { Users, AlertCircle } from "lucide-react";
import { AppRole, Profile } from "@/lib/types/domain";
import { getRoleBadgeColor, getProfileLabel } from "@/lib/permissions/rbac";

export default function AdminUsersPage() {
  const tableParams = useSearchParams();
  const {column, sortBy, sortDir} = useColumnFilters("full_name", () => {});
  const [filter, setFilter] = useState<"all" | "pending">("all");
  const [saving, setSaving] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [emailConfigured,setEmailConfigured] = useState(true);
  const [draft, setDraft] = useState<{id:string;role:AppRole;level:"MANAGER"|"STAFF";managerId:string} | null>(null);
  const [notifications,setNotifications] = useState<Record<string,string>>({});
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
      setErrorMsg(null);
      setUsers(json.data || []);
      setEmailConfigured(json.email_configured !== false);
      const latest:Record<string,string> = {};
      for (const notice of json.notifications || []) if (!latest[notice.profile_id]) latest[notice.profile_id] = notice.status;
      setNotifications(latest);
    } catch {
      setErrorMsg("Daftar pengguna gagal dimuat. Silakan coba kembali.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleUpdateUser = async (
    id: string,
    role: AppRole | null,
    is_active: boolean,
    level?: "MANAGER" | "STAFF",
    managerId?: string | null,
  ) => {
    if (saving) return;
    setSaving(id);
    setErrorMsg(null);
    setSuccess("");
    try {
      const targetUser = users.find((u) => u.id === id);
      const res = await fetch(`/api/v1/admin/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          expected_updated_at: targetUser?.updated_at,
          email: targetUser?.email || "",
          full_name: targetUser?.full_name || "",
          department: targetUser?.department || null,
          role,
          account_level: level ?? targetUser?.account_level ?? "STAFF",
          manager_id:
            managerId === undefined
              ? (targetUser?.manager_id ?? null)
              : managerId,
          is_active,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error?.message || "Gagal memperbarui pengguna.");
        return;
      }
      await loadUsers();
      setDraft(null);
      setSuccess(json.notification_status === "SENT" ? "Jenis akun tersimpan. Pemberitahuan telah diterima server email. Pengguna dapat masuk sekarang." : json.notification_status ? "Jenis akun tersimpan dan sudah dapat digunakan. Email pemberitahuan belum berhasil dikirim; pilih Kirim ulang pemberitahuan." : "Jenis akun dan status pengguna berhasil disimpan.");
    } catch {
      setErrorMsg("Perubahan pengguna gagal disimpan. Silakan coba kembali.");
    } finally {
      setSaving(null);
    }
  };

  const visibleUsers = sortTableRows(users.filter(u => (filter === "all" || !u.role) && matchesSelected(u.department, tableParams.get("department")) && matchesSelected(u.role, tableParams.get("role")) && matchesSelected(u.is_active, tableParams.get("active"))), sortBy, sortDir, ["full_name","email","department","role","is_active"], "full_name");
  const departmentOptions = [...new Set(users.map(u => u.department).filter((value): value is string => !!value))].sort().map(value => ({value,label:value}));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-[#1A3263]">
          <Users className="w-6 h-6 text-[#547792]" />
          <span>Manajemen Pengguna &amp; Hak Akses</span>
        </h1>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("all")}
          aria-pressed={filter === "all"}
          className="rounded-lg border bg-white px-4 py-2 text-sm"
        >
          Semua Pengguna ({users.length})
        </button>
        <button
          onClick={() => setFilter("pending")}
          aria-pressed={filter === "pending"}
          className="rounded-lg border bg-white px-4 py-2 text-sm"
        >
          Menunggu Penetapan ({users.filter((u) => !u.role).length})
        </button>
      </div>
      {!emailConfigured && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Pengirim email pemberitahuan role belum dikonfigurasi. Penetapan akun tetap berlaku; email baru dapat dikirim setelah pengirim tersedia.</p>}
      {success && (
        <p
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {success}
        </p>
      )}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {draft && <section aria-label="Penetapan akun" className="rounded-xl border border-[#547792] bg-white p-5 space-y-4">
        <h2 className="font-bold text-[#1A3263]">Tetapkan {draft.role === "ADMIN" ? "Administrator" : `${draft.level === "MANAGER" ? "Manajer" : "Staff"} ${draft.role === "ACCOUNTING" ? "Accounting" : "Maintenance"}`} — {users.find(u=>u.id===draft.id)?.full_name}</h2>
        {draft.role === "ADMIN" && <p className="text-sm text-slate-600">Pengguna akan mendapat akses penuh untuk mengelola data, persetujuan, dan pengguna AEMS.</p>}
        {draft.role !== "ADMIN" && draft.level === "STAFF" && <label className="block text-sm">Manajer yang menyetujui pengajuan<select aria-label="Manajer untuk penetapan Staff" className="mt-2 block w-full rounded border p-2" value={draft.managerId} onChange={e=>setDraft({...draft,managerId:e.target.value})}><option value="">Pilih Manajer aktif</option>{users.filter(m=>m.id!==draft.id&&m.role===draft.role&&m.account_level==="MANAGER"&&m.is_active).map(m=><option key={m.id} value={m.id}>{m.full_name}</option>)}</select><span className="mt-2 block text-slate-600">Jika belum tersedia, tetapkan Manajer pada bagian ini terlebih dahulu.</span></label>}
        <div className="flex gap-3"><button disabled={saving!==null || (draft.role!=="ADMIN"&&draft.level==="STAFF"&&!draft.managerId)} onClick={()=>{void handleUpdateUser(draft.id,draft.role,true,draft.level,draft.role!=="ADMIN"&&draft.level==="STAFF"?draft.managerId:null);}} className="rounded bg-[#1A3263] px-4 py-2 text-sm text-white disabled:opacity-50">Simpan dan beri tahu pengguna</button><button disabled={saving!==null} onClick={()=>setDraft(null)} className="rounded border px-4 py-2 text-sm">Batal</button></div>
      </section>}

      <div className="rounded-xl bg-white border border-[#E8E2DB] overflow-x-auto shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#E8E2DB]/60 border-b border-[#E8E2DB] text-[#1A3263]">
            <tr>
              <ColumnHeader {...column("Nama Lengkap", "full_name")} />
              <ColumnHeader {...column("Email", "email")} />
              <ColumnHeader {...column("Departemen", "department", "department", [...departmentOptions,{value:NONE_VALUE,label:"Tanpa departemen"}])} />
              <ColumnHeader {...column("Peran Saat Ini", "role", "role", [{value:"ADMIN",label:"Administrator"},{value:"ACCOUNTING",label:"Accounting"},{value:"MAINTENANCE",label:"Maintenance"},{value:NONE_VALUE,label:"Belum ditetapkan"}])} />
              <ColumnHeader {...column("Status Akun", "is_active", "active", [{value:"true",label:"Aktif"},{value:"false",label:"Nonaktif"}])} />
              <th className="py-3 px-4 font-bold text-right">
                Ubah Peran / Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E8E2DB]/70">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-[#547792]">
                  Memuat daftar pengguna...
                </td>
              </tr>
            ) : !visibleUsers.length ? (<tr><td colSpan={6} className="p-6 text-center text-[#547792]">Tidak ada pengguna sesuai filter.</td></tr>) : (
              visibleUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-[#F6F4F0]/60 transition">
                    <td className="py-3 px-4 font-bold text-[#1A3263]">
                      {u.full_name}
                    </td>
                    <td className="py-3 px-4 font-mono text-[#547792]">
                      {u.email}
                    </td>
                    <td className="py-3 px-4 text-[#1A3263]">{u.department}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded border font-bold ${getRoleBadgeColor(
                          u.role,
                        )}`}
                      >
                        {getProfileLabel(u)}
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
                      {u.role === "ADMIN" ? (
                        <span className="text-xs font-semibold">
                          Administrator
                        </span>
                      ) : (
                        <select
                          aria-label={`Jenis akun ${u.full_name}`}
                          disabled={saving !== null}
                          value={
                            u.role
                              ? `${u.role}:${u.account_level || "STAFF"}`
                              : ""
                          }
                          onChange={(e) => {
                            const [role,level] = e.target.value.split(":") as [AppRole,"MANAGER"|"STAFF"];
                            const managers = users.filter(m => m.id !== u.id && m.role === role && m.account_level === "MANAGER" && m.is_active);
                            setDraft({id:u.id,role,level,managerId:level === "STAFF" && managers.length === 1 ? managers[0].id : ""});
                          }}
                          className="px-2.5 py-1 rounded border border-[#E8E2DB] bg-white font-semibold text-[#1A3263]"
                        >
                          <option value="" disabled>
                            Belum ditetapkan
                          </option>
                          <option value="ADMIN:STAFF">Administrator</option>
                          <option value="ACCOUNTING:MANAGER">
                            Manajer Accounting
                          </option>
                          <option value="ACCOUNTING:STAFF">
                            Staff Accounting
                          </option>
                          <option value="MAINTENANCE:MANAGER">
                            Manajer Maintenance
                          </option>
                          <option value="MAINTENANCE:STAFF">
                            Staff Maintenance
                          </option>
                        </select>
                      )}
                      {u.role && u.role !== "ADMIN" && u.account_level !== "MANAGER" && <button type="button" disabled={saving !== null} onClick={()=>setDraft({id:u.id,role:u.role!,level:"STAFF",managerId:u.manager_id || ""})} className="rounded border px-2 py-1">Atur atasan</button>}
                      {notifications[u.id] && !["SENT", "CANCELLED"].includes(notifications[u.id]) && <div className="my-2 text-xs text-slate-600">Email: {notifications[u.id] === "SENT" ? "Diterima server email" : notifications[u.id] === "CANCELLED" ? "Digantikan penetapan terbaru" : notifications[u.id] === "SENDING" ? "Sedang dikirim" : "Belum terkirim"}
                        {["FAILED","PENDING","SENDING"].includes(notifications[u.id]) && <button disabled={saving !== null} type="button" className="ml-2 underline" onClick={async()=>{
                          setSaving(u.id);setErrorMsg(null);setSuccess("");
                          try {const res=await fetch("/api/v1/admin/users/notification",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:u.id})});const body=await res.json();if(!res.ok)throw new Error(body.error?.message || "Permintaan gagal.");setSuccess(body.notification_status === "SENT" ? "Pemberitahuan telah diterima server email." : "Email belum terkirim. Periksa konfigurasi pengirim atau coba kembali.");await loadUsers();}catch(error){setErrorMsg(error instanceof Error?error.message:"Pengiriman gagal.");}finally{setSaving(null);}
                        }}>Kirim ulang pemberitahuan</button>}</div>}
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
