"use client";
import { useState } from "react";
export function PendingAccountActions() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const logout = async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/v1/auth/session", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({action: "LOGOUT"})});
      if (!response.ok) throw new Error();
      window.location.assign("/login");
    } catch {setBusy(false); setError("Keluar gagal. Silakan coba kembali.");}
  };
  return <><div className="flex gap-2"><button onClick={() => window.location.reload()} className="rounded-lg border px-4 py-2 text-sm font-semibold">Periksa Status</button><button onClick={logout} disabled={busy} className="rounded-lg border px-4 py-2 text-sm">Keluar</button></div>{error && <p role="alert">{error}</p>}</>;
}
