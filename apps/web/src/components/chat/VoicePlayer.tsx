import { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type VoicePlayerProps = {
  src: string;
  isOwn?: boolean;
};

export function VoicePlayer({ src, isOwn = false }: VoicePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      setProgress((audio.currentTime / audio.duration) * 100);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, []);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || isNaN(seconds) || seconds === Infinity) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className={cn(
      "flex items-center gap-3 rounded-full px-3 py-1.5 w-[200px]",
      isOwn ? "border border-primary/25 bg-primary/10" : "bg-black/30 border border-white/10"
    )}>
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={togglePlay}
        className={cn(
          "h-8 w-8 shrink-0 rounded-full p-0 transition-colors",
          isOwn ? "bg-primary/20 text-primary hover:bg-primary/30" : "bg-white/10 text-slate-200 hover:bg-white/20"
        )}
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
      </Button>

      <div className="flex flex-1 flex-col gap-1 overflow-hidden">
        {/* Progress bar (fake waveform) */}
        <div className="h-1.5 w-full rounded-full bg-black/40 overflow-hidden">
          <div 
            className={cn("h-full transition-all duration-100", isOwn ? "bg-primary" : "bg-slate-300")}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className={cn("text-[9px] font-medium tabular-nums", isOwn ? "text-primary/70" : "text-slate-400")}>
            {formatDuration(audioRef.current?.currentTime || 0)}
          </span>
          <span className={cn("text-[9px] font-medium tabular-nums", isOwn ? "text-primary/70" : "text-slate-400")}>
            {formatDuration(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}
