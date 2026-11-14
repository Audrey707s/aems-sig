"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mail, LockKeyhole, Save } from "lucide-react";
import { useAuth } from "@/components/ui/AppShell";
import { MasterDataNav } from "@/components/master-data/MasterDataNav";
import { getProfileLabel } from "@/lib/permissions/rbac";
export default function ProfilePage() {
  const { user, refreshUser } = useAuth(),
    params = useSearchParams();
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [emailOpen, setEmailOpen] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/v1/profile", { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw Error(j.error?.message || "Profil gagal dimuat.");
        if (active) {
          setPendingEmail(j.pending_email);
          await refreshUser();
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [refreshUser]);

  useEffect(() => {
    setName(user?.full_name || "");
    setEmail(user?.email || "");
  }, [user?.full_name, user?.email]);
  async function send(path: string, body: unknown, label: string) {
    if (busy) return;
    setBusy(label);
    setError("");
    setMessage("");
    try {
      const r = await fetch(path, {
        method: path === "/api/v1/profile" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok)
        throw Error(j.error?.message || "Perubahan belum dapat diproses.");
      if (path === "/api/v1/profile") {
        await refreshUser();
        setMessage("Profil berhasil diperbarui.");
      } else {
        setMessage(j.message);
        if (path.endsWith("/email")) {
          setEmailOpen(false);
          setPendingEmail(j.pending_email);
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  if (!user) return <p role="status">Memuat profil…</p>;
  const field =
    "w-full rounded-lg border border-[#d6d6d6] bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#547792]/40 disabled:bg-slate-50 disabled:text-slate-600";
  return (
    <div className="space-y-5">
      <MasterDataNav />
      {params.get("email") === "confirmed" && (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          Konfirmasi email diterima. Jika masih diminta, selesaikan konfirmasi
          pada alamat lainnya. Muat ulang untuk melihat email aktif.
        </p>
      )}
      {params.get("email") === "failed" && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          Tautan konfirmasi tidak berlaku atau telah digunakan. Minta email
          konfirmasi baru.
        </p>
      )}
      {pendingEmail && (
        <p
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        >
          Menunggu verifikasi email: {pendingEmail}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {message}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      <section
        aria-label="Profil"
        className="overflow-hidden rounded-xl border border-[#E8E2DB] bg-white"
      >
        <div className="h-24 bg-gradient-to-r from-[#1A3263] to-[#547792] sm:h-28" />
        <div className="px-5 pb-6 sm:px-7">
          <div className="relative -mt-12 flex flex-wrap items-end gap-4 pb-7">
            <div
              aria-hidden="true"
              className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-[6px] border-white bg-[#E8EEF7] text-3xl font-semibold text-[#1A3263] sm:h-28 sm:w-28"
            >
              {user.full_name.trim().charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 pb-1">
              <h1 className="text-xl font-semibold text-[#1A3263]">
                {user.full_name}
              </h1>
              <p className="mt-1 break-all text-sm text-slate-500">
                {user.email}
              </p>
            </div>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(
                "/api/v1/profile",
                { full_name: name, expected_updated_at: user.updated_at },
                "profile",
              );
            }}
            className="space-y-5 border-t border-slate-200 pt-6"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5 text-sm">
                Nama lengkap
                <input
                  required
                  minLength={2}
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!!busy}
                  className={field}
                />
              </label>
              <div className="space-y-1.5 text-sm">
                <label htmlFor="profile-email">Email</label>
                <div className="flex gap-2">
                  <input
                    id="profile-email"
                    value={user.email}
                    readOnly
                    className={field}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(user.email);
                      setEmailOpen(!emailOpen);
                      setError("");
                      setMessage("");
                    }}
                    className="shrink-0 rounded-lg border px-4 text-sm font-medium"
                    disabled={!!busy}
                  >
                    Ubah email
                  </button>
                </div>
              </div>
              <label className="space-y-1.5 text-sm">
                Role
                <input
                  disabled
                  value={getProfileLabel(user)}
                  className={field}
                />
              </label>
              <label className="space-y-1.5 text-sm">
                Unit / seksi
                <input
                  disabled
                  value={user.department || "Belum ditetapkan"}
                  className={field}
                />
              </label>
            </div>
            <div className="flex justify-end">
              <button
                disabled={!!busy || name.trim() === user.full_name}
                className="inline-flex items-center gap-2 rounded-full bg-[#1A3263] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                <Save size={15} />
                {busy === "profile" ? "Menyimpan…" : "Simpan perubahan"}
              </button>
            </div>
          </form>
          {emailOpen && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send("/api/v1/profile/email", { email }, "email");
              }}
              className="mt-5 space-y-4 rounded-xl border bg-slate-50 p-4"
            >
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Mail size={16} />
                Ubah email
              </h2>
              <label className="block space-y-1.5 text-sm">
                Email baru
                <input
                  autoFocus
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  className={field}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!!busy}
                />
              </label>
              <p className="text-sm leading-relaxed text-slate-500">
                Email baru aktif setelah konfirmasi melalui email selesai.
                Periksa pesan pada email lama dan baru.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => setEmailOpen(false)}
                  className="rounded-full border px-4 py-2 text-sm"
                >
                  Batal
                </button>
                <button
                  disabled={
                    !!busy || email.toLowerCase() === user.email.toLowerCase()
                  }
                  className="rounded-full bg-[#1A3263] px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  {busy === "email" ? "Mengirim…" : "Kirim verifikasi email"}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
      <section className="flex flex-col justify-between gap-4 rounded-xl border border-[#E8E2DB] bg-white p-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <LockKeyhole size={16} />
            Keamanan akun
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Ubah password melalui tautan verifikasi yang dikirim ke email akun
            Anda.
          </p>
        </div>
        <button
          disabled={!!busy}
          onClick={() =>
            void send("/api/v1/profile/password-email", {}, "password")
          }
          className="shrink-0 rounded-full border border-[#1A3263] px-5 py-2.5 text-sm font-medium text-[#1A3263] disabled:opacity-50"
        >
          {busy === "password" ? "Mengirim…" : "Ubah password"}
        </button>
      </section>
    </div>
  );
}
