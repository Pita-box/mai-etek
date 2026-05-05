"use client";

import { Image as ImageIcon, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import type { GalleryMedia, GalleryViewerRole } from "@/types/gallery";
import { GalleryMediaCard } from "./GalleryMediaCard";

type GalleryMasonryGridProps = {
  media: GalleryMedia[];
  role: GalleryViewerRole;
  selectedIds: Set<string>;
  isPending?: boolean;
  emptyTitle: string;
  emptyDescription: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  onOpen: (index: number) => void;
  onToggleSelected: (id: string) => void;
};

export function GalleryMasonryGrid({
  media,
  role,
  selectedIds,
  isPending = false,
  emptyTitle,
  emptyDescription,
  emptyActionLabel,
  onEmptyAction,
  onOpen,
  onToggleSelected,
}: GalleryMasonryGridProps) {
  if (media.length === 0) {
    return (
      <div className="relative">
        {isPending ? (
          <div className="absolute right-4 top-4 z-10 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/70 px-3 py-1.5 text-xs text-zinc-300 backdrop-blur-xl">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            Ukládám
          </div>
        ) : null}
        <EmptyState
          icon={ImageIcon}
          title={emptyTitle}
          description={emptyDescription}
          actionLabel={emptyActionLabel}
          onAction={onEmptyAction}
          variant="compact"
          className="min-h-56"
        />
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
