"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Box,
  Cpu,
  Unlink,
  Link2,
  Wrench,
  Clock,
  RefreshCw,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  SlidersHorizontal,
  MapPin,
  Tags,
  Activity,
  GitBranch,
  FileSpreadsheet,
  ShieldAlert,
  LayoutDashboard,
} from "lucide-react";
import { useAuth } from "@/components/ui/AppShell";
import { readDashboardFilters, type DashboardData } from "@/lib/dashboard";
const cards = [
  { id: "assets", label: "Total Aset SAP", icon: Box },
  { id: "equipment", label: "Total Equipment", icon: Cpu },
  { id: "unmapped", label: "Belum Termapping", icon: Unlink },
  { id: "without-equipment", label: "Aset Tanpa Equipment", icon: Link2 },
  { id: "condition", label: "Kondisi Bermasalah", icon: Wrench },
  { id: "pending", label: "Menunggu Persetujuan", icon: Clock },
] as const;
const colors = ["#547792", "#FAB95B", "#dc6047", "#1A3263"];
const human = (s: string) =>
  ({
    ACTIVE: "Aktif",
    INACTIVE: "Nonaktif",
    DISPOSED: "Dilepas",
    SUBMITTED: "Menunggu review",
    BAIK: "Baik",
    RUSAK_RINGAN: "Rusak ringan",
    RUSAK_BERAT: "Rusak berat",
    DALAM_PERBAIKAN: "Dalam perbaikan",
  })[s] || s.replaceAll("_", " ");
const field =
  "min-w-0 rounded-lg border border-[#E8E2DB] bg-white px-3 py-2.5 text-sm text-[#1A3263]";
export default function Dashboard() {
  const params = useSearchParams(),
    router = useRouter(),
    query = params.toString(),
    filters = readDashboardFilters(new URLSearchParams(query));
  const { user, can } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0),
    [search, setSearch] = useState(filters.q),
    [updated, setUpdated] = useState("");
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/v1/dashboard/summary?${query}`, {
      signal: ctrl.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw Error(b.error?.message || "Dashboard gagal dimuat.");
        if (!ctrl.signal.aborted) {
          setData(b.data);
          setUpdated(
            new Date().toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          );
        }
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [query, reload]);
  useEffect(() => setSearch(filters.q), [filters.q]);
  function change(values: Record<string, string>) {
    const next = new URLSearchParams(query);
    next.delete("page");
    for (const [k, v] of Object.entries(values)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    startTransition(() =>
      router.push(`/dashboard${next.size ? `?${next}` : ""}`, {
        scroll: false,
      }),
    );
  }
  const busy = loading || pending,
    selected = cards.find((c) => c.id === filters.card)!;
  const totalConditions =
    data?.charts.conditions.reduce((n, c) => n + c.count, 0) || 0;
  let start = 0;
  const segments = (data?.charts.conditions || []).map((c, i) => {
    const end =
        start + (totalConditions ? (c.count / totalConditions) * 100 : 0),
      segment = `${colors[i]} ${start}% ${end}%`;
    start = end;
    return segment;
  });
  const filtered = !!(
    filters.status ||
    filters.location ||
    filters.category ||
    filters.condition ||
    filters.q
  );
  return (
    <div className="space-y-6 pb-4">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-1 text-sm text-[#547792]">
            Selamat datang, {user?.full_name.split(" ")[0]}
          </p>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[#1A3263]">
            <LayoutDashboard className="h-6 w-6" />
            Dashboard
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500" aria-live="off">
            {updated && `Diperbarui ${updated}`}
          </span>
          <button
            onClick={() => setReload((n) => n + 1)}
            disabled={busy}
            className={`${field} inline-flex items-center gap-2`}
          >
            <RefreshCw size={15} className={busy ? "animate-spin" : ""} />
            Muat ulang
          </button>
        </div>
      </header>
      <section
        aria-label="Filter dashboard"
        className="rounded-xl border border-[#E8E2DB] bg-white p-4"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <SlidersHorizontal size={15} />
            Filter data
          </h2>
          {filtered && (
            <button
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#1A3263]"
              onClick={() => {
                setSearch("");
                change({
                  status: "",
                  location: "",
                  category: "",
                  condition: "",
                  q: "",
                });
              }}
            >
              <X size={14} />
              Reset filter
            </button>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              change({ q: search });
            }}
            className="flex min-w-0 gap-1"
          >
            <input
              aria-label="Cari data dashboard"
              placeholder="Cari nomor, nama, atau serial…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${field} w-full`}
            />
            <button
              aria-label="Terapkan pencarian"
              className="rounded-lg bg-[#1A3263] px-3 text-white"
            >
              <Search size={16} />
            </button>
          </form>
          <select
            aria-label="Status data"
            value={filters.status}
            onChange={(e) => change({ status: e.target.value })}
            className={field}
          >
            <option value="">Semua status</option>
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Nonaktif</option>
            <option value="DISPOSED">Dilepas</option>
          </select>
          <select
            aria-label="Lokasi data"
            value={filters.location}
            onChange={(e) => change({ location: e.target.value })}
            className={field}
          >
            <option value="">Semua lokasi dan turunannya</option>
            {data?.references.locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Kategori aset"
            value={filters.category}
            onChange={(e) => change({ category: e.target.value })}
            className={field}
          >
            <option value="">Semua kategori aset</option>
            {data?.references.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value="none">Tanpa kategori</option>
          </select>
        </div>
        {filters.condition && (
          <button
            onClick={() => change({ condition: "" })}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-900"
          >
            Kondisi: {human(filters.condition)}
            <X size={12} />
          </button>
        )}
      </section>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
          <button
            onClick={() => setReload((n) => n + 1)}
            className="ml-3 font-semibold underline"
          >
            Coba kembali
          </button>
        </div>
      )}
      <section
        aria-label="Ringkasan data"
        aria-busy={busy}
        className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6"
      >
        {cards.map((c) => (
          <button
            key={c.id}
            aria-pressed={filters.card === c.id}
            aria-controls="dashboard-results"
            onClick={() => change({ card: c.id })}
            className={`dashboard-card min-w-0 rounded-xl border p-4 text-left sm:p-5 ${filters.card === c.id ? "border-[#e9ac52] bg-[#fff0db] shadow-sm" : "border-[#E8E2DB] bg-white hover:border-[#547792]"}`}
          >
            <div className="mb-4 flex items-start justify-between gap-2">
              <span className="text-xs font-semibold leading-relaxed text-[#547792]">
                {c.label}
              </span>
              <c.icon size={17} className="shrink-0 text-[#1A3263]" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold tabular-nums text-[#1A3263]">
                {!data ? "—" : data.kpis[c.id]}
              </span>
              <ArrowUpRight
                size={15}
                className={
                  filters.card === c.id ? "text-[#9e6518]" : "text-slate-400"
                }
              />
            </div>
          </button>
        ))}
      </section>
      {!data && busy ? (
        <div
          role="status"
          className="dashboard-skeleton h-64 rounded-xl border bg-white p-6 text-sm text-[#547792]"
        >
          Memuat dashboard…
        </div>
      ) : (
        data && (
          <>
            <section
              className="grid gap-5 xl:grid-cols-3"
              aria-label="Distribusi data"
            >
              <div className="dashboard-panel">
                <h2 className="dashboard-heading">
                  <Tags size={16} />
                  Aset per kategori
                </h2>
                <div className="mt-5 space-y-3">
                  {!data.charts.categories.length ? (
                    <p className="dashboard-empty">
                      Tidak ada aset sesuai filter.
                    </p>
                  ) : (
                    data.charts.categories.map((c) => (
                      <button
                        key={c.id}
                        aria-pressed={filters.category === c.id}
                        onClick={() =>
                          change({
                            category: filters.category === c.id ? "" : c.id,
                            card: "assets",
                          })
                        }
                        className={`block w-full rounded-lg p-2 text-left transition-colors ${filters.category === c.id ? "bg-[#fff0db]" : "hover:bg-slate-50"}`}
                      >
                        <span className="mb-2 flex justify-between gap-3 text-xs">
                          <span>{c.name}</span>
                          <strong>{c.count}</strong>
                        </span>
                        <span className="block h-2 overflow-hidden rounded-full bg-slate-100">
                          <span
                            className="dashboard-bar block h-full rounded-full bg-[#547792]"
                            style={{
                              width: `${data.kpis.assets ? (c.count / data.kpis.assets) * 100 : 0}%`,
                            }}
                          />
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
              <div className="dashboard-panel">
                <h2 className="dashboard-heading">
                  <Wrench size={16} />
                  Kondisi equipment
                </h2>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-5">
                  <div
                    role="img"
                    aria-label={`${data.kpis.equipment} equipment, ${data.kpis.condition} kondisi bermasalah`}
                    className="relative grid h-32 w-32 shrink-0 place-items-center rounded-full"
                    style={{
                      background: totalConditions
                        ? `conic-gradient(${segments.join(",")})`
                        : "#e8e2db",
                    }}
                  >
                    <div className="grid h-24 w-24 content-center rounded-full bg-white text-center">
                      <strong className="text-2xl tabular-nums">
                        {data.kpis.equipment}
                      </strong>
                      <span className="text-[10px] text-slate-500">
                        Equipment
                      </span>
                    </div>
                  </div>
                  <div className="min-w-[140px] flex-1 space-y-1">
                    {data.charts.conditions.map((c, i) => (
                      <button
                        key={c.id}
                        aria-pressed={filters.condition === c.id}
                        onClick={() =>
                          change({
                            condition: filters.condition === c.id ? "" : c.id,
                            card: "equipment",
                          })
                        }
                        className={`flex w-full items-center justify-between gap-2 rounded-lg p-2 text-xs ${filters.condition === c.id ? "bg-[#fff0db]" : "hover:bg-slate-50"}`}
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: colors[i] }}
                          />
                          {human(c.id)}
                        </span>
                        <strong>{c.count}</strong>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-4 border-t pt-3">
                  <p className="flex justify-between text-xs">
                    <span>Equipment terhubung ke aset</span>
                    <strong>{data.coverage}%</strong>
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="dashboard-bar h-full bg-[#1A3263]"
                      style={{ width: `${data.coverage}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="dashboard-panel">
                <h2 className="dashboard-heading">
                  <MapPin size={16} />
                  Sebaran lokasi
                </h2>
                <div className="mt-4 max-h-64 space-y-1 overflow-y-auto">
                  {!data.charts.locations.length ? (
                    <p className="dashboard-empty">
                      Tidak ada lokasi sesuai filter.
                    </p>
                  ) : (
                    data.charts.locations.map((l) => (
                      <button
                        key={l.id}
                        aria-pressed={filters.location === l.id}
                        onClick={() =>
                          change({
                            location: filters.location === l.id ? "" : l.id,
                          })
                        }
                        className={`flex w-full items-center justify-between gap-3 rounded-lg p-3 text-left text-xs ${filters.location === l.id ? "bg-[#fff0db]" : "hover:bg-slate-50"}`}
                      >
                        <span className="font-medium">{l.name}</span>
                        <span className="flex shrink-0 gap-2">
                          <span className="rounded bg-[#e8eef7] px-2 py-1">
                            {l.assets} aset
                          </span>
                          <span className="rounded bg-slate-100 px-2 py-1">
                            {l.equipment} eqp
                          </span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </section>
            <section
              id="dashboard-results"
              aria-busy={busy}
              className="overflow-hidden rounded-xl border border-[#E8E2DB] bg-white"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
                <h2 className="flex items-center gap-2 font-semibold">
                  <selected.icon size={17} />
                  {selected.label}
                  <span
                    aria-live="polite"
                    className="rounded-full bg-[#e8eef7] px-2.5 py-1 text-xs tabular-nums"
                  >
                    {data.pagination.total}
                  </span>
                </h2>
                <span className="text-xs text-slate-500">
                  {busy
                    ? "Memperbarui…"
                    : filtered
                      ? "Hasil sesuai filter"
                      : "Seluruh data"}
                </span>
              </div>
              <div
                className={`overflow-x-auto transition-opacity ${busy ? "opacity-50" : "opacity-100"}`}
              >
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#f6f4f0] text-xs text-[#547792]">
                    <tr>
                      {[
                        "Nomor / kode",
                        "Nama / keterangan",
                        filters.card === "pending"
                          ? "Pengaju"
                          : "Kategori aset",
                        "Lokasi",
                        "Status",
                        "Detail",
                      ].map((h) => (
                        <th key={h} className="px-5 py-3 font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody
                    key={`${query}-${reload}`}
                    className="divide-y dashboard-table-enter"
                  >
                    {!data.rows.length ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="p-10 text-center text-sm text-slate-500"
                        >
                          Tidak ada data untuk pilihan ini.
                          {filtered && (
                            <button
                              onClick={() =>
                                change({
                                  status: "",
                                  location: "",
                                  category: "",
                                  condition: "",
                                  q: "",
                                })
                              }
                              className="ml-2 underline"
                            >
                              Reset filter
                            </button>
                          )}
                        </td>
                      </tr>
                    ) : (
                      data.rows.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="whitespace-nowrap px-5 py-4 font-semibold text-[#1A3263]">
                            {r.code}
                          </td>
                          <td className="max-w-sm px-5 py-4">
                            <Link
                              href={r.href}
                              className="font-medium hover:underline"
                            >
                              {r.name}
                            </Link>
                            {r.condition && (
                              <p className="mt-1 text-xs text-slate-500">
                                {human(r.condition)}
                              </p>
                            )}
                          </td>
                          <td className="px-5 py-4 text-xs text-slate-500">
                            {r.category}
                          </td>
                          <td className="px-5 py-4 text-xs text-slate-500">
                            {r.location}
                          </td>
                          <td className="px-5 py-4">
                            <span className="whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs">
                              {human(r.status)}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <Link
                              href={r.href}
                              aria-label={`Lihat ${r.code}`}
                              className="inline-flex rounded-lg border p-2 text-[#1A3263]"
                            >
                              <ArrowUpRight size={16} />
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 text-xs text-slate-500">
                <span>
                  Halaman {data.pagination.page} dari{" "}
                  {data.pagination.total_pages} · {data.pagination.total} data
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={busy || data.pagination.page <= 1}
                    aria-label="Halaman sebelumnya"
                    onClick={() =>
                      change({ page: String(data.pagination.page - 1) })
                    }
                    className="rounded-lg border p-2"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    disabled={
                      busy ||
                      data.pagination.page >= data.pagination.total_pages
                    }
                    aria-label="Halaman berikutnya"
                    onClick={() =>
                      change({ page: String(data.pagination.page + 1) })
                    }
                    className="rounded-lg border p-2"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </footer>
            </section>
            <section className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
              <div className="dashboard-panel">
                <h2 className="dashboard-heading">
                  <Activity size={16} />
                  Aktivitas terbaru
                </h2>
                <div className="mt-3 divide-y">
                  {data.activities.length ? (
                    data.activities.map((a) => (
                      <div
                        key={a.id}
                        className="flex flex-wrap justify-between gap-2 py-3 text-xs"
                      >
                        <div>
                          <strong>{a.name}</strong>
                          <p className="mt-1 text-slate-500">
                            {(
                              {
                                CREATE: "Menambahkan data",
                                UPDATE: "Memperbarui data",
                                UPDATE_OWN_PROFILE: "Memperbarui profil",
                                CONFIRM_EMAIL_CHANGE: "Memverifikasi email",
                                SOFT_DELETE: "Menonaktifkan data",
                                SUBMIT_REQUEST: "Mengajukan perubahan mapping",
                                SUBMIT_AND_APPLY: "Menerapkan mapping",
                                APPROVE_REQUEST: "Menyetujui pengajuan",
                                REJECT_REQUEST: "Menolak pengajuan",
                                UPDATE_USER: "Memperbarui pengguna",
                                RUN_SCAN: "Memeriksa rekonsiliasi",
                              } as Record<string, string>
                            )[a.action] || "Perubahan data"}{" "}
                            · {a.code || "Profil"}
                          </p>
                        </div>
                        <time
                          className="text-slate-400"
                          dateTime={a.occurred_at}
                        >
                          {new Date(a.occurred_at).toLocaleString("id-ID", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </time>
                      </div>
                    ))
                  ) : (
                    <p className="dashboard-empty">Belum ada aktivitas.</p>
                  )}
                </div>
              </div>
              <div className="dashboard-panel">
                <h2 className="dashboard-heading">
                  <ArrowUpRight size={16} />
                  Aksi cepat
                </h2>
                <div className="mt-4 space-y-2">
                  {[
                    {
                      href: "/mapping",
                      label: "Mapping & Hierarki",
                      icon: GitBranch,
                    },
                    {
                      href:
                        user?.role === "MAINTENANCE"
                          ? "/equipment/import"
                          : "/assets/import",
                      label: "Import Excel",
                      icon: FileSpreadsheet,
                    },
                    ...(can("reconciliation:read")
                      ? [
                          {
                            href: "/admin/reconciliation",
                            label: `Rekonsiliasi · ${data.open_findings} temuan`,
                            icon: ShieldAlert,
                          },
                        ]
                      : []),
                  ].map((a) => (
                    <Link
                      key={a.href}
                      href={a.href}
                      className="flex items-center justify-between rounded-lg border p-3 text-sm transition-colors hover:bg-[#fff0db]"
                    >
                      <span className="flex items-center gap-2">
                        <a.icon size={16} />
                        {a.label}
                      </span>
                      <ArrowUpRight size={14} />
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          </>
        )
      )}
    </div>
  );
}
