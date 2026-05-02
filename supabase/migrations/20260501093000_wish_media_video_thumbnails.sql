-- Store generated thumbnails for wish videos uploaded to Google Drive.

ALTER TABLE public.wish_media
  ADD COLUMN IF NOT EXISTS thumbnail_drive_file_id TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_original_filename TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_mime_type TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_size_bytes BIGINT CHECK (thumbnail_size_bytes IS NULL OR thumbnail_size_bytes >= 0);

CREATE INDEX IF NOT EXISTS wish_media_thumbnail_drive_file_idx
  ON public.wish_media(thumbnail_drive_file_id)
  WHERE thumbnail_drive_file_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
