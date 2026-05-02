"use client";

import {
  ChangeEvent,
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  UploadCloud,
  Video,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { uploadGalleryMedia } from "@/actions/gallery";
import {
  formatGalleryMediaBytes,
  GALLERY_MEDIA_BATCH_MAX_BYTES,
  GALLERY_MEDIA_BATCH_MAX_LABEL,
  GALLERY_MEDIA_MAX_BYTES,
  getGalleryMediaBatchSizeError,
  getGalleryMediaSizeError,
  getGalleryMediaType,
} from "@/lib/gallery/media-limits";

type QueuedFileStatus = "ready" | "uploading" | "uploaded" | "error";

type QueuedFile = {
  id: string;
  file: File;
  status: QueuedFileStatus;
  error?: string;
};

export type GalleryUploadHandle = {
  enqueueFiles: (files: File[]) => void;
  openFilePicker: () => void;
};

const statusLabel: Record<QueuedFileStatus, string> = {
  ready: "Připraveno",
  uploading: "Zpracovávám",
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
  if (!getGalleryMediaType(file)) return "Nahraj fotku nebo video.";
  if (file.size > GALLERY_MEDIA_MAX_BYTES) return getGalleryMediaSizeError();
  return null;
}

export const GalleryUpload = forwardRef<GalleryUploadHandle>(
  function GalleryUpload(_props, ref) {
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [files, setFiles] = useState<QueuedFile[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({
      current: 0,
      total: 0,
    });

    const totalBytes = useMemo(
      () => files.reduce((sum, item) => sum + item.file.size, 0),
      [files],
    );
    const batchTooLarge = totalBytes > GALLERY_MEDIA_BATCH_MAX_BYTES;
    const invalidFileIds = useMemo(
      () =>
        new Set(
          files
            .filter((item) => getFileError(item.file))
            .map((item) => item.id),
        ),
      [files],
    );
    const hasInvalidFiles = invalidFileIds.size > 0;
    const sizeRatio = Math.min(
      (totalBytes / GALLERY_MEDIA_BATCH_MAX_BYTES) * 100,
      100,
    );
    const canUpload =
      files.length > 0 && !batchTooLarge && !hasInvalidFiles && !isUploading;

    const appendFiles = useCallback((nextFiles: File[]) => {
      if (nextFiles.length === 0) return;
      setSuccess(null);
      setError(null);
      setFiles((current) => [...current, ...nextFiles.map(createQueuedFile)]);
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        enqueueFiles(nextFiles: File[]) {
          if (isUploading) {
            setError("Počkej, až doběhne aktuální nahrávání.");
            return;
          }

          appendFiles(nextFiles);
        },
        openFilePicker() {
          if (isUploading) {
            setError("Počkej, až doběhne aktuální nahrávání.");
            return;
          }

          inputRef.current?.click();
        },
      }),
      [appendFiles, isUploading],
    );

    const selectFiles = (event: ChangeEvent<HTMLInputElement>) => {
      appendFiles(Array.from(event.target.files || []));
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
        if (batchTooLarge) setError(getGalleryMediaBatchSizeError());
        if (hasInvalidFiles) setError("Některé soubory nesplňují požadavky.");
        return;
      }

      setIsUploading(true);
      setError(null);
      setSuccess(null);
      setUploadProgress({ current: 0, total: files.length });

      let uploadedCount = 0;

      for (const [index, item] of files.entries()) {
        setUploadProgress({ current: index + 1, total: files.length });
        setFiles((current) =>
          current.map((entry) =>
            entry.id === item.id
              ? { ...entry, status: "uploading", error: undefined }
              : entry,
          ),
        );

        const formData = new FormData();
        formData.set("file", item.file);

        const result = await uploadGalleryMedia(formData);
        if (result?.error) {
          setFiles((current) =>
            current.map((entry) =>
              entry.id === item.id
                ? { ...entry, status: "error", error: result.error }
                : entry,
            ),
          );
          continue;
        }

        uploadedCount += 1;
        setFiles((current) =>
          current.map((entry) =>
            entry.id === item.id
              ? { ...entry, status: "uploaded", error: undefined }
              : entry,
          ),
        );
      }

      setIsUploading(false);
      setUploadProgress({ current: 0, total: 0 });

      if (uploadedCount > 0) {
        setFiles((current) =>
          current.filter((entry) => entry.status === "error"),
        );
        setSuccess(
          uploadedCount === 1
            ? "Médium bylo nahráno."
            : `${uploadedCount} médií bylo nahráno.`,
        );
        router.refresh();
      }

      if (uploadedCount < files.length) {
        setError("Některá média se nepodařilo nahrát.");
      }
    };

    const aggregateBarClass = batchTooLarge
      ? "bg-rose-400"
      : sizeRatio > 80
        ? "bg-amber-300"
        : "bg-primary";

    return (
      <>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={selectFiles}
        />

        {files.length ? (
          <section className="rounded-3xl border border-white/10 bg-white/[0.045] p-4 backdrop-blur-xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="rounded-2xl bg-primary/15 p-3 text-primary ring-1 ring-primary/20">
                  <UploadCloud className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-white">
                    Fronta nahrávání
                  </h2>
                  <p className="text-xs text-zinc-500">
                    Watermark se přidá automaticky · limit{" "}
                    {GALLERY_MEDIA_BATCH_MAX_LABEL}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={clearQueue}
                disabled={isUploading}
                className="cursor-pointer rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Vyčistit
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex flex-col gap-2 text-xs text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Vybráno {files.length}{" "}
                  {files.length === 1
                    ? "soubor"
                    : files.length < 5
                      ? "soubory"
                      : "souborů"}{" "}
                  · {formatGalleryMediaBytes(totalBytes)} /{" "}
                  {GALLERY_MEDIA_BATCH_MAX_LABEL}
                </span>
                {isUploading ? (
                  <span className="text-primary">
                    Zpracovávám {uploadProgress.current}/{uploadProgress.total}
                  </span>
                ) : null}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${aggregateBarClass}`}
                  style={{ width: `${sizeRatio}%` }}
                />
              </div>

              <div className="grid gap-2">
                {files.map((item) => {
                  const mediaType = getGalleryMediaType(item.file);
                  const Icon = mediaType === "video" ? Video : ImageIcon;
                  const fileError = getFileError(item.file) || item.error;
                  const isInvalid = invalidFileIds.has(item.id);

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 border-t border-white/10 py-2 text-sm text-zinc-300 first:border-t-0"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Icon className="h-4 w-4 shrink-0 text-zinc-500" />
                        <div className="min-w-0">
                          <p className="truncate text-white">
                            {item.file.name}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {formatGalleryMediaBytes(item.file.size)}
                          </p>
                          {fileError ? (
                            <p className="mt-1 text-xs text-rose-300">
                              {fileError}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === "uploaded" ? "bg-emerald-400/15 text-emerald-200" : item.status === "error" || isInvalid ? "bg-rose-400/15 text-rose-200" : item.status === "uploading" ? "bg-primary/15 text-primary" : "bg-white/10 text-zinc-300"}`}
                        >
                          {item.status === "uploading" ? (
                            <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                          ) : null}
                          {item.status === "uploaded" ? (
                            <CheckCircle2 className="mr-1 inline h-3 w-3" />
                          ) : null}
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

            {batchTooLarge ? (
              <p className="mt-3 text-sm text-rose-300">
                {getGalleryMediaBatchSizeError()}
              </p>
            ) : null}

            <button
              type="button"
              disabled={!canUpload}
              onClick={submit}
              className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-bold text-white transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UploadCloud className="h-4 w-4" />
              )}
              {isUploading
                ? `Zpracovávám ${uploadProgress.current}/${uploadProgress.total}`
                : files.length > 1
                  ? `Nahrát ${files.length} souborů`
                  : "Nahrát"}
            </button>

            {error ? (
              <p className="mt-3 text-sm text-rose-300">{error}</p>
            ) : null}
            {success ? (
              <p className="mt-3 text-sm text-emerald-300">{success}</p>
            ) : null}
          </section>
        ) : null}
      </>
    );
  },
);
