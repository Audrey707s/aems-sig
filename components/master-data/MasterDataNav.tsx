"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  UserRound,
  Users,
  Network,
  Settings,
  Tags,
  MapPin,
} from "lucide-react";
import { useAuth } from "@/components/ui/AppShell";
export function MasterDataNav() {
  const { user } = useAuth(),
    path = usePathname();
  const tabs = [
    { href: "/profile", name: "Profil", icon: UserRound },
    { href: "/master-data/users", name: "Pengguna", icon: Users, admin: true },
    { href: "/master-data/organizations", name: "Organisasi", icon: Network },
    {
      href: "/master-data/settings",
      name: "Pengaturan",
      icon: Settings,
      admin: true,
    },
    { href: "/master-data/categories", name: "Kategori Aset", icon: Tags },
    { href: "/master-data/locations", name: "Lokasi Aset", icon: MapPin },
  ];
  return (
    <nav aria-label="Master Data" className="flex flex-wrap gap-2">
      {tabs
        .filter((t) => !t.admin || user?.role === "ADMIN")
        .map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={path === t.href ? "page" : undefined}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${path === t.href ? "bg-[#1A3263] text-white" : "text-slate-600 hover:bg-white"}`}
          >
            <t.icon size={15} />
            {t.name}
          </Link>
        ))}
    </nav>
  );
}
