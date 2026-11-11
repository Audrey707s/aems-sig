"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { AppRole } from "@/lib/types/domain";

export default function LoginPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<AppRole>("ADMIN");
  const [email, setEmail] = useState("admin@aems.co.id");
  const [password, setPassword] = useState("••••••••••••");
  const [loading, setLoading] = useState(false);

  const handleRolePreset = (role: AppRole) => {
    setSelectedRole(role);
    if (role === "ADMIN") setEmail("admin@aems.co.id");
    if (role === "ACCOUNTING") setEmail("accounting@aems.co.id");
    if (role === "MAINTENANCE") setEmail("maintenance@aems.co.id");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/v1/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: selectedRole }),
      });
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-[#F6F4F0] p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-[#E8E2DB] overflow-hidden">
        {/* Top Header Banner with Official Logo */}
        <div className="bg-[#1A3263] px-6 py-7 text-white border-b-4 border-[#FAB95B]">
          <div className="flex items-center gap-4">
            <div className="bg-white rounded-xl px-3.5 py-2 shadow-sm border border-[#E8E2DB]">
              <Image
                src="/logo-aems.png"
                width={140}
                height={40}
                alt="AEMS Logo"
                className="h-9 w-auto object-contain"
              />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">
                Asset &amp; Equipment Management
              </h1>
              <p className="text-xs text-[#E8E2DB]/90 mt-0.5">
                Enterprise Asset &amp; Technical Hierarchy System
              </p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleLogin} className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#547792] mb-2">
              Pilih Profil Akses
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { role: "ADMIN", label: "Admin" },
                  { role: "ACCOUNTING", label: "Accounting" },
                  { role: "MAINTENANCE", label: "Maintenance" },
                ] as const
              ).map((item) => (
                <button
                  key={item.role}
                  type="button"
                  onClick={() => handleRolePreset(item.role)}
                  className={`py-2.5 px-3 rounded-lg text-xs font-bold border transition ${
                    selectedRole === item.role
                      ? "bg-[#1A3263] text-[#FAB95B] border-[#1A3263] shadow-sm"
                      : "bg-[#F6F4F0] text-[#1A3263] border-[#E8E2DB] hover:bg-[#E8E2DB]/60"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1A3263] mb-1">
              Email Korporat
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#E8E2DB] text-sm text-[#1A3263] bg-white focus:ring-2 focus:ring-[#547792] focus:border-[#1A3263] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1A3263] mb-1">
              Kata Sandi
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#E8E2DB] text-sm text-[#1A3263] bg-white focus:ring-2 focus:ring-[#547792] focus:border-[#1A3263] outline-none"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-[#F6F4F0] border border-[#E8E2DB] flex items-start gap-2.5 text-xs text-[#547792]">
            <ShieldCheck className="w-4 h-4 text-[#1A3263] shrink-0 mt-0.5" />
            <div>
              Akses aplikasi dilindungi kendali otorisasi berbasis peran serta pencatatan riwayat perubahan terpusat.
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg bg-[#1A3263] hover:bg-[#122347] text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition"
          >
            <span>{loading ? "Memproses..." : "Masuk ke Aplikasi"}</span>
            <ArrowRight className="w-4 h-4 text-[#FAB95B]" />
          </button>
        </form>
      </div>
    </div>
  );
}
