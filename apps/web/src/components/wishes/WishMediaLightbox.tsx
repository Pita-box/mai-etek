"use client";

import { useEffect } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import type { WishMedia } from "@/types/wish";

type WishMediaLightboxProps = {
  media: WishMedia[];
  activeIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
};

export function WishMediaLightbox({ media, activeIndex, onClose, onNavigate }: WishMediaLightboxProps) {
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

  const mediaUrl = `/api/wishes/media/${active.id}`;
  const posterUrl = `/api/wishes/media/${active.id}?variant=thumb`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-3 backdrop-blur-xl sm:p-4" role="dialog" aria-modal="true" aria-label="Prohlížení média">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#050509]">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{active.original_filename}</p>
            <p className="text-xs text-zinc-500">{activeIndex + 1} / {media.length}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {active.drive_web_view_link ? (
              <a
                href={active.drive_web_view_link}
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

          <div className="max-h-full w-full max-w-5xl">
            {active.media_type === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl} alt={active.original_filename} className="mx-auto max-h-[74vh] rounded-2xl border border-white/10 object-contain" />
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
                className="mx-auto max-h-[74vh] w-full rounded-2xl border border-white/10 bg-black"
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
