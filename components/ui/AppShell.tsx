"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Box,
  Cpu,
  Unlink,
  GitBranch,
  FileSpreadsheet,
  BarChart3,
  ShieldAlert,
  Users,
  Settings,
  ClipboardList,
  LogOut,
  ChevronDown,
  Search,
  RefreshCw,
} from "lucide-react";
import { AppRole, Profile } from "@/lib/types/domain";
import { getRoleBadgeColor, getRoleLabel, hasPermission, PermissionAction } from "@/lib/permissions/rbac";

interface AuthContextValue {
  user: Profile | null;
  loading: boolean;
  switchRole: (role: AppRole) => Promise<void>;
  refreshUser: () => Promise<void>;
  can: (action: PermissionAction) => boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  switchRole: async () => {},
  refreshUser: async () => {},
  can: () => false,
});

export function useAuth() {
  return useContext(AuthContext);
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: PermissionAction;
  adminOnly?: boolean;
}

const MAIN_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Master Asset (SAP)", href: "/assets", icon: Box, permission: "asset:read" },
  { label: "Master Equipment", href: "/equipment", icon: Cpu, permission: "equipment:read" },
  { label: "Unmapped Equipment", href: "/equipment/unmapped", icon: Unlink, permission: "equipment:read" },
  { label: "Mapping & Hierarki", href: "/mapping", icon: GitBranch, permission: "equipment:read" },
  { label: "Import Excel", href: "/imports", icon: FileSpreadsheet },
  { label: "Laporan", href: "/reports", icon: BarChart3, permission: "report:read" },
];

const ADMIN_NAV: NavItem[] = [
  { label: "Manajemen Pengguna", href: "/admin/users", icon: Users, permission: "users:manage", adminOnly: true },
  { label: "Audit Trail", href: "/admin/audit", icon: ClipboardList, permission: "audit:view_full", adminOnly: true },
  { label: "Rekonsiliasi Data", href: "/admin/reconciliation", icon: ShieldAlert, permission: "reconciliation:read" },
  { label: "Pengaturan", href: "/admin/settings", icon: Settings, permission: "settings:manage", adminOnly: true },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [resetting, setResetting] = useState(false);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/auth/session", { cache: "no-store" });
      const json = await res.json();
      if (json.data?.user) {
        setUser(json.data.user);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const switchRole = async (role: AppRole) => {
    setRoleDropdownOpen(false);
    const res = await fetch("/api/v1/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const json = await res.json();
    if (json.data?.user) {
      setUser(json.data.user);
      router.refresh();
    }
  };

  const handleResetDemo = async () => {
    setResetting(true);
    try {
      await fetch("/api/v1/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RESET_DEMO" }),
      });
      await fetchUser();
      window.location.reload();
    } finally {
      setResetting(false);
    }
  };

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = globalSearch.trim();
    if (!q) return;
    if (q.toUpperCase().startsWith("EQ")) {
      router.push(`/equipment?q=${encodeURIComponent(q)}`);
    } else {
      router.push(`/assets?q=${encodeURIComponent(q)}`);
    }
  };

  const can = useCallback(
    (action: PermissionAction) => hasPermission(user, action),
    [user]
  );

  return (
    <AuthContext.Provider value={{ user, loading, switchRole, refreshUser: fetchUser, can }}>
      <div className="min-h-screen flex flex-col bg-[#F6F4F0] text-[#1A3263]">
        {/* Top Navigation Bar — Brand Navy #1A3263 with Amber #FAB95B bottom accent */}
        <header className="sticky top-0 z-30 h-16 bg-[#1A3263] text-white shadow-md border-b-2 border-[#FAB95B] flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-3 group">
              <div className="bg-white rounded-lg px-2.5 py-1 shadow-sm flex items-center justify-center border border-[#E8E2DB] transition group-hover:scale-[1.02]">
                <img
                  src="/logo-aems.png"
                  alt="AEMS Logo"
                  className="h-7 w-auto object-contain"
                />
              </div>
              <div className="hidden sm:block">
                <div className="font-bold tracking-tight text-sm leading-tight text-white">
                  Asset &amp; Equipment Management
                </div>
                <div className="text-[11px] text-[#E8E2DB]/80 font-medium">
                  Enterprise Asset &amp; Technical Hierarchy
                </div>
              </div>
            </Link>
          </div>

          {/* Global Search Bar */}
          <form onSubmit={handleGlobalSearch} className="hidden md:flex items-center flex-1 max-w-md mx-6">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-[#E8E2DB]/70 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Cari No. Aset SAP, No. Equipment, Serial, atau Nama..."
                className="w-full pl-10 pr-4 py-1.5 text-sm rounded-lg bg-white/10 hover:bg-white/15 focus:bg-white focus:text-[#1A3263] placeholder-[#E8E2DB]/70 focus:placeholder-[#547792] outline-none transition border border-white/15 focus:border-[#FAB95B]"
              />
            </div>
          </form>

          {/* Right Action Controls: Reset Data & Active User Switcher */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleResetDemo}
              disabled={resetting}
              title="Muat ulang data awal"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/20 text-[#E8E2DB] border border-white/15 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#FAB95B] ${resetting ? "animate-spin" : ""}`} />
              <span>Reset Data</span>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setRoleDropdownOpen((v) => !v)}
                className="flex items-center gap-2.5 bg-white/10 hover:bg-white/20 border border-white/15 rounded-lg px-3 py-1.5 text-left transition"
              >
                <div className="w-7 h-7 rounded-full bg-[#FAB95B] text-[#1A3263] flex items-center justify-center text-xs font-extrabold">
                  {user?.full_name ? user.full_name.charAt(0).toUpperCase() : "U"}
                </div>
                <div className="hidden sm:block">
                  <div className="text-xs font-semibold leading-none">
                    {user?.full_name || "Memuat..."}
                  </div>
                  <div className="text-[11px] text-[#FAB95B] font-medium mt-0.5">
                    {getRoleLabel(user?.role)}
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-[#E8E2DB]" />
              </button>

              {roleDropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-xl bg-white shadow-xl border border-[#E8E2DB] py-2 z-50 text-[#1A3263]">
                  <div className="px-3.5 py-2 border-b border-[#E8E2DB]">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#547792]">
                      Beralih Peran Akses
                    </div>
                    <div className="text-xs text-[#547792] mt-0.5">
                      Pilih profil pengguna aktif
                    </div>
                  </div>

                  {(["ADMIN", "ACCOUNTING", "MAINTENANCE"] as AppRole[]).map((r) => {
                    const active = user?.role === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => switchRole(r)}
                        className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between text-xs hover:bg-[#F6F4F0] transition ${
                          active ? "bg-[#E8EEF7]/70 font-semibold" : ""
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-[#1A3263]">{getRoleLabel(r)}</div>
                          <div className="text-[11px] text-[#547792]">
                            {r === "ADMIN" && "Akses penuh & persetujuan perubahan"}
                            {r === "ACCOUNTING" && "Kelola Master Asset SAP & ajukan mapping"}
                            {r === "MAINTENANCE" && "Kelola Master Equipment, spesifikasi & ajukan mapping"}
                          </div>
                        </div>
                        {active && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#1A3263] text-[#FAB95B]">
                            Aktif
                          </span>
                        )}
                      </button>
                    );
                  })}

                  <div className="border-t border-[#E8E2DB] mt-1 pt-1">
                    <Link
                      href="/profile"
                      onClick={() => setRoleDropdownOpen(false)}
                      className="block px-3.5 py-2 text-xs text-[#1A3263] hover:bg-[#F6F4F0] font-medium"
                    >
                      Profil &amp; Hak Akses Saya
                    </Link>
                    <Link
                      href="/login"
                      onClick={() => setRoleDropdownOpen(false)}
                      className="flex items-center gap-2 px-3.5 py-2 text-xs text-[#547792] hover:text-[#1A3263] hover:bg-[#F6F4F0]"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Halaman Masuk</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Body Layout with Left Sidebar */}
        <div className="flex flex-1">
          <aside className="w-64 shrink-0 bg-white border-r border-[#E8E2DB] hidden lg:flex flex-col justify-between">
            <div className="p-4 space-y-6">
              {/* Active Role Badge */}
              <div className="p-3.5 rounded-xl bg-[#F6F4F0] border border-[#E8E2DB]">
                <div className="text-[11px] uppercase tracking-wider text-[#547792] font-bold">
                  Peran Aktif
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold border ${getRoleBadgeColor(
                      user?.role
                    )}`}
                  >
                    {getRoleLabel(user?.role)}
                  </span>
                </div>
              </div>

              {/* Main Navigation */}
              <div>
                <div className="px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-[#547792]">
                  Modul Utama
                </div>
                <nav className="space-y-1">
                  {MAIN_NAV.map((item) => {
                    if (item.permission && !can(item.permission)) return null;
                    const Icon = item.icon;
                    const isActive =
                      pathname === item.href ||
                      (item.href !== "/dashboard" &&
                        item.href !== "/equipment" &&
                        pathname.startsWith(item.href)) ||
                      (item.href === "/equipment" &&
                        pathname.startsWith("/equipment") &&
                        !pathname.startsWith("/equipment/unmapped"));

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                          isActive
                            ? "bg-[#1A3263] text-white font-semibold shadow-sm border-l-4 border-[#FAB95B]"
                            : "text-[#1A3263]/80 hover:bg-[#E8E2DB]/50 hover:text-[#1A3263]"
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isActive ? "text-[#FAB95B]" : "text-[#547792]"}`} />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </nav>
              </div>

              {/* Governance & Admin Navigation */}
              <div>
                <div className="px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-[#547792]">
                  Tata Kelola &amp; Admin
                </div>
                <nav className="space-y-1">
                  {ADMIN_NAV.map((item) => {
                    const allowed = item.permission ? can(item.permission) : true;
                    if (!allowed && item.adminOnly) return null;
                    const Icon = item.icon;
                    const isActive = pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                          isActive
                            ? "bg-[#1A3263] text-white font-semibold shadow-sm border-l-4 border-[#FAB95B]"
                            : "text-[#1A3263]/80 hover:bg-[#E8E2DB]/50 hover:text-[#1A3263]"
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isActive ? "text-[#FAB95B]" : "text-[#547792]"}`} />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </div>

            <div className="p-4 border-t border-[#E8E2DB] bg-[#F6F4F0]/50 text-[11px] text-[#547792] space-y-1">
              <div className="font-bold text-[#1A3263]">
                AEMS Enterprise
              </div>
              <div>Asset &amp; Equipment Management System</div>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
            {children}
          </main>
        </div>
      </div>
    </AuthContext.Provider>
  );
}
