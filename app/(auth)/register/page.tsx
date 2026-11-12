"use client";
import Link from "next/link";
import Image from "next/image";
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
  return <main className="flex min-h-screen items-center justify-center bg-[#F6F4F0] p-4">
    <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[#E8E2DB] bg-white shadow-xl">
      <header className="border-b-4 border-[#FAB95B] bg-[#1A3263] p-6 text-white"><div className="inline-flex rounded-lg bg-white p-2"><Image src="/logo-aems.png" alt="AEMS" width={140} height={40} className="h-8 w-auto" /></div><h1 className="mt-4 text-xl font-bold">Daftar Akun</h1></header>
      <form onSubmit={submit} className="space-y-4 p-6">
        {feedback && <p role="status" className={`rounded-lg p-3 text-sm ${feedback.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{feedback.message}</p>}
        <label className="block text-sm font-semibold">Nama lengkap<input required minLength={2} maxLength={120} autoComplete="name" value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5 font-normal" /></label>
        <label className="block text-sm font-semibold">Email<input required type="email" autoComplete="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5 font-normal" /></label>
        <label className="block text-sm font-semibold">Kata sandi<input required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5 font-normal" /></label>
        <label className="block text-sm font-semibold">Konfirmasi kata sandi<input required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={form.confirmation} onChange={e=>setForm({...form,confirmation:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5 font-normal" /></label>
        <button disabled={busy} className="w-full rounded-lg bg-[#1A3263] p-2.5 text-sm font-bold text-white">{busy ? "Mendaftarkan..." : "Daftar"}</button>
        <Link href="/login" className="block text-center text-sm font-semibold underline">Sudah punya akun? Masuk</Link>
      </form>
    </div>
  </main>;
}
