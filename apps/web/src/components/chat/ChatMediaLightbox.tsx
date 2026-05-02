'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { ChatMessageItem } from '@/types/chat';

type ChatMediaLightboxProps = {
  message: ChatMessageItem;
  onClose: () => void;
};

export function ChatMediaLightbox({ message, onClose }: ChatMediaLightboxProps) {
  const media = message.media;

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!media) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-xl" role="dialog" aria-modal="true" aria-label="Prohlížení média">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#050509]">
        <div className="flex justify-end border-b border-white/10 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-200 transition-all duration-400 hover:border-primary/30 hover:bg-primary/10 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/60"
            aria-label="Zavřít lightbox"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center p-4 sm:p-6">
          {message.type === 'video' ? (
            <video
              src={media.url}
              controls
              autoPlay
              className="max-h-[78vh] w-full max-w-5xl rounded-2xl border border-white/10 bg-black object-contain"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={media.url}
              alt="Příloha v chatu"
              className="mx-auto max-h-[78vh] max-w-full rounded-2xl border border-white/10 object-contain"
            />
          )}
        </div>
      </div>
    </div>
  );
}
