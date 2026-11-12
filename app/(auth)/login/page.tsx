"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthCard, authButtonClass, authLinkClass } from "@/components/auth/AuthCard";

const loginInputClass = "mt-1.5 block w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-normal text-gray-900 outline-none transition focus:border-[#1A3263] focus:ring-2 focus:ring-[#1A3263]/10 disabled:opacity-60";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("confirmation") === "failed") setError("Tautan konfirmasi tidak berlaku atau sudah kedaluwarsa. Silakan coba kembali.");
  }, []);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault(); if (loading) return;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/v1/auth/session", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({email, password})});
      const body = await response.json();
      if (!response.ok) {setError(body.error?.message || "Login gagal. Silakan coba kembali."); return;}
      setPassword(""); router.push(body.redirect || "/dashboard"); router.refresh();
    } catch {setError("Tidak dapat terhubung. Periksa koneksi dan coba kembali.");}
    finally {setLoading(false);}
  };

  return <AuthCard title="Masuk">
    <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5" aria-busy={loading}>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <label className="block text-xs font-semibold">Email<input autoComplete="username" type="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} className={loginInputClass} /></label>
      <label className="block text-xs font-semibold">Kata sandi<input autoComplete="current-password" type="password" required value={password} onChange={e=>setPassword(e.target.value)} className={loginInputClass} /></label>
      <button type="submit" disabled={loading} className={authButtonClass.replace("rounded-md", "rounded-xl") + " py-3 shadow"}>{loading ? "Memproses..." : "Masuk"}</button>
    </form>
    <div className="mt-5 flex flex-wrap justify-center gap-4 text-sm"><Link href="/register" className={authLinkClass}>Daftar akun</Link><Link href="/forgot-password" className={authLinkClass}>Lupa kata sandi?</Link></div>
  </AuthCard>;
}
