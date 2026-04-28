'use client';

import { MouseEvent, useEffect, useRef } from 'react';
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

  const preventContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  useEffect(() => {
    if (!containerRef.current) return;

    if (!playerRef.current) {
      const videoElement = document.createElement('video-js');
      videoElement.classList.add('vjs-big-play-centered', 'vjs-fluid', 'task-video-player');
      videoElement.setAttribute('playsinline', 'true');
      videoElement.setAttribute('controlsList', 'nodownload noplaybackrate');
      videoElement.setAttribute('disablePictureInPicture', 'true');
      videoElement.addEventListener('contextmenu', (event) => event.preventDefault());
      containerRef.current.appendChild(videoElement);

      playerRef.current = videojs(videoElement, {
        controls: true,
        fluid: true,
        responsive: true,
        preload: 'metadata',
        playbackRates: [],
        controlBar: {
          pictureInPictureToggle: false,
          fullscreenToggle: true,
        },
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
    <div
      className="group overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#030305] p-1 shadow-[0_24px_80px_rgba(0,0,0,0.55)] ring-1 ring-white/[0.03]"
      onContextMenu={preventContextMenu}
    >
      <div className="overflow-hidden rounded-[1.45rem] bg-black [&_.video-js]:min-h-[240px] [&_.video-js]:bg-black [&_.video-js]:font-sans [&_.video-js]:text-white [&_.vjs-big-play-button]:left-1/2 [&_.vjs-big-play-button]:top-1/2 [&_.vjs-big-play-button]:h-16 [&_.vjs-big-play-button]:w-16 [&_.vjs-big-play-button]:-translate-x-1/2 [&_.vjs-big-play-button]:-translate-y-1/2 [&_.vjs-big-play-button]:rounded-full [&_.vjs-big-play-button]:border [&_.vjs-big-play-button]:border-primary/40 [&_.vjs-big-play-button]:bg-primary [&_.vjs-big-play-button]:text-white [&_.vjs-big-play-button]:shadow-[0_18px_60px_rgba(0,0,0,0.45)] [&_.vjs-big-play-button]:backdrop-blur-xl [&_.vjs-big-play-button]:transition [&_.vjs-big-play-button]:duration-200 [&_.vjs-big-play-button:hover]:scale-105 [&_.vjs-big-play-button:hover]:bg-primary/90 [&_.vjs-control-bar]:mx-3 [&_.vjs-control-bar]:mb-3 [&_.vjs-control-bar]:h-11 [&_.vjs-control-bar]:rounded-2xl [&_.vjs-control-bar]:border [&_.vjs-control-bar]:border-white/10 [&_.vjs-control-bar]:bg-black/65 [&_.vjs-control-bar]:px-2 [&_.vjs-control-bar]:backdrop-blur-xl [&_.vjs-control]:text-white/80 [&_.vjs-control:hover]:text-white [&_.vjs-play-progress]:bg-primary [&_.vjs-slider]:bg-white/15 [&_.vjs-load-progress]:bg-white/20 [&_.vjs-volume-level]:bg-primary [&_.vjs-time-control]:text-xs [&_.vjs-time-control]:font-medium [&_.vjs-time-control]:text-white/65 [&_.vjs-menu-button-popup_.vjs-menu]:hidden [&_video]:select-none">
        <div ref={containerRef} data-vjs-player />
      </div>
    </div>
  );
}
