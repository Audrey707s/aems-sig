import { Search } from "lucide-react";
import type { InputHTMLAttributes } from "react";
export function SearchField(props: InputHTMLAttributes<HTMLInputElement>) {
  return <div className="relative min-w-0 flex-1"><Search aria-hidden="true" className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#547792]" /><input {...props} type="search" className="aems-search-field w-full rounded-lg border border-[#E8E2DB] bg-[#F6F4F0]/50 py-2 pl-10 pr-4 text-xs text-[#1A3263] outline-none focus:border-[#1A3263] focus:bg-white" /></div>;
}
