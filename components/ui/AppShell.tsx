"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Box,
  Cpu,
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

const NAV_GROUPS: Array<{ title: string; items: NavItem[] }> = [
  { title: "UTAMA", items: [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Pencarian", href: "/search", icon: Search },
  ] },
  { title: "DATA MASTER", items: [
    { label: "Master Asset", href: "/assets", icon: Box, permission: "asset:read" },
    { label: "Master Equipment", href: "/equipment", icon: Cpu, permission: "equipment:read" },
  ] },
  { title: "RELASI & OPERASIONAL", items: [
    { label: "Mapping & Hierarki", href: "/mapping", icon: GitBranch, permission: "mapping:request" },
    { label: "Persetujuan Mapping", href: "/mapping?tab=inbox", icon: ClipboardList, permission: "mapping:approve" },
    { label: "Import Excel", href: "/imports", icon: FileSpreadsheet },
  ] },
  { title: "MONITORING", items: [
    { label: "Laporan", href: "/reports", icon: BarChart3, permission: "report:read" },
    { label: "Rekonsiliasi", href: "/admin/reconciliation", icon: ShieldAlert, permission: "reconciliation:read" },
    { label: "Audit Trail", href: "/admin/audit", icon: ClipboardList, permission: "audit:view_full" },
  ] },
  { title: "PENGATURAN", items: [
    { label: "Pengguna", href: "/admin/users", icon: Users, permission: "users:manage" },
    { label: "Pengaturan", href: "/admin/settings", icon: Settings, permission: "settings:manage" },
  ] },
];


export function AppShell({ children, initialUser }: { children: React.ReactNode; initialUser: Profile }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [user, setUser] = useState<Profile | null>(initialUser);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [resetting, setResetting] = useState(false);
  const demoControlsEnabled = process.env.NEXT_PUBLIC_AEMS_DEMO_MODE === "true";

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/auth/session", { cache: "no-store" });
      const json = await res.json();
      setUser(json.data?.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setRoleDropdownOpen(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setRoleDropdownOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setRoleDropdownOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, []);

  const handleLogout = async () => {
    const res = await fetch("/api/v1/auth/session", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "LOGOUT" }),
    });
    if (res.ok) { window.location.assign("/login"); }
  };

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
    if (!demoControlsEnabled || !window.confirm("Reset seluruh data demo ke kondisi awal? Perubahan data demo akan hilang.")) return;
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
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  const can = useCallback(
    (action: PermissionAction) => hasPermission(user, action),
    [user]
  );

  const visibleNavGroups = loading || !user ? [] : NAV_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => !item.permission || can(item.permission)),
  })).filter(group => group.items.length > 0);

  return (
    <AuthContext.Provider value={{ user, loading, switchRole, refreshUser: fetchUser, can }}>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:p-3">Lewati ke konten</a>
      <div className="min-h-screen flex flex-col bg-[#F6F4F0] text-[#1A3263]">
        {/* Top Navigation Bar — Brand Navy #1A3263 with Amber #FAB95B bottom accent */}
        <header className="sticky top-0 z-30 h-16 bg-[#1A3263] text-white shadow-md border-b-2 border-[#FAB95B] flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-3 group">
              <div className="bg-white rounded-lg px-2.5 py-1 shadow-sm flex items-center justify-center border border-[#E8E2DB] transition group-hover:scale-[1.02]">
                <Image
                  src="/logo-aems.png"
                width={140}
                height={40}
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
            {demoControlsEnabled && <button
              type="button"
              onClick={handleResetDemo}
              disabled={resetting}
              title="Muat ulang data awal"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/20 text-[#E8E2DB] border border-white/15 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#FAB95B] ${resetting ? "animate-spin" : ""}`} />
              <span>Reset Data</span>
            </button>}

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                aria-expanded={roleDropdownOpen}
                aria-controls="account-menu"
                aria-label="Menu akun"
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
                <div id="account-menu" className="absolute right-0 mt-2 w-72 rounded-xl bg-white shadow-xl border border-[#E8E2DB] py-2 z-50 text-[#1A3263]">
                  {demoControlsEnabled && <><div className="px-3.5 py-2 border-b border-[#E8E2DB]">
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

                  </>}
                  <div className="border-t border-[#E8E2DB] mt-1 pt-1">
                    <Link
                      href="/profile"
                      onClick={() => setRoleDropdownOpen(false)}
                      className="block px-3.5 py-2 text-xs text-[#1A3263] hover:bg-[#F6F4F0] font-medium"
                    >
                      Profil &amp; Hak Akses Saya
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex items-center gap-2 px-3.5 py-2 text-xs text-[#547792] hover:text-[#1A3263] hover:bg-[#F6F4F0]"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Keluar</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Accessible mobile navigation: sidebar is hidden below lg breakpoint. */}
        <nav aria-label="Navigasi utama mobile" className="lg:hidden flex gap-1.5 overflow-x-auto border-b border-[#E8E2DB] bg-white px-3 py-2">
          {loading ? <span role="status" className="px-3 py-2 text-xs text-[#547792]">Memuat navigasi...</span> : visibleNavGroups.flatMap(group => group.items).map((item) => {
            const Icon = item.icon;
            const [path, query] = item.href.split("?");
            const active = query ? pathname === path && query.split("&").every(part => {
              const [key, value] = part.split("=");
              return searchParams.get(key) === value;
            }) : (pathname === path || (path !== "/dashboard" && pathname.startsWith(path + "/"))) && !(path === "/mapping" && searchParams.get("tab") === "inbox");
            return (
              <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${active ? "bg-[#1A3263] text-white" : "text-[#1A3263] hover:bg-[#F6F4F0]"}`}>
                <Icon className="h-4 w-4" aria-hidden="true" />{item.label}
              </Link>
            );
          })}
        </nav>

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

              <nav aria-label="Navigasi utama" className="space-y-5">
                {loading ? <div role="status" className="px-3 py-3 text-sm text-[#547792]">Memuat navigasi...</div> : visibleNavGroups.map(group => {
                  const items = group.items;
                  return <div key={group.title}>
                    <div className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wider text-[#547792]">{group.title}</div>
                    <div className="space-y-1">{items.map(item => {
                      const Icon = item.icon;
                      const [path, query] = item.href.split("?");
                      const isActive = pathname === path || (path !== "/dashboard" && pathname.startsWith(path + "/"));
                      const exactActive = query
                        ? pathname === path && query.split("&").every(part => {
                            const [key, value] = part.split("=");
                            return searchParams.get(key) === value;
                          })
                        : isActive && !(path === "/mapping" && searchParams.get("tab") === "inbox");
                      return <Link key={item.href} href={item.href} aria-current={exactActive ? "page" : undefined}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${exactActive ? "border-l-4 border-[#FAB95B] bg-[#1A3263] text-white" : "text-[#1A3263]/80 hover:bg-[#E8E2DB]/50"}`}>
                        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /><span>{item.label}</span>
                      </Link>;
                    })}</div>
                  </div>;
                })}
              </nav>
            </div>

            <div className="p-4 border-t border-[#E8E2DB] bg-[#F6F4F0]/50 text-[11px] text-[#547792] space-y-1">
              <div className="font-bold text-[#1A3263]">
                AEMS Enterprise
              </div>
              <div>Asset &amp; Equipment Management System</div>
            </div>
          </aside>

          {/* Main Content Area */}
          <main id="main-content" className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
            <div key={`${pathname}?${searchParams.toString()}`} className="page-content">{children}</div>
          </main>
        </div>
      </div>
    </AuthContext.Provider>
  );
}
