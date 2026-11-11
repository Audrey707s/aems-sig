import React, { Suspense } from "react";
import { AppShell } from "@/components/ui/AppShell";

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div role="status" className="p-6 text-sm text-slate-600">Memuat aplikasi...</div>}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
