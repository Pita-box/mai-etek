'use client';

import { SyntheticEvent, useMemo, useState, useTransition } from 'react';
import { ExternalLink, Image as ImageIcon, Loader2, Trash2, Video } from 'lucide-react';
import { deleteTaskMedia } from '@/actions/tasks';
import { Task, TaskMedia } from '@/types/task';
import { TaskMediaLightbox } from './TaskMediaLightbox';
import { TaskMediaUpload } from './TaskMediaUpload';

type TaskMediaGalleryProps = {
  task: Task;
  mediaType: 'image' | 'video';
  role: 'dom' | 'sub';
  onTaskMutated: () => Promise<void>;
};

type TaskMediaThumbnailProps = {
  item: TaskMedia;
  onMissing: (mediaId: string) => void;
};

function TaskMediaThumbnail({ item, onMissing }: TaskMediaThumbnailProps) {
  const src = item.media_type === 'image' ? `/api/tasks/media/${item.id}?variant=thumb` : `/api/tasks/media/${item.id}`;
  const Icon = item.media_type === 'image' ? ImageIcon : Video;

  const handleLoadError = (event: SyntheticEvent<HTMLImageElement | HTMLVideoElement>) => {
    event.currentTarget.style.display = 'none';
    onMissing(item.id);
  };

  return (
    <div className="relative mb-3 h-32 overflow-hidden rounded-xl bg-black/50 text-zinc-500 ring-1 ring-white/10">
      {item.media_type === 'image' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={item.original_filename} onError={handleLoadError} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
      ) : (
        <video src={src} muted playsInline preload="metadata" onError={handleLoadError} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10" />
      <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-white/10 bg-black/55 p-2 text-white/80 backdrop-blur">
        <Icon className="h-4 w-4" />
      </div>
    </div>
  );
}

export function TaskMediaGallery({ task, mediaType, role, onTaskMutated }: TaskMediaGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [hiddenMediaIds, setHiddenMediaIds] = useState<Set<string>>(() => new Set());
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [cleanupNotice, setCleanupNotice] = useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isRefreshingMissing, startMissingRefreshTransition] = useTransition();
  const Icon = mediaType === 'image' ? ImageIcon : Video;
  const canDeleteMedia = role === 'dom';
  const isRecurringTemplate = task.recurrence !== 'none' && !task.parent_task_id;
  const legacyMedia = (task.task_evidence || []).filter((item) => item.type === mediaType);
  const media = useMemo(
    () =>
      (task.task_media || [])
        .filter((item) => item.media_type === mediaType && !hiddenMediaIds.has(item.id))
        .toSorted((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [hiddenMediaIds, mediaType, task.task_media]
  );

  const handleDeleteMedia = (mediaId: string) => {
    setDeleteError(null);
    setCleanupNotice(null);
    setDeletingId(mediaId);
    startDeleteTransition(async () => {
      const result = await deleteTaskMedia(mediaId);
      if (result?.error) {
        setDeleteError(result.error);
        setDeletingId(null);
        return;
      }

      setHiddenMediaIds((current) => new Set(current).add(mediaId));
      setActiveIndex(null);
      await onTaskMutated();
      setDeletingId(null);
    });
  };

  const handleMissingMedia = (mediaId: string) => {
    if (hiddenMediaIds.has(mediaId)) return;

    setHiddenMediaIds((current) => new Set(current).add(mediaId));
    setActiveIndex(null);
    setCleanupNotice('Soubor už na Google Drive neexistuje a byl odebrán z evidence.');
    startMissingRefreshTransition(async () => {
      await onTaskMutated();
    });
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
      <div className="mb-4 flex items-center gap-2 text-white">
        <Icon className="h-5 w-5 text-primary" />
        <h4 className="font-bold">{mediaType === 'image' ? 'Fotky' : 'Videa'}</h4>
        {isRefreshingMissing ? <Loader2 className="h-4 w-4 animate-spin text-zinc-500" /> : null}
      </div>
      {media.length || legacyMedia.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {media.map((item, index) => (
            <div key={item.id} className="group relative rounded-2xl border border-white/10 bg-white/[0.04] p-3 transition hover:border-primary/40 hover:bg-white/[0.08]">
              {canDeleteMedia ? (
                <button
                  id={`task-media-delete-${item.id}`}
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleDeleteMedia(item.id);
                  }}
                  disabled={isDeleting}
                  className="absolute right-5 top-5 z-10 cursor-pointer rounded-xl border border-rose-300/20 bg-black/70 p-2 text-rose-200 backdrop-blur transition hover:bg-rose-500/20 focus:outline-none focus:ring-2 focus:ring-rose-300/60 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Smazat médium z evidence"
                >
                  {deletingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              ) : null}
              <button
                id={`task-media-open-${item.id}`}
                type="button"
                onClick={() => setActiveIndex(index)}
                className="w-full cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-primary/60"
              >
                <TaskMediaThumbnail item={item} onMissing={handleMissingMedia} />
                <div className="flex items-center justify-between gap-2 px-1 text-sm">
                  <span className="truncate text-white">{item.original_filename}</span>
                  <span className="shrink-0 rounded-full border border-white/10 px-2 py-1 text-xs text-zinc-400">Otevřít</span>
                </div>
              </button>
            </div>
          ))}
          {legacyMedia.map((item) => (
            <a key={item.id} href={item.content} target="_blank" rel="noreferrer" className="cursor-pointer rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-zinc-300 transition hover:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-primary/60">
              Legacy odkaz <ExternalLink className="ml-2 inline h-4 w-4" />
            </a>
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-500">Zatím nebyla přidána žádná {mediaType === 'image' ? 'fotka' : 'videa'}.</p>
      )}
      {deleteError ? <p className="mt-3 text-sm text-rose-300">{deleteError}</p> : null}
      {cleanupNotice ? <p className="mt-3 text-sm text-amber-200">{cleanupNotice}</p> : null}
      {!isRecurringTemplate && (task.status === 'in_progress' || task.status === 'revision_requested') ? (
        <div className="mt-5">
          <TaskMediaUpload taskId={task.id} mediaType={mediaType} />
        </div>
      ) : null}

      {activeIndex !== null ? <TaskMediaLightbox media={media} activeIndex={activeIndex} onClose={() => setActiveIndex(null)} onNavigate={setActiveIndex} /> : null}
    </div>
  );
}
