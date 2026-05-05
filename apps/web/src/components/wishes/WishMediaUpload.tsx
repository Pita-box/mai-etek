"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";
import { CheckCircle2, Image as ImageIcon, Loader2, UploadCloud, Video, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { uploadWishMedia } from "@/actions/wishes";
import { useToast } from "@/components/shared/useToast";
import {
  formatWishMediaBytes,
  getWishMediaBatchSizeError,
  getWishMediaSizeError,
  getWishMediaType,
  WISH_MEDIA_BATCH_MAX_BYTES,
  WISH_MEDIA_BATCH_MAX_LABEL,
  WISH_MEDIA_MAX_BYTES,
} from "@/lib/wishes/media-limits";
import { createWishVideoThumbnail } from "@/lib/wishes/video-thumbnail";

type WishMediaUploadProps = {
  wishId: string;
};

type QueuedFileStatus = "ready" | "uploading" | "uploaded" | "error";

type QueuedFile = {
  id: string;
  file: File;
  status: QueuedFileStatus;
  error?: string;
};

const statusLabel: Record<QueuedFileStatus, string> = {
  ready: "Připraveno",
  uploading: "Nahrávám",
  uploaded: "Nahráno",
  error: "Chyba",
};

function createQueuedFile(file: File): QueuedFile {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
    file,
    status: "ready",
  };
}

function getFileError(file: File) {
  if (!getWishMediaType(file)) return "Nahraj fotku nebo video.";
  if (file.size > WISH_MEDIA_MAX_BYTES) return getWishMediaSizeError();
  return null;
}

export function WishMediaUpload({ wishId }: WishMediaUploadProps) {
  const router = useRouter();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

  const totalBytes = useMemo(() => files.reduce((sum, item) => sum + item.file.size, 0), [files]);
  const batchTooLarge = totalBytes > WISH_MEDIA_BATCH_MAX_BYTES;
  const invalidFileIds = useMemo(
    () => new Set(files.filter((item) => getFileError(item.file)).map((item) => item.id)),
    [files],
  );
  const hasInvalidFiles = invalidFileIds.size > 0;
  const sizeRatio = Math.min((totalBytes / WISH_MEDIA_BATCH_MAX_BYTES) * 100, 100);
  const canUpload = files.length > 0 && !batchTooLarge && !hasInvalidFiles && !isUploading;

  const selectFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFiles = Array.from(event.target.files || []).map(createQueuedFile);
    setSuccess(null);
    setError(null);
    setFiles((current) => [...current, ...nextFiles]);
    if (inputRef.current) inputRef.current.value = "";
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
      const validationError = batchTooLarge
        ? getWishMediaBatchSizeError()
        : "Některé soubory nesplňují požadavky.";
      setError(validationError);
      toast.error("Nahrávání se nepodařilo spustit.", validationError);
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccess(null);
    setUploadProgress({ current: 0, total: files.length });

    let uploadedCount = 0;

    for (const [index, item] of files.entries()) {
      setUploadProgress({ current: index + 1, total: files.length });
      setFiles((current) => current.map((entry) => (entry.id === item.id ? { ...entry, status: "uploading", error: undefined } : entry)));

      const formData = new FormData();
      formData.set("file", item.file);

      const mediaType = getWishMediaType(item.file);
      if (mediaType === "video") {
        try {
          const thumbnailFile = await createWishVideoThumbnail(item.file);
          formData.append("thumbnail", thumbnailFile, thumbnailFile.name);
        } catch {
          setFiles((current) => current.map((entry) => (
            entry.id === item.id
              ? { ...entry, status: "error", error: "Náhled videa se nepodařilo vytvořit." }
              : entry
          )));
          continue;
        }
      }

      const result = await uploadWishMedia(wishId, formData);
      if (result?.error) {
        setFiles((current) => current.map((entry) => (entry.id === item.id ? { ...entry, status: "error", error: result.error } : entry)));
        continue;
      }

      uploadedCount += 1;
      setFiles((current) => current.map((entry) => (entry.id === item.id ? { ...entry, status: "uploaded", error: undefined } : entry)));
    }

    setIsUploading(false);
    setUploadProgress({ current: 0, total: 0 });

    if (uploadedCount > 0) {
      setFiles((current) => current.filter((entry) => entry.status === "error"));
      const successMessage =
        uploadedCount === 1
          ? "Soubor byl nahrán."
          : `${uploadedCount} souborů bylo nahráno.`;
      setSuccess(successMessage);
      toast.success(successMessage);
      router.refresh();
    }

    if (uploadedCount < files.length) {
      const uploadError = "Některé soubory se nepodařilo nahrát.";
      setError(uploadError);
      toast.error("Nahrávání nebylo kompletní.", uploadError);
    }
  };

  const aggregateBarClass = batchTooLarge ? "bg-rose-400" : sizeRatio > 80 ? "bg-amber-300" : "bg-primary";

  return (
    <div className="border-t border-white/10 pt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="rounded-xl bg-primary/15 p-2.5 text-primary ring-1 ring-primary/20">
            <UploadCloud className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-white">Ukázková média</p>
            <p className="text-xs text-zinc-500">Limit jednoho nahrávání {WISH_MEDIA_BATCH_MAX_LABEL}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {files.length ? (
            <button
              type="button"
              onClick={clearQueue}
              disabled={isUploading}
              className="cursor-pointer rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Vyčistit
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            className="cursor-pointer rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Vybrat soubory
          </button>
        </div>
      </div>

      <input ref={inputRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={selectFiles} />

      {files.length ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-col gap-2 text-xs text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Vybráno {files.length} {files.length === 1 ? "soubor" : files.length < 5 ? "soubory" : "souborů"} · {formatWishMediaBytes(totalBytes)} / {WISH_MEDIA_BATCH_MAX_LABEL}
            </span>
            {isUploading ? <span className="text-primary">Nahrávám {uploadProgress.current}/{uploadProgress.total}</span> : null}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className={`h-full rounded-full transition-all duration-300 ${aggregateBarClass}`} style={{ width: `${sizeRatio}%` }} />
          </div>

          <div className="grid gap-2">
            {files.map((item) => {
              const mediaType = getWishMediaType(item.file);
              const Icon = mediaType === "video" ? Video : ImageIcon;
              const fileError = getFileError(item.file) || item.error;
              const isInvalid = invalidFileIds.has(item.id);

              return (
                <div key={item.id} className="flex items-center justify-between gap-3 border-t border-white/10 py-2 text-sm text-zinc-300 first:border-t-0">
                  <div className="flex min-w-0 items-center gap-3">
                    <Icon className="h-4 w-4 shrink-0 text-zinc-500" />
                    <div className="min-w-0">
                      <p className="truncate text-white">{item.file.name}</p>
                      <p className="text-xs text-zinc-500">{formatWishMediaBytes(item.file.size)}</p>
                      {fileError ? <p className="mt-1 text-xs text-rose-300">{fileError}</p> : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === "uploaded" ? "bg-emerald-400/15 text-emerald-200" : item.status === "error" || isInvalid ? "bg-rose-400/15 text-rose-200" : item.status === "uploading" ? "bg-primary/15 text-primary" : "bg-white/10 text-zinc-300"}`}>
                      {item.status === "uploading" ? <Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> : null}
                      {item.status === "uploaded" ? <CheckCircle2 className="mr-1 inline h-3 w-3" /> : null}
                      {isInvalid ? "Neplatné" : statusLabel[item.status]}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(item.id)}
                      disabled={isUploading}
                      className="cursor-pointer text-zinc-500 transition hover:text-white focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Odebrat soubor"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {batchTooLarge ? <p className="mt-3 text-sm text-rose-300">{getWishMediaBatchSizeError()}</p> : null}

      {files.length ? (
        <button
          type="button"
          disabled={!canUpload}
          onClick={submit}
          className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-bold text-white transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
          {isUploading ? `Nahrávám ${uploadProgress.current}/${uploadProgress.total}` : files.length > 1 ? `Nahrát ${files.length} souborů` : "Nahrát"}
        </button>
      ) : null}

      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
      {success ? <p className="mt-3 text-sm text-emerald-300">{success}</p> : null}
    </div>
  );
}
