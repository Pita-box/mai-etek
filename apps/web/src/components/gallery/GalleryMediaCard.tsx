"use client";

import { MouseEvent, useState, useTransition } from "react";
import { Check, Heart, Image as ImageIcon, Play, Video } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { setGalleryFavorite } from "@/actions/gallery";
import { useToast } from "@/components/shared/useToast";
import type { GalleryMedia, GalleryViewerRole } from "@/types/gallery";

type GalleryMediaCardProps = {
  item: GalleryMedia;
  role: GalleryViewerRole;
  selected: boolean;
  onOpen: () => void;
  onToggleSelected: () => void;
};

export function GalleryMediaCard({
  item,
  role,
  selected,
  onOpen,
  onToggleSelected,
}: GalleryMediaCardProps) {
  const router = useRouter();
  const toast = useToast();
  const [hasThumbnailError, setHasThumbnailError] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isVideo = item.media_type === "video";
  const thumbUrl = `/api/gallery/media/${item.id}?variant=thumb`;
  const aspectRatio =
    item.aspect_ratio && item.aspect_ratio > 0
      ? item.aspect_ratio
      : isVideo
        ? 16 / 9
        : 4 / 5;

  const toggleFavorite = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    startTransition(async () => {
      const result = await setGalleryFavorite(item.id, !item.is_favorite);
      if (result?.error) {
        toast.error("Favourite se nepodařilo uložit.", result.error);
        return;
      }

      toast.success(
        item.is_favorite
          ? "Médium bylo odebráno z Favourite."
          : "Médium bylo přidané do Favourite.",
      );
      router.refresh();
    });
  };

  const toggleSelected = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onToggleSelected();
  };

  return (
    <article className="group mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] backdrop-blur-xl transition hover:border-primary/30 hover:bg-white/[0.07]">
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") onOpen();
        }}
        className="block w-full cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-primary/60"
        aria-label="Otevřít médium"
      >
        <div className="relative bg-black/50" style={{ aspectRatio }}>
          {!hasThumbnailError ? (
            <Image
              src={thumbUrl}
              alt={item.original_filename}
              fill
              sizes="(min-width: 1536px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              unoptimized
              loading="lazy"
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
              onError={() => setHasThumbnailError(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-zinc-500">
              {isVideo ? (
                <Video className="h-9 w-9" />
              ) : (
                <ImageIcon className="h-9 w-9" />
              )}
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/90 via-black/55 to-transparent opacity-0 transition duration-300 group-hover:opacity-100 group-focus-within:opacity-100" />

          {isVideo ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/10">
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-black/65 text-white backdrop-blur">
                <Play className="ml-0.5 h-5 w-5 fill-current" />
              </span>
            </div>
          ) : null}

          {role === "dom" ? (
            <button
              type="button"
              onClick={toggleSelected}
              onKeyDown={(event) => event.stopPropagation()}
              className={`absolute left-3 top-3 flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl border transition focus:outline-none focus:ring-2 focus:ring-primary/60 ${
                selected
                  ? "border-primary/70 bg-primary text-white"
                  : "border-white/15 bg-black/55 text-zinc-300 opacity-0 backdrop-blur hover:bg-white/10 group-hover:opacity-100"
              }`}
              aria-label={selected ? "Odznačit médium" : "Vybrat médium"}
            >
              <Check className="h-4 w-4" />
            </button>
          ) : null}

          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3 opacity-0 transition duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
            <div className="min-w-0 text-white">
              <p className="truncate text-sm font-semibold">
                {item.original_filename}
              </p>
              <p className="mt-1 truncate text-xs text-zinc-300">
                {item.uploader_name || "Uživatel"}
              </p>
            </div>
            {role === "dom" ? (
              <button
                type="button"
                onClick={toggleFavorite}
                onKeyDown={(event) => event.stopPropagation()}
                disabled={isPending}
                className={`shrink-0 cursor-pointer rounded-xl border p-2 transition focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-50 ${
                  item.is_favorite
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-white/15 bg-black/55 text-zinc-300 backdrop-blur hover:bg-white/10 hover:text-white"
                }`}
                aria-label={
                  item.is_favorite ? "Odebrat Favourite" : "Přidat Favourite"
                }
              >
                <Heart
                  className={`h-4 w-4 ${item.is_favorite ? "fill-current" : ""}`}
                />
              </button>
            ) : item.is_favorite ? (
              <span className="shrink-0 rounded-xl border border-primary/30 bg-primary/10 p-2 text-primary">
                <Heart className="h-4 w-4 fill-current" />
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
