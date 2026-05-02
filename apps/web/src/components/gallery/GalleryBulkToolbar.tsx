"use client";

import { Heart, Loader2, Trash2, X } from "lucide-react";

type GalleryBulkToolbarProps = {
  selectedCount: number;
  isPending?: boolean;
  onSetFavorite: (isFavorite: boolean) => void;
  onDelete: () => void;
  onClear: () => void;
};

export function GalleryBulkToolbar({
  selectedCount,
  isPending = false,
  onSetFavorite,
  onDelete,
  onClear,
}: GalleryBulkToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="sticky top-4 z-30 rounded-2xl border border-primary/30 bg-black/80 p-3 backdrop-blur-xl">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/15 px-3 py-2 text-sm font-bold text-primary">
            {selectedCount} vybráno
          </div>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onSetFavorite(true)}
            disabled={isPending}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Heart className="h-4 w-4" />
            Favourite
          </button>
          <button
            type="button"
            onClick={() => onSetFavorite(false)}
            disabled={isPending}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Heart className="h-4 w-4" />
            Odebrat
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={isPending}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/20 focus:outline-none focus:ring-2 focus:ring-rose-300/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            Smazat
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={isPending}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-4 w-4" />
            Zrušit
          </button>
        </div>
      </div>
    </div>
  );
}
