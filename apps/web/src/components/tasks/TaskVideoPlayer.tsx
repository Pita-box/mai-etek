'use client';

import { useEffect, useRef } from 'react';
import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import 'video.js/dist/video-js.css';

type TaskVideoPlayerProps = {
  src: string;
  mimeType?: string | null;
  poster?: string;
};

export function TaskVideoPlayer({ src, mimeType, poster }: TaskVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<Player | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (!playerRef.current) {
      const videoElement = document.createElement('video-js');
      videoElement.classList.add('vjs-big-play-centered', 'vjs-fluid');
      videoElement.setAttribute('playsinline', 'true');
      containerRef.current.appendChild(videoElement);

      playerRef.current = videojs(videoElement, {
        controls: true,
        fluid: true,
        responsive: true,
        preload: 'metadata',
        sources: [{ src, type: mimeType || 'video/mp4' }],
        poster,
      });
      return;
    }

    playerRef.current.poster(poster || '');
    playerRef.current.src({ src, type: mimeType || 'video/mp4' });
  }, [mimeType, poster, src]);

  useEffect(() => {
    return () => {
      if (playerRef.current && !playerRef.current.isDisposed()) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, []);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl shadow-black/60 [&_.video-js]:min-h-[240px] [&_.video-js]:bg-black [&_.video-js]:text-white [&_.vjs-big-play-button]:border-primary [&_.vjs-big-play-button]:bg-primary/80 [&_.vjs-big-play-button]:text-black">
      <div ref={containerRef} data-vjs-player />
    </div>
  );
}
