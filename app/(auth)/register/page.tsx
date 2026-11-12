"use client";
import Link from "next/link";
import { AuthCard, authButtonClass, authInputClass, authLinkClass } from "@/components/auth/AuthCard";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({full_name: "", email: "", password: "", confirmation: ""});
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ok: boolean; message: string} | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (busy) return;
    if (form.password !== form.confirmation) {setFeedback({ok: false, message: "Konfirmasi kata sandi tidak sama."}); return;}
    setBusy(true); setFeedback(null);
    try {
      const response = await fetch("/api/v1/auth/register", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(form)});
      const body = await response.json();
      setFeedback({ok: response.ok, message: response.ok ? body.message : body.error?.message || "Pendaftaran gagal."});
      if (response.ok) {setForm({...form, password: "", confirmation: ""}); if (body.redirect) {router.push(body.redirect); router.refresh();}}
    } catch {setFeedback({ok: false, message: "Koneksi terputus. Silakan coba kembali."});}
    finally {setBusy(false);}
  };
  return <AuthCard title="Daftar Akun">
      <form onSubmit={submit} className="space-y-4" aria-busy={busy}>
        {feedback && <p role={feedback.ok ? "status" : "alert"} className={`rounded-lg p-3 text-sm ${feedback.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{feedback.message}</p>}
        <label className="block text-sm font-medium">Nama lengkap<input required minLength={2} maxLength={120} autoComplete="name" value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})} className={authInputClass} /></label>
        <label className="block text-sm font-medium">Email<input required type="email" autoComplete="email" maxLength={254} value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className={authInputClass} /></label>
        <label className="block text-sm font-medium">Kata sandi<input required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} className={authInputClass} /></label>
        <label className="block text-sm font-medium">Konfirmasi kata sandi<input required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={form.confirmation} onChange={e=>setForm({...form,confirmation:e.target.value})} className={authInputClass} /></label>
        <button disabled={busy} className={authButtonClass}>{busy ? "Mendaftarkan..." : "Daftar Akun"}</button>
        <p className="pt-2 text-center text-sm text-slate-500">Sudah punya akun? <Link href="/login" className={authLinkClass}>Masuk</Link></p>
      </form>
  </AuthCard>;
}
