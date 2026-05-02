export type GalleryMediaType = "image" | "video";
export type GalleryViewerRole = "dom" | "sub";
export type GalleryFilter = "all" | "image" | "video" | "favorite";

export interface GalleryMedia {
  id: string;
  uploaded_by: string;
  media_type: GalleryMediaType;
  original_filename: string;
  display_filename: string;
  source_drive_file_id: string | null;
  display_drive_file_id: string;
  display_drive_web_view_link: string | null;
  drive_folder_id: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  display_size_bytes: number | null;
  thumbnail_drive_file_id: string | null;
  thumbnail_original_filename: string | null;
  thumbnail_mime_type: string | null;
  thumbnail_size_bytes: number | null;
  width: number | null;
  height: number | null;
  aspect_ratio: number | null;
  is_favorite: boolean;
  captured_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  uploader_name?: string | null;
}
