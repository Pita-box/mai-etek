-- Phase 3 Gallery: single masonry media feed backed by Google Drive.

CREATE TABLE IF NOT EXISTS public.gallery_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  original_filename TEXT NOT NULL CHECK (char_length(btrim(original_filename)) BETWEEN 1 AND 255),
  display_filename TEXT NOT NULL CHECK (char_length(btrim(display_filename)) BETWEEN 1 AND 255),
  source_drive_file_id TEXT,
  display_drive_file_id TEXT NOT NULL CHECK (char_length(btrim(display_drive_file_id)) > 0),
  display_drive_web_view_link TEXT,
  drive_folder_id TEXT,
  mime_type TEXT,
  size_bytes BIGINT CHECK (size_bytes IS NULL OR size_bytes >= 0),
  display_size_bytes BIGINT CHECK (display_size_bytes IS NULL OR display_size_bytes >= 0),
  thumbnail_drive_file_id TEXT,
  thumbnail_original_filename TEXT,
  thumbnail_mime_type TEXT,
  thumbnail_size_bytes BIGINT CHECK (thumbnail_size_bytes IS NULL OR thumbnail_size_bytes >= 0),
  width INTEGER CHECK (width IS NULL OR width > 0),
  height INTEGER CHECK (height IS NULL OR height > 0),
  aspect_ratio NUMERIC CHECK (aspect_ratio IS NULL OR aspect_ratio > 0),
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  captured_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS gallery_media_feed_idx
  ON public.gallery_media(created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS gallery_media_type_idx
  ON public.gallery_media(media_type, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS gallery_media_favorite_idx
  ON public.gallery_media(is_favorite, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS gallery_media_uploaded_by_idx
  ON public.gallery_media(uploaded_by, created_at DESC);

CREATE INDEX IF NOT EXISTS gallery_media_display_drive_file_idx
  ON public.gallery_media(display_drive_file_id);

CREATE INDEX IF NOT EXISTS gallery_media_source_drive_file_idx
  ON public.gallery_media(source_drive_file_id)
  WHERE source_drive_file_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS gallery_media_thumbnail_drive_file_idx
  ON public.gallery_media(thumbnail_drive_file_id)
  WHERE thumbnail_drive_file_id IS NOT NULL;

DROP TRIGGER IF EXISTS on_gallery_media_updated ON public.gallery_media;
CREATE TRIGGER on_gallery_media_updated
  BEFORE UPDATE ON public.gallery_media
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

ALTER TABLE public.gallery_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read visible gallery media" ON public.gallery_media;
DROP POLICY IF EXISTS "Authenticated users can upload gallery media" ON public.gallery_media;
DROP POLICY IF EXISTS "DOM can update gallery media" ON public.gallery_media;
DROP POLICY IF EXISTS "DOM can delete gallery media" ON public.gallery_media;

CREATE POLICY "Authenticated users can read visible gallery media"
  ON public.gallery_media
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "Authenticated users can upload gallery media"
  ON public.gallery_media
  FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('dom', 'sub')
    )
  );

CREATE POLICY "DOM can update gallery media"
  ON public.gallery_media
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'dom'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'dom'
    )
  );

CREATE POLICY "DOM can delete gallery media"
  ON public.gallery_media
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'dom'
    )
  );

REVOKE ALL ON TABLE public.gallery_media FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gallery_media TO authenticated;

NOTIFY pgrst, 'reload schema';
