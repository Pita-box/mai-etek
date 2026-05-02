import type { GalleryMediaType } from "@/types/gallery";

export const GALLERY_MEDIA_MAX_BYTES = 300 * 1024 * 1024;
export const GALLERY_MEDIA_MAX_LABEL = "300 MB";
export const GALLERY_MEDIA_BATCH_MAX_BYTES = 300 * 1024 * 1024;
export const GALLERY_MEDIA_BATCH_MAX_LABEL = "300 MB";

export function formatGalleryMediaBytes(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  }

  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${bytes} B`;
}

export function getGalleryMediaSizeError() {
  return `Soubor je příliš velký. Maximální velikost je ${GALLERY_MEDIA_MAX_LABEL}.`;
}

export function getGalleryMediaBatchSizeError() {
  return `Vybrané soubory mají dohromady více než ${GALLERY_MEDIA_BATCH_MAX_LABEL}. Odeber některé soubory a zkus to znovu.`;
}

export function getGalleryMediaType(file: File): GalleryMediaType | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return null;
}
