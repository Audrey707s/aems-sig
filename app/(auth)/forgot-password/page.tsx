"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthCard, authButtonClass, authInputClass, authLinkClass } from "@/components/auth/AuthCard";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ok: boolean; message: string} | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setFeedback(null);
    try {
      const response = await fetch("/api/v1/auth/forgot-password", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({email})});
      const body = await response.json();
      setFeedback({ok: response.ok, message: response.ok ? body.message : body.error?.message || "Permintaan belum dapat diproses."});
    } catch {setFeedback({ok: false, message: "Koneksi terputus. Silakan coba kembali."});}
    finally {setBusy(false);}
  }
  return <AuthCard title="Lupa Password">
    <p className="mb-6 text-center text-sm leading-relaxed text-slate-500">Masukkan email akun untuk menerima tautan pengaturan ulang password.</p>
    <form onSubmit={submit} className="space-y-5" aria-busy={busy}>
      {feedback && <p role={feedback.ok ? "status" : "alert"} className={`rounded-lg p-3 text-sm ${feedback.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{feedback.message}</p>}
      <label className="block text-sm font-medium">Email<input required type="email" maxLength={254} autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className={authInputClass} /></label>
      <button disabled={busy} className={authButtonClass}>{busy ? "Memproses..." : "Kirim Tautan"}</button>
      <p className="pt-2 text-center text-sm"><Link href="/login" className={authLinkClass}>Kembali ke login</Link></p>
    </form>
  </AuthCard>;
}
