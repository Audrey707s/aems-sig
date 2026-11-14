"use client";
import Link from "next/link";
import {ChevronLeft, ChevronRight} from "lucide-react";
import {useState, type ReactNode} from "react";
import {pageWindow} from "@/lib/pagination";
type Pagination = {page: number; total: number; page_size: number; total_pages: number};
export function PanelPagination({label, pagination, onPage, href, busy = false}: {label: string; pagination: Pagination; onPage: (page: number) => void; href?: string; busy?: boolean}) {
  const {first, last} = pageWindow(pagination.total, pagination.page, pagination.page_size);
  return <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#E8E2DB] pt-3 text-xs text-[#547792]">
    <div className="flex flex-wrap items-center gap-3"><span aria-live="polite">{first}–{last} dari {pagination.total}</span>{href && <Link href={href} className="font-semibold underline underline-offset-4">Lihat semua</Link>}</div>
    <nav aria-label={`Navigasi ${label}`} className="flex items-center gap-2"><button type="button" aria-label={`${label}: sebelumnya`} disabled={busy || pagination.page <= 1} onClick={() => onPage(pagination.page - 1)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E8E2DB] bg-white"><ChevronLeft size={15} /></button><button type="button" aria-label={`${label}: berikutnya`} disabled={busy || pagination.page >= pagination.total_pages} onClick={() => onPage(pagination.page + 1)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E8E2DB] bg-white"><ChevronRight size={15} /></button></nav>
  </footer>;
}
export function PagedPanelList<T>({items, label, href, empty, children, listClassName = ""}: {items: T[]; label: string; href: string; empty: string; children: (item: T) => ReactNode; listClassName?: string}) {
  const [requestedPage, setPage] = useState(1);
  const pagination = pageWindow(items.length, requestedPage);
  return <div className="flex flex-1 flex-col"><div className={`flex-1 ${listClassName}`} aria-label={`Daftar ${label}`}>{items.length ? items.slice(pagination.offset, pagination.offset + pagination.page_size).map(children) : <p className="dashboard-empty">{empty}</p>}</div><PanelPagination label={label} pagination={pagination} onPage={setPage} href={href} /></div>;
}
