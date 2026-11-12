"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Network, Settings, Tags, MapPin } from "lucide-react";
import { useAuth } from "@/components/ui/AppShell";
export default function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth(),
    path = usePathname();
  const tabs = [
    { key: "users", name: "Pengguna", icon: Users, admin: true },
    { key: "organizations", name: "Organisasi", icon: Network },
    { key: "settings", name: "Pengaturan", icon: Settings, admin: true },
    { key: "categories", name: "Kategori Aset", icon: Tags },
    { key: "locations", name: "Lokasi Aset", icon: MapPin },
  ];
  return (
    <div className="space-y-6">
      <nav
        aria-label="Master Data"
        className="flex flex-wrap gap-2 rounded-xl border bg-white p-2"
      >
        {tabs
          .filter((t) => !t.admin || user?.role === "ADMIN")
          .map((t) => (
            <Link
              key={t.key}
              href={`/master-data/${t.key}`}
              aria-current={path.endsWith(t.key) ? "page" : undefined}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${path.endsWith(t.key) ? "bg-[#1A3263] text-white" : "hover:bg-slate-100"}`}
            >
              <t.icon className="h-4 w-4" />
              {t.name}
            </Link>
          ))}
      </nav>
      {children}
    </div>
  );
}
