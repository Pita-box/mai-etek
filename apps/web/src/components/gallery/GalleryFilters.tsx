"use client";

import {
  Heart,
  Image as ImageIcon,
  LayoutGrid,
  UploadCloud,
  Video,
} from "lucide-react";
import type { GalleryFilter } from "@/types/gallery";

type GalleryFiltersProps = {
  activeFilter: GalleryFilter;
  counts: Record<GalleryFilter, number>;
  onFilterChange: (filter: GalleryFilter) => void;
  onUploadClick: () => void;
};

const filterOptions: Array<{
  value: GalleryFilter;
  label: string;
  icon: typeof LayoutGrid;
}> = [
  { value: "all", label: "Vše", icon: LayoutGrid },
  { value: "image", label: "Fotky", icon: ImageIcon },
  { value: "video", label: "Videa", icon: Video },
  { value: "favorite", label: "Favourite", icon: Heart },
];

export function GalleryFilters({
  activeFilter,
  counts,
  onFilterChange,
  onUploadClick,
}: GalleryFiltersProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {filterOptions.map((option) => {
        const Icon = option.icon;
        const active = activeFilter === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onFilterChange(option.value)}
            className={`inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-primary/60 ${
              active
                ? "border-primary/60 bg-primary text-white"
                : "border-white/10 bg-white/[0.045] text-zinc-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Icon className="h-4 w-4" />
            {option.label}
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-white/20 text-white" : "bg-black/35 text-zinc-400"}`}
            >
              {counts[option.value]}
            </span>
          </button>
        );
      })}

      <button
        type="button"
        onClick={onUploadClick}
        className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-2xl border border-primary/60 bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/60"
      >
        <UploadCloud className="h-4 w-4" />
        Vybrat soubory
      </button>
    </div>
  );
}
