"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthCard, authButtonClass, authInputClass, authLinkClass } from "@/components/auth/AuthCard";

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
      <label className="block text-sm font-medium">Email<input autoComplete="username" type="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} className={authInputClass} /></label>
      <label className="block text-sm font-medium">Kata sandi<input autoComplete="current-password" type="password" required value={password} onChange={e=>setPassword(e.target.value)} className={authInputClass} /></label>
      <button type="submit" disabled={loading} className={authButtonClass}>{loading ? "Memproses..." : "Masuk"}</button>
    </form>
    <div className="mt-5 flex flex-wrap justify-center gap-4 text-sm"><Link href="/register" className={authLinkClass}>Daftar akun</Link><Link href="/forgot-password" className={authLinkClass}>Lupa kata sandi?</Link></div>
  </AuthCard>;
}
