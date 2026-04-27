'use client';

import { ChangeEvent, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Image as ImageIcon, Loader2, UploadCloud, Video, X } from 'lucide-react';
import { uploadTaskMedia } from '@/actions/tasks';
import {
  formatTaskMediaBytes,
  getTaskMediaBatchSizeError,
  getTaskMediaSizeError,
  TASK_MEDIA_BATCH_MAX_BYTES,
  TASK_MEDIA_BATCH_MAX_LABEL,
  TASK_MEDIA_MAX_BYTES,
} from '@/lib/tasks/media-limits';

type TaskMediaUploadProps = {
  taskId: string;
  mediaType: 'image' | 'video';
};

type QueuedFileStatus = 'ready' | 'uploading' | 'uploaded' | 'error';

type QueuedFile = {
  id: string;
  file: File;
  status: QueuedFileStatus;
  error?: string;
};

const acceptMap = {
  image: 'image/*',
  video: 'video/*',
};

const statusLabel: Record<QueuedFileStatus, string> = {
  ready: 'Připraveno',
  uploading: 'Nahrávám',
  uploaded: 'Nahráno',
  error: 'Chyba',
};

function createQueuedFile(file: File): QueuedFile {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
    file,
    status: 'ready',
  };
}

export function TaskMediaUpload({ taskId, mediaType }: TaskMediaUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const Icon = mediaType === 'image' ? ImageIcon : Video;

  const totalBytes = useMemo(() => files.reduce((sum, item) => sum + item.file.size, 0), [files]);
  const batchTooLarge = totalBytes > TASK_MEDIA_BATCH_MAX_BYTES;
  const invalidFileIds = useMemo(
    () =>
      new Set(
        files
          .filter((item) => item.file.size > TASK_MEDIA_MAX_BYTES[mediaType] || !item.file.type.startsWith(`${mediaType}/`))
          .map((item) => item.id)
      ),
    [files, mediaType]
  );
  const hasInvalidFiles = invalidFileIds.size > 0;
  const sizeRatio = Math.min((totalBytes / TASK_MEDIA_BATCH_MAX_BYTES) * 100, 100);
  const canUpload = files.length > 0 && !batchTooLarge && !hasInvalidFiles && !isUploading;

  const selectFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFiles = Array.from(event.target.files || []).map(createQueuedFile);
    setSuccess(null);
    setError(null);
    setFiles((current) => [...current, ...nextFiles]);
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeFile = (id: string) => {
    if (isUploading) return;
    setFiles((current) => current.filter((item) => item.id !== id));
    setSuccess(null);
  };

  const clearQueue = () => {
    if (isUploading) return;
    setFiles([]);
    setError(null);
    setSuccess(null);
  };

  const submit = async () => {
    if (!canUpload) {
      if (batchTooLarge) setError(getTaskMediaBatchSizeError());
      if (hasInvalidFiles) setError('Některé soubory nesplňují požadavky. Odeber je a zkus to znovu.');
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccess(null);
    setUploadProgress({ current: 0, total: files.length });

    let uploadedCount = 0;

    for (const [index, item] of files.entries()) {
      setUploadProgress({ current: index + 1, total: files.length });
      setFiles((current) => current.map((entry) => (entry.id === item.id ? { ...entry, status: 'uploading', error: undefined } : entry)));

      const formData = new FormData();
      formData.set('file', item.file);
      formData.set('mediaType', mediaType);

      const result = await uploadTaskMedia(taskId, formData);
      if (result?.error) {
        setFiles((current) => current.map((entry) => (entry.id === item.id ? { ...entry, status: 'error', error: result.error } : entry)));
        continue;
      }

      uploadedCount += 1;
      setFiles((current) => current.map((entry) => (entry.id === item.id ? { ...entry, status: 'uploaded', error: undefined } : entry)));
    }

    setIsUploading(false);
    setUploadProgress({ current: 0, total: 0 });

    if (uploadedCount > 0) {
      setFiles((current) => current.filter((entry) => entry.status === 'error'));
      setSuccess(uploadedCount === 1 ? 'Soubor byl nahrán a uložen k úkolu.' : `${uploadedCount} souborů bylo nahráno a uloženo k úkolu.`);
    }

    if (uploadedCount < files.length) {
      setError('Některé soubory se nepodařilo nahrát. Zkontroluj chyby u souborů.');
    }
  };

  const aggregateBarClass = batchTooLarge ? 'bg-rose-400' : sizeRatio > 80 ? 'bg-amber-300' : 'bg-primary';

  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-[#0F0F23]/70 p-4 shadow-[0_0_35px_rgba(225,29,72,0.08)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/15 p-3 text-primary ring-1 ring-primary/20">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-bold text-white">Nahrát {mediaType === 'image' ? 'fotky' : 'videa'}</h4>
            <p className="text-xs text-zinc-500 py-2">Celkový jednoho nahrávání nesmí být větší než max. {TASK_MEDIA_BATCH_MAX_LABEL}.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {files.length ? (
            <button
              id={`task-media-clear-${mediaType}`}
              type="button"
              onClick={clearQueue}
              disabled={isUploading}
              className="cursor-pointer rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Vyčistit
            </button>
          ) : null}
          <button
            id={`task-media-pick-${mediaType}`}
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            className="cursor-pointer rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Vybrat soubory
          </button>
        </div>
      </div>

      <input ref={inputRef} type="file" multiple accept={acceptMap[mediaType]} className="hidden" onChange={selectFiles} />

      {files.length ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/35 p-3">
          <div className="mb-3 flex flex-col gap-2 text-xs text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Vybráno {files.length} {files.length === 1 ? 'soubor' : files.length < 5 ? 'soubory' : 'souborů'} · {formatTaskMediaBytes(totalBytes)} / {TASK_MEDIA_BATCH_MAX_LABEL}
            </span>
            {isUploading ? <span className="text-primary">Nahrávám {uploadProgress.current}/{uploadProgress.total}</span> : null}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className={`h-full rounded-full transition-all duration-300 ${aggregateBarClass}`} style={{ width: `${sizeRatio}%` }} />
          </div>

          <div className="mt-3 space-y-2">
            {files.map((item) => {
              const isInvalid = invalidFileIds.has(item.id);
              const fileError = !item.file.type.startsWith(`${mediaType}/`)
                ? mediaType === 'image'
                  ? 'Vyber obrázek.'
                  : 'Vyber video.'
                : item.file.size > TASK_MEDIA_MAX_BYTES[mediaType]
                  ? getTaskMediaSizeError(mediaType)
                  : item.error;

              return (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-zinc-300">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="rounded-lg bg-white/5 p-2 text-zinc-400">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-white">{item.file.name}</p>
                      <p className="text-xs text-zinc-500">{formatTaskMediaBytes(item.file.size)}</p>
                      {fileError ? <p className="mt-1 text-xs text-rose-300">{fileError}</p> : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === 'uploaded' ? 'bg-emerald-400/15 text-emerald-200' : item.status === 'error' || isInvalid ? 'bg-rose-400/15 text-rose-200' : item.status === 'uploading' ? 'bg-primary/15 text-primary' : 'bg-white/10 text-zinc-300'}`}>
                      {item.status === 'uploading' ? <Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> : item.status === 'uploaded' ? <CheckCircle2 className="mr-1 inline h-3 w-3" /> : null}
                      {isInvalid ? 'Neplatné' : statusLabel[item.status]}
                    </span>
                    <button type="button" onClick={() => removeFile(item.id)} disabled={isUploading} className="cursor-pointer text-zinc-500 transition hover:text-white focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Odebrat soubor">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {batchTooLarge ? <p className="mt-3 text-sm text-rose-300">{getTaskMediaBatchSizeError()}</p> : null}

      <button
        id={`task-media-upload-${mediaType}`}
        type="button"
        disabled={!canUpload}
        onClick={submit}
        className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-bold text-white transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
        {isUploading ? `Nahrávám ${uploadProgress.current}/${uploadProgress.total}` : files.length > 1 ? `Nahrát ${files.length} souborů` : 'Nahrát'}
      </button>

      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
      {success ? <p className="mt-3 text-sm text-emerald-300">{success}</p> : null}
    </div>
  );
}
