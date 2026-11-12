"use client";
import { useEffect, useState } from "react";
import { Network, UserRound } from "lucide-react";
import type { Profile } from "@/lib/types/domain";
import { getProfileLabel } from "@/lib/permissions/rbac";
import Link from "next/link";
import { useAuth } from "@/components/ui/AppShell";
export default function Page() {
  const [users, setUsers] = useState<Profile[]>([]),
    [error, setError] = useState("");
  const { user } = useAuth();
  useEffect(() => {
    fetch("/api/v1/organization")
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw Error(b.error?.message || "Organisasi gagal dimuat.");
        setUsers(b.data);
      })
      .catch((e) => setError(e.message));
  }, []);
  return (
    <div className="space-y-5">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <Network className="h-6 w-6" />
        Organisasi
      </h1>
      {error && <p role="alert">{error}</p>}
      {user?.role === "ADMIN" && (
        <Link
          href="/master-data/users"
          className="inline-block rounded-lg border bg-white px-4 py-2 text-sm font-semibold"
        >
          Atur jabatan dan atasan
        </Link>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        {(["MAINTENANCE", "ACCOUNTING"] as const).map((role) => (
          <section
            key={role}
            className="space-y-4 rounded-xl border bg-white p-5"
          >
            <h2 className="text-lg font-bold">
              {role === "MAINTENANCE" ? "Maintenance" : "Accounting"}
            </h2>
            {users
              .filter((p) => p.role === role && p.account_level === "MANAGER")
              .map((m) => (
                <div key={m.id} className="rounded-lg border p-4">
                  <p className="flex items-center gap-2 font-bold">
                    <UserRound className="h-4 w-4" />
                    {m.full_name}
                  </p>
                  <p className="text-xs text-slate-500">{getProfileLabel(m)}</p>
                  <ul className="mt-3 space-y-2 border-l-2 pl-4">
                    {users
                      .filter((p) => p.manager_id === m.id)
                      .map((p) => (
                        <li
                          key={p.id}
                          className="rounded bg-slate-50 p-3 text-sm"
                        >
                          {p.full_name}
                          <span className="block text-xs text-slate-500">
                            {getProfileLabel(p)}
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            <h3 className="font-semibold">Belum ditempatkan</h3>
            {users
              .filter(
                (p) =>
                  p.role === role &&
                  p.account_level !== "MANAGER" &&
                  !p.manager_id,
              )
              .map((p) => (
                <p key={p.id} className="rounded-lg border p-3 text-sm">
                  {p.full_name} · Staff
                </p>
              ))}
          </section>
        ))}
      </div>
    </div>
  );
}
