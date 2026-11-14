"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { selectedValues, type SortDirection } from "@/lib/table-query";
import type { ColumnChoice, ColumnOption } from "./ColumnHeader";
export function useColumnFilters(defaultSort: string, resetPage: () => void) {
  const params = useSearchParams(), router = useRouter();
  const sortBy = params.get("sort_by") || defaultSort;
  const sortDir: SortDirection = params.get("sort_dir") === "desc" ? "desc" : "asc";
  function column(label: string, sortKey: string, filterKey?: string, options?: ColumnOption[]) {
    return {label, options, values: selectedValues(filterKey ? params.get(filterKey) : null), direction: sortBy === sortKey ? sortDir as "asc" | "desc" : undefined,
      onApply: ({values, direction}: ColumnChoice) => {
        const next = new URLSearchParams(params.toString());
        if (filterKey) {if (values.length) next.set(filterKey, values.join(",")); else next.delete(filterKey);}
        if (direction) {next.set("sort_by", sortKey); next.set("sort_dir", direction);}
        else if (sortBy === sortKey) {next.delete("sort_by"); next.delete("sort_dir");}
        next.delete("page"); resetPage(); router.push(`?${next.toString()}`, {scroll: false});
      }};
  }
  return {column, sortBy, sortDir};
}
