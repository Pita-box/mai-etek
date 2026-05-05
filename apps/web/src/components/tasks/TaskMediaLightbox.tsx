'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, X } from 'lucide-react';
import { TaskMedia } from '@/types/task';

const TaskVideoPlayer = dynamic(() => import('./TaskVideoPlayer').then((mod) => mod.TaskVideoPlayer), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[240px] items-center justify-center rounded-[1.75rem] border border-white/10 bg-black">
      <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
    </div>
  ),
});

type TaskMediaLightboxProps = {
  media: TaskMedia[];
  activeIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
};

export function TaskMediaLightbox({ media, activeIndex, onClose, onNavigate }: TaskMediaLightboxProps) {
  const active = media[activeIndex];
  const hasPrevious = activeIndex > 0;
  const hasNext = activeIndex < media.length - 1;

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft' && hasPrevious) onNavigate(activeIndex - 1);
      if (event.key === 'ArrowRight' && hasNext) onNavigate(activeIndex + 1);
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeIndex, hasNext, hasPrevious, onClose, onNavigate]);

  if (!active) return null;

  const proxySrc = `/api/tasks/media/${active.id}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-xl" role="dialog" aria-modal="true" aria-label="Prohlížení média">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#050509] shadow-2xl shadow-black/70">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{active.original_filename}</p>
            <p className="text-xs text-zinc-500">{activeIndex + 1} / {media.length}</p>
          </div>
          <div className="flex items-center gap-2">
            {active.drive_web_view_link ? (
              <a
                id="task-media-lightbox-drive-link"
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
              id="task-media-lightbox-close"
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
              id="task-media-lightbox-prev"
              type="button"
              onClick={() => onNavigate(activeIndex - 1)}
              className="absolute left-4 z-20 cursor-pointer rounded-full border border-white/10 bg-black/60 p-3 text-white shadow-xl transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary/60"
              aria-label="Předchozí médium"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : null}

          <div className="max-h-full w-full max-w-5xl">
            {active.media_type === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={proxySrc} alt={active.original_filename} className="mx-auto max-h-[74vh] rounded-2xl border border-white/10 object-contain shadow-2xl shadow-black/60" />
            ) : (
              <TaskVideoPlayer key={active.id} src={proxySrc} mimeType={active.mime_type} />
            )}
          </div>

          {hasNext ? (
            <button
              id="task-media-lightbox-next"
              type="button"
              onClick={() => onNavigate(activeIndex + 1)}
              className="absolute right-4 z-20 cursor-pointer rounded-full border border-white/10 bg-black/60 p-3 text-white shadow-xl transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary/60"
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
