export const WISH_MEDIA_MAX_BYTES = 300 * 1024 * 1024;
export const WISH_MEDIA_MAX_LABEL = "300 MB";
export const WISH_MEDIA_BATCH_MAX_BYTES = 300 * 1024 * 1024;
export const WISH_MEDIA_BATCH_MAX_LABEL = "300 MB";
export const WISH_MEDIA_THUMBNAIL_MAX_BYTES = 2 * 1024 * 1024;

export function formatWishMediaBytes(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  }

  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${bytes} B`;
}

export function getWishMediaSizeError() {
  return `Soubor je příliš velký. Maximální velikost je ${WISH_MEDIA_MAX_LABEL}.`;
}

export function getWishMediaBatchSizeError() {
  return `Vybrané soubory mají dohromady více než ${WISH_MEDIA_BATCH_MAX_LABEL}. Odeber některé soubory a zkus to znovu.`;
}

export function getWishMediaThumbnailSizeError() {
  return "Náhled videa je příliš velký.";
}

export function getWishMediaType(file: File) {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return null;
}
