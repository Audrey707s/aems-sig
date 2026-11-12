"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { authButtonClass, authInputClass, authLinkClass } from "./AuthCard";
export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ok: boolean; message: string} | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    if (password !== confirmation) {setFeedback({ok: false, message: "Konfirmasi kata sandi tidak sama."}); return;}
    setBusy(true); setFeedback(null);
    try {
      const response = await fetch("/api/v1/auth/reset-password", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({password, confirmation})});
      const body = await response.json();
      setFeedback({ok: response.ok, message: response.ok ? body.message : body.error?.message || "Password belum dapat diperbarui."});
      if (response.ok) {setPassword(""); setConfirmation("");}
    } catch {setFeedback({ok: false, message: "Koneksi terputus. Silakan coba kembali."});}
    finally {setBusy(false);}
  }
  return <form onSubmit={submit} className="space-y-5" aria-busy={busy}>
    {feedback && <p role={feedback.ok ? "status" : "alert"} className={`rounded-lg p-3 text-sm ${feedback.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{feedback.message}</p>}
    {!feedback?.ok && <>
      <label className="block text-sm font-medium">Kata sandi baru<input required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} className={authInputClass} /></label>
      <label className="block text-sm font-medium">Konfirmasi kata sandi baru<input required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={confirmation} onChange={e=>setConfirmation(e.target.value)} className={authInputClass} /></label>
      <button disabled={busy} className={authButtonClass}>{busy ? "Menyimpan..." : "Simpan Password"}</button>
    </>}
    <p className="pt-2 text-center text-sm"><Link href="/login" className={authLinkClass}>Kembali ke login</Link></p>
  </form>;
}
