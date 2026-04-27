export const TASK_MEDIA_MAX_BYTES = {
  image: 15 * 1024 * 1024,
  video: 300 * 1024 * 1024,
} as const;

export const TASK_MEDIA_MAX_LABEL = {
  image: "15 MB",
  video: "300 MB",
} as const;

export const TASK_MEDIA_BATCH_MAX_BYTES = 300 * 1024 * 1024;
export const TASK_MEDIA_BATCH_MAX_LABEL = "300 MB";

export type TaskMediaType = keyof typeof TASK_MEDIA_MAX_BYTES;

export function formatTaskMediaBytes(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  }

  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${bytes} B`;
}

export function getTaskMediaSizeError(mediaType: TaskMediaType) {
  return mediaType === "image"
    ? `Fotka je příliš velká. Maximální velikost je ${TASK_MEDIA_MAX_LABEL.image}.`
    : `Video je příliš velké. Maximální velikost je ${TASK_MEDIA_MAX_LABEL.video}.`;
}

export function getTaskMediaBatchSizeError() {
  return `Vybrané soubory mají dohromady více než ${TASK_MEDIA_BATCH_MAX_LABEL}. Odeber některé soubory a zkus to znovu.`;
}
