import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { themeBootstrap } from "@/lib/theme";

export const metadata: Metadata = {
  title: "AEMS — Asset & Equipment Management System",
  description:
    "Sistem manajemen integrasi data aset SAP, inventaris equipment operasional, dan hierarki teknis perusahaan.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{__html: themeBootstrap}} /></head>
      <body className="min-h-screen bg-[#F6F4F0] text-[#1A3263] antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
