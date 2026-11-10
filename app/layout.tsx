import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[#F6F4F0] text-[#1A3263] antialiased">
        {children}
      </body>
    </html>
  );
}
