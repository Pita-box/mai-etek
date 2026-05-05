"use client";

import { useEffect, useTransition } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Heart, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { setGalleryFavorite } from "@/actions/gallery";
import { useToast } from "@/components/shared/useToast";
import type { GalleryMedia, GalleryViewerRole } from "@/types/gallery";

type GalleryLightboxProps = {
  media: GalleryMedia[];
  activeIndex: number;
  role: GalleryViewerRole;
  onClose: () => void;
  onNavigate: (index: number) => void;
};

export function GalleryLightbox({ media, activeIndex, role, onClose, onNavigate }: GalleryLightboxProps) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const active = media[activeIndex];
  const hasPrevious = activeIndex > 0;
  const hasNext = activeIndex < media.length - 1;

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && hasPrevious) onNavigate(activeIndex - 1);
      if (event.key === "ArrowRight" && hasNext) onNavigate(activeIndex + 1);
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeIndex, hasNext, hasPrevious, onClose, onNavigate]);

  if (!active) return null;

  const mediaUrl = `/api/gallery/media/${active.id}`;
  const posterUrl = `/api/gallery/media/${active.id}?variant=thumb`;

  const toggleFavorite = () => {
    startTransition(async () => {
      const result = await setGalleryFavorite(active.id, !active.is_favorite);
      if (result?.error) {
        toast.error("Favourite se nepodařilo uložit.", result.error);
        return;
      }

      toast.success(
        active.is_favorite
          ? "Médium bylo odebráno z Favourite."
          : "Médium bylo přidané do Favourite.",
      );
      router.refresh();
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-3 backdrop-blur-xl sm:p-4" role="dialog" aria-modal="true" aria-label="Prohlížení galerie">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#050509]">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{active.original_filename}</p>
            <p className="text-xs text-zinc-500">{activeIndex + 1} / {media.length}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {role === "dom" ? (
              <button
                type="button"
                onClick={toggleFavorite}
                disabled={isPending}
                className={`cursor-pointer rounded-xl border p-2 transition focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-50 ${
                  active.is_favorite
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10"
                }`}
                aria-label={active.is_favorite ? "Odebrat Favourite" : "Přidat Favourite"}
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className={`h-4 w-4 ${active.is_favorite ? "fill-current" : ""}`} />}
              </button>
            ) : active.is_favorite ? (
              <span className="rounded-xl border border-primary/30 bg-primary/10 p-2 text-primary">
                <Heart className="h-4 w-4 fill-current" />
              </span>
            ) : null}
            {active.display_drive_web_view_link ? (
              <a
                href={active.display_drive_web_view_link}
                target="_blank"
                rel="noreferrer"
                className="cursor-pointer rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-200 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary/60"
                aria-label="Otevřít na Google Drive"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-200 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary/60"
              aria-label="Zavřít lightbox"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center p-4 sm:p-6">
          {hasPrevious ? (
            <button
              type="button"
              onClick={() => onNavigate(activeIndex - 1)}
              className="absolute left-4 z-20 cursor-pointer rounded-full border border-white/10 bg-black/65 p-3 text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary/60"
              aria-label="Předchozí médium"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : null}

          <div className="max-h-full w-full max-w-6xl">
            {active.media_type === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl} alt={active.original_filename} className="mx-auto max-h-[76vh] rounded-2xl border border-white/10 object-contain" />
            ) : (
              <video
                key={active.id}
                src={mediaUrl}
                poster={posterUrl}
                controls
                playsInline
                preload="metadata"
                controlsList="nodownload noplaybackrate"
                disablePictureInPicture
                className="mx-auto max-h-[76vh] w-full rounded-2xl border border-white/10 bg-black"
              />
            )}
          </div>

          {hasNext ? (
            <button
              type="button"
              onClick={() => onNavigate(activeIndex + 1)}
              className="absolute right-4 z-20 cursor-pointer rounded-full border border-white/10 bg-black/65 p-3 text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary/60"
              aria-label="Další médium"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
