import React from "react";
import { AppShell } from "@/components/ui/AppShell";

export default function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}

