"use client";

import { Filter, Search } from "lucide-react";
import type { WishStatus } from "@/types/wish";

type WishFiltersProps = {
  search: string;
  status: WishStatus | "all";
  onSearchChange: (value: string) => void;
  onStatusChange: (value: WishStatus | "all") => void;
};

const statusOptions: Array<{ value: WishStatus | "all"; label: string }> = [
  { value: "all", label: "Všechny stavy" },
  { value: "new", label: "Nové" },
  { value: "noted", label: "Vzato na vědomí" },
  { value: "planned", label: "Naplánováno" },
  { value: "fulfilled", label: "Splněno" },
  { value: "declined", label: "Zamítnuto" },
];

export function WishFilters({
  search,
  status,
  onSearchChange,
  onStatusChange,
}: WishFiltersProps) {
  return (
    <div className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-4 md:grid-cols-[minmax(0,1fr)_220px]">
      <label className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-black/35 px-4 py-3">
        <Search className="h-4 w-4 shrink-0 text-zinc-500" />
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-zinc-600 focus:outline-none"
          placeholder="Hledat přání"
        />
      </label>

      <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/35 px-4 py-3">
        <Filter className="h-4 w-4 shrink-0 text-zinc-500" />
        <select
          value={status}
          onChange={(event) => onStatusChange(event.target.value as WishStatus | "all")}
          className="min-w-0 flex-1 cursor-pointer bg-transparent text-sm text-white focus:outline-none"
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value} className="bg-zinc-950">
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
