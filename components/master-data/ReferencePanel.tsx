"use client";
import { useCallback, useEffect, useState, useRef } from "react";
import { MapPin, Tags, Plus, Pencil, Trash2, Save, X } from "lucide-react";
import { useAuth } from "@/components/ui/AppShell";
import type { ReferenceItem } from "@/lib/types/domain";

type Kind = "asset_categories" | "equipment_categories" | "locations";
const empty = {
  code: "",
  name: "",
  parent_id: null as string | null,
  is_active: true,
};
export default function ReferencePanel({
  locations = false,
}: {
  locations?: boolean;
}) {
  const {current: sequence} = useRef({value:0});
  const { user } = useAuth();
  const admin = user?.role === "ADMIN";
  const [kind, setKind] = useState<Kind>(
    locations ? "locations" : "asset_categories",
  );
  const [rows, setRows] = useState<ReferenceItem[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ ...empty }),
    [editing, setEditing] = useState<ReferenceItem | null>(null),
    [open, setOpen] = useState(false);
  const [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [deleting, setDeleting] = useState<ReferenceItem | null>(null);
  const load = useCallback(async () => {
    const request = ++sequence.value;
    setLoading(true);
    try {
      const r = await fetch("/api/v1/master-data");
      const j = await r.json();
      if (!r.ok) throw Error(j.error?.message || "Data gagal dimuat.");
      if (request === sequence.value) setRows(j.data[kind] || []);
    } catch (e) {
      if (request === sequence.value) setError((e as Error).message);
    } finally {
      if (request === sequence.value) setLoading(false);
    }
  }, [kind, sequence]);
  useEffect(() => {
    setOpen(false);
    setEditing(null);
    setDeleting(null);
    setError("");
    setSuccess("");
    void load();
    return () => {
      sequence.value++;
    };
  }, [load, sequence]);
  const cancel = () => {
    setOpen(false);
    setEditing(null);
    setForm({ ...empty });
  };
  const save = async (
    row: typeof empty & { id?: string },
    expected?: ReferenceItem,
  ) => {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const r = await fetch("/api/v1/master-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          id: row.id,
          code: row.code,
          name: row.name,
          parent_id: row.parent_id,
          is_active: row.is_active,
          expected,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw Error(j.error?.message || "Perubahan gagal disimpan.");
      cancel();
      setDeleting(null);
      await load();
      setSuccess("Perubahan berhasil disimpan.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const descendant = (id: string, ancestor: string) => {
    let cur = rows.find((r) => r.id === id);
    const seen = new Set<string>();
    while (cur?.parent_id && !seen.has(cur.id)) {
      if (cur.parent_id === ancestor) return true;
      seen.add(cur.id);
      cur = rows.find((r) => r.id === cur!.parent_id);
    }
    return false;
  };
  const ordered: { row: ReferenceItem; depth: number }[] = [];
  const visited = new Set<string>();
  const visit = (row: ReferenceItem, depth: number) => {
    if (visited.has(row.id)) return;
    visited.add(row.id);
    ordered.push({ row, depth });
    rows
      .filter((r) => r.parent_id === row.id)
      .forEach((r) => visit(r, depth + 1));
  };
  rows
    .filter((r) => !r.parent_id || !rows.some((p) => p.id === r.parent_id))
    .forEach((r) => visit(r, 0));
  rows.forEach((r) => visit(r, 0));
  const Icon = locations ? MapPin : Tags;
  const input =
    "w-full rounded-lg border border-[#E8E2DB] bg-white px-3 py-2.5 text-sm";
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[#1A3263]">
          <Icon className="h-6 w-6 text-[#547792]" />
          {locations ? "Lokasi Aset" : "Kategori Aset"}
        </h1>
        {admin && (
          <button
            disabled={busy}
            onClick={() => {
              cancel();
              setOpen(true);
              setError("");
              setSuccess("");
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1A3263] px-4 py-2.5 text-sm font-semibold text-white"
          >
            <Plus size={16} />
            Tambah {locations ? "Lokasi" : "Kategori"}
          </button>
        )}
      </div>
      {!locations && (
        <div className="flex gap-2">
          {(["asset_categories", "equipment_categories"] as Kind[]).map((k) => (
            <button
              key={k}
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={`rounded-lg border px-4 py-2 text-sm ${kind === k ? "bg-[#1A3263] text-white" : "bg-white"}`}
            >
              {k === "asset_categories"
                ? "Kategori Aset"
                : "Kategori Equipment"}
            </button>
          ))}
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {success && (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {success}
        </p>
      )}
      {open && admin && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save({ ...form, id: editing?.id }, editing || undefined);
          }}
          className="space-y-4 rounded-xl border border-[#E8E2DB] bg-white p-5"
        >
          <h2 className="font-semibold">
            {editing ? "Ubah" : "Tambah"} {locations ? "Lokasi" : "Kategori"}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              Kode
              <input
                autoFocus
                required
                maxLength={60}
                value={form.code}
                disabled={busy}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className={input}
              />
            </label>
            <label className="space-y-1 text-sm">
              Nama
              <input
                required
                minLength={2}
                maxLength={150}
                value={form.name}
                disabled={busy}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={input}
              />
            </label>
            <label className="space-y-1 text-sm">
              Induk
              <select
                disabled={busy}
                value={form.parent_id || ""}
                onChange={(e) =>
                  setForm({ ...form, parent_id: e.target.value || null })
                }
                className={input}
              >
                <option value="">Tanpa induk</option>
                {ordered
                  .filter(
                    ({ row }) =>
                      row.is_active &&
                      row.id !== editing?.id &&
                      (!editing || !descendant(row.id, editing.id)),
                  )
                  .map(({ row, depth }) => (
                    <option key={row.id} value={row.id}>
                      {"— ".repeat(depth)}
                      {row.name} ({row.code})
                    </option>
                  ))}
              </select>
            </label>
            {editing && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={form.is_active}
                  onChange={(e) =>
                    setForm({ ...form, is_active: e.target.checked })
                  }
                />
                Aktif
              </label>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={cancel}
              className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm"
            >
              <X size={16} />
              Batal
            </button>
            <button
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1A3263] px-4 py-2 text-sm text-white"
            >
              <Save size={16} />
              {busy ? "Menyimpan…" : "Simpan"}
            </button>
          </div>
        </form>
      )}
      {deleting && (
        <div
          role="alertdialog"
          aria-label="Konfirmasi hapus"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"
        >
          <p>
            Hapus {deleting.name} dari pilihan aktif? Riwayat penggunaan tetap
            tersimpan.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              disabled={busy}
              onClick={() =>
                void save({ ...deleting, is_active: false }, deleting)
              }
              className="rounded-lg bg-red-700 px-4 py-2 text-white"
            >
              Hapus
            </button>
            <button
              disabled={busy}
              onClick={() => setDeleting(null)}
              className="rounded-lg border px-4 py-2"
            >
              Batal
            </button>
          </div>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-[#E8E2DB] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#E8E2DB]/50 text-[#1A3263]">
            <tr>
              <th className="px-4 py-3">Nama / Hierarki</th>
              <th className="px-4 py-3">Kode</th>
              <th className="px-4 py-3">Status</th>
              {admin && <th className="px-4 py-3 text-right">Tindakan</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={admin ? 4 : 3} className="p-6 text-center">
                  Memuat data…
                </td>
              </tr>
            ) : !ordered.length ? (
              <tr>
                <td colSpan={admin ? 4 : 3} className="p-6 text-center">
                  Belum ada data.
                </td>
              </tr>
            ) : (
              ordered.map(({ row, depth }) => (
                <tr key={row.id}>
                  <td className="px-4 py-3">
                    <span
                      style={{ paddingLeft: Math.min(depth, 12) * 18 }}
                      className="inline-block font-medium"
                    >
                      {depth > 0 && (
                        <span className="mr-2 text-[#547792]">↳</span>
                      )}
                      {row.name}
                    </span>
                  </td>
                  <td className="px-4 py-3">{row.code}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        row.is_active ? "text-emerald-700" : "text-slate-500"
                      }
                    >
                      {row.is_active ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  {admin && (
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        disabled={busy}
                        aria-label={`Ubah ${row.name}`}
                        onClick={() => {
                          setEditing(row);
                          setForm({
                            code: row.code,
                            name: row.name,
                            parent_id: row.parent_id,
                            is_active: row.is_active,
                          });
                          setOpen(true);
                          setDeleting(null);
                          setError("");
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border px-3 py-2"
                      >
                        <Pencil size={14} />
                        Ubah
                      </button>
                      {row.is_active && (
                        <button
                          disabled={busy}
                          aria-label={`Hapus ${row.name}`}
                          onClick={() => {
                            setDeleting(row);
                            cancel();
                            setError("");
                          }}
                          className="ml-2 inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-red-700"
                        >
                          <Trash2 size={14} />
                          Hapus
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
