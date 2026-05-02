export type WishStatus = "new" | "noted" | "planned" | "fulfilled" | "declined";
export type WishViewerRole = "dom" | "sub";
export type WishMediaType = "image" | "video";

export interface WishMedia {
  id: string;
  wish_id: string;
  uploaded_by: string;
  media_type: WishMediaType;
  original_filename: string;
  drive_file_id: string;
  drive_web_view_link: string | null;
  drive_folder_id: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  thumbnail_drive_file_id: string | null;
  thumbnail_original_filename: string | null;
  thumbnail_mime_type: string | null;
  thumbnail_size_bytes: number | null;
  created_at: string;
}

export interface Wish {
  id: string;
  created_by: string;
  title: string;
  description: string | null;
  category: string | null;
  intensity: number;
  status: WishStatus;
  fulfilled_at: string | null;
  created_at: string;
  updated_at: string;
  creator_name?: string | null;
  dom_note?: string | null;
  media: WishMedia[];
}
