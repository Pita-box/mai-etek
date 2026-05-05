"use client";

import { ExternalLink, Image as ImageIcon, Play, Trash2, Video } from "lucide-react";
import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteWishMedia } from "@/actions/wishes";
import { useToast } from "@/components/shared/useToast";
import { formatWishMediaBytes } from "@/lib/wishes/media-limits";
import type { WishMedia } from "@/types/wish";
import { WishMediaLightbox } from "./WishMediaLightbox";

type WishMediaStripProps = {
  media: WishMedia[];
  canDelete?: boolean;
};

type WishMediaPreviewProps = {
  item: WishMedia;
  onOpen: () => void;
};

function WishMediaPreview({ item, onOpen }: WishMediaPreviewProps) {
  const [hasThumbnailError, setHasThumbnailError] = useState(false);
  const thumbUrl = `/api/wishes/media/${item.id}?variant=thumb`;
  const isVideo = item.media_type === "video";
  const showImage = !hasThumbnailError;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/60"
      aria-label="Otevřít médium"
    >
      <div className="relative aspect-video bg-black/50">
        {showImage ? (
          <Image
            src={thumbUrl}
            alt={item.original_filename}
            fill
            sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
            unoptimized
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
            loading="lazy"
            onError={() => setHasThumbnailError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-zinc-500">
            {isVideo ? <Video className="h-8 w-8" /> : <ImageIcon className="h-8 w-8" />}
          </div>
        )}

        {isVideo ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/65 text-white backdrop-blur">
              <Play className="ml-0.5 h-5 w-5 fill-current" />
            </span>
          </div>
        ) : null}
      </div>
    </button>
  );
}

export function WishMediaStrip({ media, canDelete = false }: WishMediaStripProps) {
  const router = useRouter();
  const toast = useToast();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  if (media.length === 0) return null;

  const removeMedia = (mediaId: string) => {
    if (!window.confirm("Opravdu chceš odebrat toto médium z přání?")) {
      return;
    }

    startTransition(async () => {
      const result = await deleteWishMedia(mediaId);
      if (result?.error) {
        toast.error("Médium se nepodařilo odebrat.", result.error);
        return;
      }

      toast.success("Médium bylo odebráno.");
      router.refresh();
    });
  };

  return (
    <div className="border-t border-white/10 pt-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-200">
        <ImageIcon className="h-4 w-4 text-primary" />
        Média
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {media.map((item, itemIndex) => {
          const mediaUrl = `/api/wishes/media/${item.id}`;
          const isImage = item.media_type === "image";
          const Icon = isImage ? ImageIcon : Video;

          return (
            <div key={item.id} className="group overflow-hidden rounded-2xl border border-white/10 bg-black/35">
              <WishMediaPreview item={item} onOpen={() => setActiveIndex(itemIndex)} />
              <div className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{item.original_filename}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
                    <Icon className="h-3.5 w-3.5" />
                    {item.size_bytes ? formatWishMediaBytes(item.size_bytes) : "Neznámá velikost"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <a
                    href={item.drive_web_view_link || mediaUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="cursor-pointer rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-300 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-primary/60"
                    aria-label="Otevřít médium"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  {canDelete ? (
                    <button
                      type="button"
                      onClick={() => removeMedia(item.id)}
                      disabled={isPending}
                      className="cursor-pointer rounded-xl border border-rose-400/20 bg-rose-500/10 p-2 text-rose-100 transition hover:bg-rose-500/20 focus:outline-none focus:ring-2 focus:ring-rose-300/60 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Odebrat médium"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {activeIndex !== null && media[activeIndex] ? (
        <WishMediaLightbox
          media={media}
          activeIndex={activeIndex}
          onClose={() => setActiveIndex(null)}
          onNavigate={setActiveIndex}
        />
      ) : null}
    </div>
  );
}
