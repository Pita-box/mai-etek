'use client';

import { useState, useTransition, useRef, useCallback, useEffect } from 'react';
import { ArrowUp, Loader2, Mic, Paperclip, Reply, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { uploadChatMedia } from '@/actions/chat';
import { MediaPreview } from './MediaPreview';
import { VoiceRecorder } from './VoiceRecorder';
import type { ChatSocket } from '@/lib/socket';
import type { ChatMessageItem } from '@/types/chat';

type ChatComposerProps = {
  onSendMessage: (text: string, attachment?: { type: 'image' | 'video' | 'voice'; url: string; thumbnailUrl?: string | null }, replyToMessageId?: string | null) => Promise<string | null | undefined>;
  replyToMessage?: ChatMessageItem | null;
  onCancelReply?: () => void;
  socket?: ChatSocket | null;
};

function getReplyPreview(message: ChatMessageItem) {
  if (message.text?.trim()) return message.text.trim();
  if (message.type === 'image') return 'Fotka';
  if (message.type === 'video') return 'Video';
  if (message.type === 'voice') return 'Hlasová zpráva';
  return 'Zpráva';
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  return Boolean(
    target.closest('input, textarea, select, button, a, [contenteditable="true"], [role="button"]')
  );
}

function getVideoThumbnailFileName(fileName: string) {
  const extensionIndex = fileName.lastIndexOf('.');
  const baseName = extensionIndex > 0 ? fileName.slice(0, extensionIndex) : fileName;
  return `${baseName || 'video'}-thumbnail.jpg`;
}

function waitForVideoMetadata(video: HTMLVideoElement) {
  return new Promise<void>((resolve, reject) => {
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      resolve();
      return;
    }

    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('Video thumbnail timeout'));
    }, 10000);

    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('error', handleError);
    };

    const handleLoadedMetadata = () => {
      cleanup();
      resolve();
    };

    const handleError = () => {
      cleanup();
      reject(new Error('Video thumbnail load failed'));
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('error', handleError);
    video.load();
  });
}

function waitForVideoSeek(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve, reject) => {
    if (Math.abs(video.currentTime - time) < 0.02 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      window.requestAnimationFrame(() => resolve());
      return;
    }

    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('Video thumbnail seek timeout'));
    }, 8000);

    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener('loadeddata', handleFrameReady);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('error', handleError);
    };

    const resolveReady = () => {
      cleanup();
      window.requestAnimationFrame(() => resolve());
    };

    const handleFrameReady = () => {
      resolveReady();
    };

    const handleSeeked = () => {
      resolveReady();
    };

    const handleError = () => {
      cleanup();
      reject(new Error('Video thumbnail seek failed'));
    };

    video.addEventListener('loadeddata', handleFrameReady);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('error', handleError);

    try {
      video.currentTime = time;

      if (Math.abs(video.currentTime - time) < 0.02 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        resolveReady();
      }
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

function getVideoThumbnailTimes(duration: number) {
  if (!Number.isFinite(duration) || duration <= 0) {
    return [0];
  }

  const maxTime = Math.max(0, duration - 0.05);
  const candidates = [
    Math.min(0.2, maxTime),
    Math.min(0.75, maxTime),
    Math.min(1.5, maxTime),
    duration * 0.25,
    duration * 0.5,
    duration * 0.75,
  ].map((time) => Math.min(maxTime, Math.max(0, time)));

  return Array.from(new Set(candidates.map((time) => Number(time.toFixed(2)))));
}

function isLikelyBlackFrame(context: CanvasRenderingContext2D, width: number, height: number) {
  const sampleStep = Math.max(1, Math.floor(Math.min(width, height) / 80));
  const imageData = context.getImageData(0, 0, width, height).data;
  let brightnessTotal = 0;
  let brightPixels = 0;
  let samples = 0;

  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const index = (y * width + x) * 4;
      const brightness = (imageData[index] + imageData[index + 1] + imageData[index + 2]) / 3;
      brightnessTotal += brightness;
      if (brightness > 40) brightPixels += 1;
      samples += 1;
    }
  }

  const averageBrightness = brightnessTotal / Math.max(1, samples);
  const brightRatio = brightPixels / Math.max(1, samples);

  return averageBrightness < 18 && brightRatio < 0.015;
}

function canvasToJpegBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) resolve(value);
      else reject(new Error('Video thumbnail export failed'));
    }, 'image/jpeg', 0.82);
  });
}

async function createVideoThumbnail(videoFile: File, fileName: string) {
  const objectUrl = URL.createObjectURL(videoFile);

  try {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.src = objectUrl;

    await waitForVideoMetadata(video);

    if (!video.videoWidth || !video.videoHeight) {
      throw new Error('Video thumbnail dimensions missing');
    }

    const maxSide = 720;
    const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Video thumbnail canvas unavailable');
    }

    let fallbackBlob: Blob | null = null;

    for (const time of getVideoThumbnailTimes(video.duration)) {
      await waitForVideoSeek(video, time);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await canvasToJpegBlob(canvas);
      const isBlackFrame = isLikelyBlackFrame(context, canvas.width, canvas.height);
      fallbackBlob = blob;

      if (!isBlackFrame) {
        return new File([blob], getVideoThumbnailFileName(fileName), { type: 'image/jpeg' });
      }
    }

    if (!fallbackBlob) {
      throw new Error('Video thumbnail export failed');
    }

    return new File([fallbackBlob], getVideoThumbnailFileName(fileName), { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function ChatComposer({ onSendMessage, replyToMessage = null, onCancelReply, socket }: ChatComposerProps) {
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const emitTyping = useCallback(() => {
    if (!socket?.connected) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit('message:typing');
    }

    // Reset timeout – stop typing po 3s neaktivity
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (isTypingRef.current) {
        isTypingRef.current = false;
        socket.emit('message:stop-typing');
      }
    }, 3000);
  }, [socket]);

  const stopTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (isTypingRef.current && socket?.connected) {
      isTypingRef.current = false;
      socket.emit('message:stop-typing');
    }
  }, [socket]);

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(event.target.value);
    emitTyping();
  };

  useEffect(() => {
    if (isRecording || isPending || isUploading) return;

    const handleGlobalTyping = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.isComposing ||
        event.key.length !== 1 ||
        isTypingTarget(event.target)
      ) {
        return;
      }

      event.preventDefault();
      const typedCharacter = event.key;
      const textarea = textareaRef.current;

      textarea?.focus();
      setMessage((currentMessage) => {
        const nextMessage = `${currentMessage}${typedCharacter}`;

        window.requestAnimationFrame(() => {
          const nextTextarea = textareaRef.current;
          if (!nextTextarea) return;

          nextTextarea.selectionStart = nextMessage.length;
          nextTextarea.selectionEnd = nextMessage.length;
        });

        return nextMessage;
      });
      emitTyping();
    };

    document.addEventListener('keydown', handleGlobalTyping);
    return () => document.removeEventListener('keydown', handleGlobalTyping);
  }, [emitTyping, isPending, isRecording, isUploading]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.size > 50 * 1024 * 1024) {
      setError('Soubor je příliš velký (max 50 MB)');
      return;
    }

    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setError(null);
  };

  const removeAttachment = () => {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadAndSend = async (mediaFile: File | Blob | null, text: string = '') => {
    setError(null);
    stopTyping();
    setIsUploading(true);

    try {
      let attachmentUrl: string | null = null;
      let thumbnailUrl: string | null = null;
      let mediaType: 'image' | 'video' | 'voice' = 'image';

      if (mediaFile) {
        if (mediaFile.type.startsWith('video/')) mediaType = 'video';
        else if (mediaFile.type.startsWith('audio/')) mediaType = 'voice';
        
        const formData = new FormData();
        const fileName = mediaFile instanceof File ? mediaFile.name : `voice-message.${mediaFile.type.includes('mp4') ? 'mp4' : 'webm'}`;
        formData.append('file', mediaFile, fileName);

        if (mediaType === 'video' && mediaFile instanceof File) {
          const thumbnailFile = await createVideoThumbnail(mediaFile, fileName);
          formData.append('thumbnail', thumbnailFile, thumbnailFile.name);
        }

        const data = await uploadChatMedia(formData);

        if (data.error || !data.url) {
          throw new Error(data.error || 'Nahrávání selhalo');
        }

        attachmentUrl = data.url;
        thumbnailUrl = data.thumbnailUrl ?? null;
      }

      startTransition(async () => {
        const result = await onSendMessage(
          text, 
          attachmentUrl ? { type: mediaType, url: attachmentUrl, thumbnailUrl } : undefined,
          replyToMessage?.id ?? null,
        );
        if (result) {
          setError(result);
          setIsUploading(false);
          return;
        }

        setMessage('');
        removeAttachment();
        setIsRecording(false);
        setIsUploading(false);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při odesílání');
      setIsUploading(false);
    }
  };

  const handleSubmit = () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage && !file) {
      return;
    }
    uploadAndSend(file, trimmedMessage);
  };

  const handleVoiceRecordingComplete = (blob: Blob) => {
    uploadAndSend(blob, '');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter') return;

    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const target = event.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const nextMessage = `${message.slice(0, start)}\n${message.slice(end)}`;
      setMessage(nextMessage);
      emitTyping();

      window.requestAnimationFrame(() => {
        target.selectionStart = start + 1;
        target.selectionEnd = start + 1;
      });
      return;
    }

    event.preventDefault();
    handleSubmit();
  };

  return (
    <div className="border-t border-white/10 bg-black/50 p-4">
      <div className="rounded-2xl border border-white/10 bg-black/40 p-3 backdrop-blur-xl">
        {replyToMessage ? (
          <div className="mb-3 flex items-start justify-between gap-3 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                <Reply className="h-3.5 w-3.5" />
                <span>Odpověď pro {replyToMessage.sender.fullName}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-zinc-300">
                {getReplyPreview(replyToMessage)}
              </p>
            </div>
            {onCancelReply ? (
              <button
                type="button"
                onClick={onCancelReply}
                className="shrink-0 cursor-pointer rounded-full border border-white/10 p-1 text-zinc-400 transition-all duration-400 hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
                aria-label="Zrušit odpověď"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        ) : null}

        {isRecording ? (
          <div className="flex h-[80px] items-center justify-center">
            <VoiceRecorder 
              onRecordingComplete={handleVoiceRecordingComplete} 
              onCancel={() => setIsRecording(false)} 
            />
          </div>
        ) : (
          <Textarea
            id="chat-message-input"
            ref={textareaRef}
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Napiš zprávu… (Enter odešle, Ctrl+Enter nový řádek)"
            className="min-h-[80px] resize-none border-0 bg-transparent px-1 py-1 text-sm leading-6 text-white shadow-none placeholder:text-muted-foreground focus-visible:ring-0"
            disabled={isPending || isUploading}
          />
        )}

        {file && previewUrl && (
          <div className="mb-2 px-1">
            <MediaPreview file={file} previewUrl={previewUrl} onRemove={removeAttachment} />
          </div>
        )}

        <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {!isRecording && (
              <>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept="image/*,video/mp4,video/webm"
                />
                <button
                  id="chat-attachment-button"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isPending || isUploading}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-muted-foreground transition-all duration-400 hover:border-primary/30 hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                  title="Přidat fotku nebo video"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Příloha</span>
                </button>

                <button
                  id="chat-voice-button"
                  type="button"
                  onClick={() => setIsRecording(true)}
                  disabled={isPending || isUploading || message.length > 0}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-muted-foreground transition-all duration-400 hover:border-primary/30 hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                  title="Nahrát hlasovou zprávu"
                >
                  <Mic className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Hlas</span>
                </button>
              </>
            )}
          </div>

          <Button
            id="chat-send-button"
            type="button"
            onClick={handleSubmit}
            disabled={isPending || isUploading || (!message.trim() && !file)}
            className="h-9 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_0_15px_rgba(255,31,87,0.22)] transition-all duration-400 hover:bg-primary/90 hover:shadow-[0_0_25px_rgba(255,31,87,0.38)] disabled:opacity-40"
          >
            {isPending || isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            Odeslat
          </Button>
        </div>
      </div>

      {error ? <p className="mt-2 px-1 text-sm text-rose-300">{error}</p> : null}
    </div>
  );
}
