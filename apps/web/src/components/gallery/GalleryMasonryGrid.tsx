"use client";

import { Loader2 } from "lucide-react";
import type { GalleryMedia, GalleryViewerRole } from "@/types/gallery";
import { GalleryMediaCard } from "./GalleryMediaCard";

type GalleryMasonryGridProps = {
  media: GalleryMedia[];
  role: GalleryViewerRole;
  selectedIds: Set<string>;
  isPending?: boolean;
  onOpen: (index: number) => void;
  onToggleSelected: (id: string) => void;
};

export function GalleryMasonryGrid({ media, role, selectedIds, isPending = false, onOpen, onToggleSelected }: GalleryMasonryGridProps) {
  if (media.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-10 text-center text-zinc-400">
        {isPending ? <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-primary" /> : null}
        Žádná média k zobrazení.
      </div>
    );
  }

  return (
    <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 2xl:columns-4 [column-fill:_balance]">
      {media.map((item, index) => (
        <GalleryMediaCard
          key={item.id}
          item={item}
          role={role}
          selected={selectedIds.has(item.id)}
          onOpen={() => onOpen(index)}
          onToggleSelected={() => onToggleSelected(item.id)}
        />
      ))}
    </div>
  );
}
