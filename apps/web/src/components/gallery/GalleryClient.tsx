"use client";

import {
  type DragEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { Heart, Image as ImageIcon, Loader2, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  bulkDeleteGalleryMedia,
  bulkSetGalleryFavorite,
} from "@/actions/gallery";
import { markPageNotificationsRead } from "@/actions/notifications";
import { useToast } from "@/components/shared/useToast";
import type {
  GalleryFilter,
  GalleryMedia,
  GalleryViewerRole,
} from "@/types/gallery";
import { GalleryBulkToolbar } from "./GalleryBulkToolbar";
import { GalleryFilters } from "./GalleryFilters";
import { GalleryLightbox } from "./GalleryLightbox";
import { GalleryMasonryGrid } from "./GalleryMasonryGrid";
import { GalleryUpload, type GalleryUploadHandle } from "./GalleryUpload";

type GalleryClientProps = {
  media: GalleryMedia[];
  role: GalleryViewerRole;
};

export function GalleryClient({ media, role }: GalleryClientProps) {
  const router = useRouter();
  const toast = useToast();
  const dragDepthRef = useRef(0);
  const uploadRef = useRef<GalleryUploadHandle | null>(null);
  const [filter, setFilter] = useState<GalleryFilter>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const counts = useMemo<Record<GalleryFilter, number>>(
    () => ({
      all: media.length,
      image: media.filter((item) => item.media_type === "image").length,
      video: media.filter((item) => item.media_type === "video").length,
      favorite: media.filter((item) => item.is_favorite).length,
    }),
    [media],
  );

  const filteredMedia = useMemo(() => {
    if (filter === "image")
      return media.filter((item) => item.media_type === "image");
    if (filter === "video")
      return media.filter((item) => item.media_type === "video");
    if (filter === "favorite") return media.filter((item) => item.is_favorite);
    return media;
  }, [filter, media]);

  const selectedCount = selectedIds.size;
  const emptyState = useMemo(() => {
    if (media.length === 0) {
      return {
        title: "Galerie zatím neobsahuje žádné soubory",
        description: "Nahraj první fotku nebo video a galerie se začne plnit.",
        actionLabel: "Vybrat soubory",
      };
    }

    return {
      title: "Žádné médium neodpovídá aktuálním filtrům",
      description: "Zkus jiný filtr nebo nahraj nové médium.",
      actionLabel: "Vybrat soubory",
    };
  }, [media.length]);

  useEffect(() => {
    void markPageNotificationsRead("gallery");
  }, []);

  const changeFilter = (nextFilter: GalleryFilter) => {
    setFilter(nextFilter);
    setSelectedIds(new Set());
    setActiveIndex(null);
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const setBulkFavorite = (isFavorite: boolean) => {
    const ids = Array.from(selectedIds);
    setError(null);
    startTransition(async () => {
      const result = await bulkSetGalleryFavorite(ids, isFavorite);
      if (result?.error) {
        setError(result.error);
        toast.error("Favourite se nepodařilo uložit.", result.error);
        return;
      }
      clearSelection();
      toast.success(
        isFavorite
          ? `${ids.length} médií bylo přidaných do Favourite.`
          : `${ids.length} médií bylo odebraných z Favourite.`,
      );
      router.refresh();
    });
  };

  const deleteBulk = () => {
    if (!window.confirm("Opravdu chceš smazat vybraná média z galerie?"))
      return;

    const ids = Array.from(selectedIds);
    setError(null);
    startTransition(async () => {
      const result = await bulkDeleteGalleryMedia(ids);
      if (result?.error) {
        setError(result.error);
        toast.error("Média se nepodařilo smazat.", result.error);
        return;
      }
      clearSelection();
      setActiveIndex(null);
      toast.success(
        ids.length === 1
          ? "Médium bylo smazáno."
          : `${ids.length} médií bylo smazáno.`,
      );
      router.refresh();
    });
  };

  const hasDraggedFiles = (event: DragEvent<HTMLElement>) =>
    Array.from(event.dataTransfer.types).includes("Files");

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDraggingFiles(true);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDraggingFiles(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDraggingFiles(false);

    const droppedFiles = Array.from(event.dataTransfer.files).filter(
      (file) => file.size > 0,
    );
    if (droppedFiles.length === 0) return;

    uploadRef.current?.enqueueFiles(droppedFiles);
  };

  return (
    <div
      className="relative mx-auto min-h-[calc(100vh-5rem)] max-w-[1800px] space-y-6 p-4 md:p-6"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDraggingFiles ? (
        <div className="pointer-events-none absolute inset-3 z-50 flex items-center justify-center rounded-3xl border border-primary/60 bg-black/70 backdrop-blur-xl md:inset-5">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="rounded-2xl bg-primary/20 p-4 text-primary ring-1 ring-primary/30">
              <UploadCloud className="h-8 w-8" />
            </div>
            <div>
              <p className="text-lg font-bold text-white">
                Pusť soubory pro nahrání
              </p>
              <p className="text-sm text-zinc-400">
                Fotky a videa se přidají do fronty galerie.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-primary">
            Phase 3
          </p>
          <h1 className="mt-2 flex items-center gap-3 text-4xl font-bold text-white">
            <ImageIcon className="h-9 w-9 text-primary" />
            Galerie
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Pinterest-style feed fotek a videí s automatickým watermarkem.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-right">
            <p className="text-3xl font-bold text-white">{media.length}</p>
            <p className="text-xs font-semibold uppercase text-zinc-500">
              celkem
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-right">
            <p className="text-3xl font-bold text-white">{counts.video}</p>
            <p className="text-xs font-semibold uppercase text-zinc-500">
              videa
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-right">
            <p className="flex items-center justify-end gap-2 text-3xl font-bold text-white">
              {counts.favorite}
              <Heart className="h-6 w-6 fill-primary text-primary" />
            </p>
            <p className="text-xs font-semibold uppercase text-zinc-500">
              favourite
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <GalleryFilters
            activeFilter={filter}
            counts={counts}
            onFilterChange={changeFilter}
            onUploadClick={() => uploadRef.current?.openFilePicker()}
          />
          {isPending ? (
            <div className="inline-flex items-center gap-2 text-sm text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
              Ukládám změny
            </div>
          ) : null}
        </div>

        <GalleryUpload ref={uploadRef} />

        {error ? (
          <div
            role="alert"
            className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
          >
            {error}
          </div>
        ) : null}

        {role === "dom" ? (
          <GalleryBulkToolbar
            selectedCount={selectedCount}
            isPending={isPending}
            onSetFavorite={setBulkFavorite}
            onDelete={deleteBulk}
            onClear={clearSelection}
          />
        ) : null}

        <GalleryMasonryGrid
          media={filteredMedia}
          role={role}
          selectedIds={selectedIds}
          isPending={isPending}
          emptyTitle={emptyState.title}
          emptyDescription={emptyState.description}
          emptyActionLabel={emptyState.actionLabel}
          onEmptyAction={() => uploadRef.current?.openFilePicker()}
          onOpen={setActiveIndex}
          onToggleSelected={toggleSelected}
        />
      </div>

      {activeIndex !== null && filteredMedia[activeIndex] ? (
        <GalleryLightbox
          media={filteredMedia}
          activeIndex={activeIndex}
          role={role}
          onClose={() => setActiveIndex(null)}
          onNavigate={setActiveIndex}
        />
      ) : null}
    </div>
  );
}
