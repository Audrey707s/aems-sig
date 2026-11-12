import Image from "next/image";
import type { ReactNode } from "react";

export const authInputClass = "mt-2 block w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-normal text-slate-900 outline-none transition focus:border-[#1A3263] focus:ring-2 focus:ring-[#1A3263]/10 disabled:opacity-60";
export const authButtonClass = "w-full rounded-xl bg-[#1A3263] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#122347] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A3263] disabled:cursor-wait disabled:opacity-60";
export const authLinkClass = "font-semibold text-[#1A3263] underline-offset-4 hover:underline focus-visible:underline";

export function AuthCard({title, children}: {title: string; children: ReactNode}) {
  return <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-5 py-10 text-slate-800">
    <section className="w-full max-w-[420px] rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-9 sm:py-10" aria-labelledby="auth-title">
      <header className="mb-7 text-center">
        <Image src="/logo-aems.png" alt="AEMS" width={160} height={48} priority className="mx-auto h-12 w-auto object-contain" />
        <h1 id="auth-title" className="mt-6 text-2xl font-bold tracking-tight text-[#1A3263]">{title}</h1>
      </header>
      {children}
    </section>
  </main>;
}
