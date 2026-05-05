import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type MediaPreviewProps = {
  file: File;
  previewUrl: string;
  onRemove: () => void;
};

export function MediaPreview({ file, previewUrl, onRemove }: MediaPreviewProps) {
  const isVideo = file.type.startsWith('video/');

  return (
    <div className="relative mb-2 inline-block h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/40">
      {isVideo ? (
        <video src={previewUrl} className="h-full w-full object-cover" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="Náhled přílohy" className="h-full w-full object-cover" />
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        aria-label="Odebrat přílohu"
        className="absolute right-1 top-1 h-5 w-5 rounded-full bg-black/60 p-0 text-white transition-colors hover:bg-rose-500/80"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
