"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, ArrowUpDown, Filter, X } from "lucide-react";
import type { SortDirection } from "@/lib/table-query";
export type ColumnOption = {value: string; label: string};
export interface ColumnChoice {values: string[]; direction: SortDirection | null}
export function ColumnHeader({label, options, values = [], direction, onApply}: {label: string; options?: ColumnOption[]; values?: string[]; direction?: SortDirection; onApply: (choice: ColumnChoice) => void}) {
  const id = useId();
  const anchor = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false), [draft, setDraft] = useState(values), [sort, setSort] = useState<SortDirection | null>(direction || null), [query, setQuery] = useState("");
  const [position, setPosition] = useState({left: 0, top: 0, height: 460});
  useEffect(() => {
    if (!open) return;
    function place() {const rect = anchor.current?.getBoundingClientRect(); if (!rect) return; const height = Math.min(460, window.innerHeight - 24); setPosition({left: Math.max(12, Math.min(rect.left, window.innerWidth - 292)), top: Math.max(12, Math.min(rect.bottom + 6, window.innerHeight - height - 12)), height});}
    function outside(event: PointerEvent) {if (!panel.current?.contains(event.target as Node) && !anchor.current?.contains(event.target as Node)) setOpen(false);}
    function escape(event: KeyboardEvent) {if (event.key === "Escape") {setOpen(false); anchor.current?.focus();}}
    place(); panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape); window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    return () => {document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true);};
  }, [open]);
  function close() {setOpen(false); anchor.current?.focus();}
  const shown = options?.filter(option => option.label.toLocaleLowerCase("id").includes(query.toLocaleLowerCase("id")));
  return <th className="px-4 py-3 font-bold" aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"}>
    <button ref={anchor} type="button" aria-label={`Filter dan sortir ${label}`} aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => {setDraft([...values]); setSort(direction || null); setQuery(""); setOpen(value => !value);}} className={`inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-left ${values.length || direction ? "text-[#1A3263]" : "text-[#547792]"}`}>
      <span>{label}</span>{direction === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : direction === "desc" ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5" />}{values.length > 0 && <span className="inline-flex items-center gap-0.5 rounded bg-[#1A3263] px-1.5 py-0.5 text-[10px] text-white"><Filter className="h-2.5 w-2.5" />{values.length}</span>}
    </button>
    {open && createPortal(<div id={id} ref={panel} role="dialog" aria-label={`Filter kolom ${label}`} style={{left: position.left, top: position.top, maxHeight: position.height}} className="column-filter-panel fixed z-[70] flex w-[280px] max-w-[calc(100vw-24px)] flex-col rounded-xl border border-[#E8E2DB] bg-white p-3 text-xs text-[#1A3263] shadow-xl">
      <div className="mb-3 flex items-center justify-between gap-2"><strong>{label}</strong><button type="button" onClick={close} aria-label={`Tutup filter ${label}`} className="rounded p-1"><X className="h-4 w-4" /></button></div>
      <fieldset className="mb-3 shrink-0"><legend className="mb-1 font-semibold text-[#547792]">Urutan</legend><div className="grid grid-cols-2 gap-2">{([['asc','Naik (A–Z / 0–9)'],['desc','Turun (Z–A / 9–0)']] as const).map(([value, title]) => <label key={value} className="flex cursor-pointer items-start gap-1.5 rounded-lg border border-[#E8E2DB] p-2"><input type="radio" name={id} checked={sort === value} onChange={() => setSort(value)} /><span>{title}</span></label>)}</div></fieldset>
      {options && <><label className="mb-2 block font-semibold">Cari pilihan<input aria-label={`Cari pilihan ${label}`} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Ketik untuk mencari…" className="mt-1 w-full rounded-lg border border-[#E8E2DB] bg-[#F6F4F0] px-2 py-2 font-normal" /></label><div className="mb-2 flex justify-between gap-2"><button type="button" className="underline" onClick={() => setDraft(options.map(option => option.value))}>Pilih semua</button><button type="button" className="underline" onClick={() => setDraft([])}>Semua nilai</button></div><fieldset className="min-h-0 flex-1 overflow-y-auto border-y border-[#E8E2DB] py-2"><legend className="sr-only">Pilihan {label}</legend><p className="mb-2 text-[#547792]">Tanpa centang berarti semua nilai.</p>{shown?.length ? shown.map(option => <label key={option.value} className="flex cursor-pointer items-start gap-2 rounded px-1 py-1.5"><input type="checkbox" checked={draft.includes(option.value)} onChange={event => setDraft(previous => event.target.checked ? [...previous, option.value] : previous.filter(value => value !== option.value))} /><span className="break-words">{option.label}</span></label>) : <p className="py-2 text-[#547792]">Tidak ada pilihan yang cocok.</p>}</fieldset></>}
      <div className="mt-3 flex shrink-0 justify-between gap-2"><button type="button" className="rounded-lg border border-[#E8E2DB] px-3 py-2" onClick={() => {onApply({values: [], direction: null}); close();}}>Reset kolom</button><button type="button" className="rounded-lg bg-[#1A3263] px-3 py-2 font-semibold text-white" onClick={() => {onApply({values: draft, direction: sort}); close();}}>Terapkan</button></div>
    </div>, document.body)}
  </th>;
}
