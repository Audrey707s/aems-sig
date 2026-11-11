import React, { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/ui/AppShell";
import { getCurrentProfile } from "@/lib/auth/session";
import { AemsError } from "@/lib/utils/errors";

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile().catch((error: unknown) => {
    if (error instanceof AemsError && [401, 403].includes(error.httpStatus)) redirect("/login");
    throw error;
  });
  return <Suspense fallback={<div role="status" className="p-6 text-sm text-slate-600">Memuat aplikasi...</div>}>
    <AppShell initialUser={profile}>{children}</AppShell>
  </Suspense>;
}
