import { AemsLogo } from "@/components/ui/AemsLogo";
import { ThemeSwitcher } from "@/components/theme/ThemeProvider";
import type { ReactNode } from "react";

export const authInputClass = "mt-1.5 block min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-[#1A3263] focus:ring-2 focus:ring-[#1A3263]/10 disabled:opacity-60";
export const authButtonClass = "min-h-11 w-full rounded-md bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A3263] disabled:cursor-not-allowed disabled:opacity-60";
export const authLinkClass = "font-medium text-slate-900 underline underline-offset-4";

export function AuthCard({title, children}: {title: string; children: ReactNode}) {
  return <main className="aems-auth-page flex min-h-dvh w-full items-center justify-center bg-white px-4 py-20 text-slate-900 sm:px-8 sm:py-10">
    <section className="mx-auto w-full max-w-[440px] rounded-2xl border border-red-100 bg-white px-6 py-8 shadow-[0_10px_35px_-4px_rgba(230,150,150,0.12)] sm:px-9 sm:py-9" aria-labelledby="auth-title">
      <header>
        <div className="mb-4 flex justify-end"><ThemeSwitcher /></div>
        <div className="mb-4 flex justify-center">
          <AemsLogo className="w-[min(62vw,224px)] sm:w-[240px]" />
        </div>
        <h1 id="auth-title" className="mb-6 text-center text-[22px] font-bold leading-[1.5] tracking-tight text-slate-900">{title}</h1>
      </header>
      {children}
    </section>
  </main>;
}
