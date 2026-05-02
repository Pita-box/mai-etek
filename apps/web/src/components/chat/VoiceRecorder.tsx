import { useState, useRef, useEffect } from 'react';
import { Mic, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';

type VoiceRecorderProps = {
  onRecordingComplete: (blob: Blob) => void;
  onCancel: () => void;
};

export function VoiceRecorder({ onRecordingComplete, onCancel }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/mp4',
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const type = mediaRecorder.mimeType;
        const blob = new Blob(chunksRef.current, { type });
        onRecordingComplete(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Nepodařilo se spustit nahrávání:', err);
      onCancel();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex items-center gap-3 rounded-full bg-rose-500/10 px-3 py-1.5 border border-rose-500/20">
      <div className="flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full bg-rose-500 ${isRecording ? 'animate-pulse' : ''}`} />
        <span className="text-xs font-medium tabular-nums text-rose-300">
          {formatDuration(duration)}
        </span>
      </div>

      {!isRecording ? (
        <Button
          type="button"
          onClick={startRecording}
          variant="ghost"
          size="sm"
          className="h-7 rounded-full bg-rose-500/20 px-3 text-xs text-rose-200 hover:bg-rose-500/30 hover:text-rose-100"
        >
          <Mic className="mr-1.5 h-3.5 w-3.5" /> Spustit
        </Button>
      ) : (
        <Button
          type="button"
          onClick={stopRecording}
          variant="ghost"
          size="sm"
          className="h-7 rounded-full bg-rose-500 px-3 text-xs text-rose-50 hover:bg-rose-400"
        >
          <Square className="mr-1.5 h-3.5 w-3.5" /> Zastavit
        </Button>
      )}

      <Button
        type="button"
        onClick={onCancel}
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-slate-400 hover:text-slate-200"
      >
        Zrušit
      </Button>
    </div>
  );
}
