-- Phase 3 Wishes MVP: SUB wishes, DOM private notes, and Google Drive media metadata.

CREATE TABLE IF NOT EXISTS public.wishes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 255),
  description TEXT,
  category TEXT,
  intensity INTEGER NOT NULL DEFAULT 3 CHECK (intensity BETWEEN 1 AND 5),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'noted', 'planned', 'fulfilled', 'declined')),
  fulfilled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.wish_dom_notes (
  wish_id UUID PRIMARY KEY REFERENCES public.wishes(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.wish_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wish_id UUID NOT NULL REFERENCES public.wishes(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  original_filename TEXT NOT NULL CHECK (char_length(btrim(original_filename)) BETWEEN 1 AND 255),
  drive_file_id TEXT NOT NULL CHECK (char_length(btrim(drive_file_id)) > 0),
  drive_web_view_link TEXT,
  drive_folder_id TEXT,
  mime_type TEXT,
  size_bytes BIGINT CHECK (size_bytes IS NULL OR size_bytes >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS wishes_created_by_idx
  ON public.wishes(created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS wishes_status_idx
  ON public.wishes(status, created_at DESC);

CREATE INDEX IF NOT EXISTS wishes_category_idx
  ON public.wishes(category)
  WHERE category IS NOT NULL;

CREATE INDEX IF NOT EXISTS wishes_intensity_idx
  ON public.wishes(intensity);

CREATE INDEX IF NOT EXISTS wish_media_wish_created_idx
  ON public.wish_media(wish_id, created_at DESC);

CREATE INDEX IF NOT EXISTS wish_media_drive_file_idx
  ON public.wish_media(drive_file_id);

DROP TRIGGER IF EXISTS on_wishes_updated ON public.wishes;
CREATE TRIGGER on_wishes_updated
  BEFORE UPDATE ON public.wishes
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

DROP TRIGGER IF EXISTS on_wish_dom_notes_updated ON public.wish_dom_notes;
CREATE TRIGGER on_wish_dom_notes_updated
  BEFORE UPDATE ON public.wish_dom_notes
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.is_dom_for_user(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles viewer
    JOIN public.profiles target ON target.id = target_user_id
    WHERE viewer.id = auth.uid()
      AND viewer.role = 'dom'
      AND target.dom_id = viewer.id
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_wish(wish_owner_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT wish_owner_uuid = auth.uid()
    OR public.is_dom_for_user(wish_owner_uuid);
$$;

ALTER TABLE public.wishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wish_dom_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wish_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Wish participants can read wishes" ON public.wishes;
DROP POLICY IF EXISTS "SUB can create own wishes" ON public.wishes;
DROP POLICY IF EXISTS "SUB can delete own unlocked wishes" ON public.wishes;

CREATE POLICY "Wish participants can read wishes"
  ON public.wishes
  FOR SELECT
  TO authenticated
  USING (public.can_access_wish(created_by));

CREATE POLICY "SUB can create own wishes"
  ON public.wishes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'sub'
    )
  );

CREATE POLICY "SUB can delete own unlocked wishes"
  ON public.wishes
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    AND status IN ('new', 'noted')
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'sub'
    )
  );

DROP POLICY IF EXISTS "DOM can read paired wish notes" ON public.wish_dom_notes;
DROP POLICY IF EXISTS "DOM can insert paired wish notes" ON public.wish_dom_notes;
DROP POLICY IF EXISTS "DOM can update paired wish notes" ON public.wish_dom_notes;
DROP POLICY IF EXISTS "DOM can delete paired wish notes" ON public.wish_dom_notes;

CREATE POLICY "DOM can read paired wish notes"
  ON public.wish_dom_notes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.wishes
      WHERE wishes.id = wish_dom_notes.wish_id
        AND public.is_dom_for_user(wishes.created_by)
    )
  );

CREATE POLICY "DOM can insert paired wish notes"
  ON public.wish_dom_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.wishes
      WHERE wishes.id = wish_dom_notes.wish_id
        AND public.is_dom_for_user(wishes.created_by)
    )
  );

CREATE POLICY "DOM can update paired wish notes"
  ON public.wish_dom_notes
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.wishes
      WHERE wishes.id = wish_dom_notes.wish_id
        AND public.is_dom_for_user(wishes.created_by)
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.wishes
      WHERE wishes.id = wish_dom_notes.wish_id
        AND public.is_dom_for_user(wishes.created_by)
    )
  );

CREATE POLICY "DOM can delete paired wish notes"
  ON public.wish_dom_notes
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.wishes
      WHERE wishes.id = wish_dom_notes.wish_id
        AND public.is_dom_for_user(wishes.created_by)
    )
  );

DROP POLICY IF EXISTS "Wish participants can read wish media" ON public.wish_media;
DROP POLICY IF EXISTS "SUB can upload own unlocked wish media" ON public.wish_media;
DROP POLICY IF EXISTS "Wish owner or DOM can delete wish media" ON public.wish_media;

CREATE POLICY "Wish participants can read wish media"
  ON public.wish_media
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.wishes
      WHERE wishes.id = wish_media.wish_id
        AND public.can_access_wish(wishes.created_by)
    )
  );

CREATE POLICY "SUB can upload own unlocked wish media"
  ON public.wish_media
  FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.wishes
      WHERE wishes.id = wish_media.wish_id
        AND wishes.created_by = auth.uid()
        AND wishes.status IN ('new', 'noted')
    )
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'sub'
    )
  );

CREATE POLICY "Wish owner or DOM can delete wish media"
  ON public.wish_media
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.wishes
      WHERE wishes.id = wish_media.wish_id
        AND (
          (
            wishes.created_by = auth.uid()
            AND wishes.status IN ('new', 'noted')
          )
          OR public.is_dom_for_user(wishes.created_by)
        )
    )
  );

CREATE OR REPLACE FUNCTION public.update_own_wish(
  wish_uuid UUID,
  next_title TEXT,
  next_description TEXT,
  next_category TEXT,
  next_intensity INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clean_title TEXT;
  clean_description TEXT;
  clean_category TEXT;
  updated_wish_id UUID;
BEGIN
  clean_title := left(btrim(regexp_replace(coalesce(next_title, ''), '\s+', ' ', 'g')), 255);
  clean_description := nullif(left(btrim(coalesce(next_description, '')), 4000), '');
  clean_category := nullif(left(btrim(regexp_replace(coalesce(next_category, ''), '\s+', ' ', 'g')), 80), '');

  IF clean_title = '' THEN
    RAISE EXCEPTION 'Název přání je povinný.';
  END IF;

  IF next_intensity IS NULL OR next_intensity < 1 OR next_intensity > 5 THEN
    RAISE EXCEPTION 'Intenzita musí být mezi 1 a 5.';
  END IF;

  UPDATE public.wishes AS w
  SET
    title = clean_title,
    description = clean_description,
    category = clean_category,
    intensity = next_intensity
  WHERE w.id = wish_uuid
    AND w.created_by = auth.uid()
    AND w.status IN ('new', 'noted')
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'sub'
    )
  RETURNING w.id INTO updated_wish_id;

  IF updated_wish_id IS NULL THEN
    RAISE EXCEPTION 'Přání nelze upravit.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_wish_status(wish_uuid UUID, next_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_wish_id UUID;
BEGIN
  IF next_status NOT IN ('noted', 'planned', 'fulfilled', 'declined') THEN
    RAISE EXCEPTION 'Neplatný stav přání.';
  END IF;

  UPDATE public.wishes AS w
  SET
    status = next_status,
    fulfilled_at = CASE
      WHEN next_status = 'fulfilled' THEN timezone('utc'::text, now())
      ELSE NULL
    END
  WHERE w.id = wish_uuid
    AND public.is_dom_for_user(w.created_by)
  RETURNING w.id INTO updated_wish_id;

  IF updated_wish_id IS NULL THEN
    RAISE EXCEPTION 'Přání nebylo nalezeno.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_wish_dom_note(wish_uuid UUID, next_note TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wish_owner UUID;
  clean_note TEXT;
BEGIN
  SELECT wishes.created_by
  INTO wish_owner
  FROM public.wishes
  WHERE wishes.id = wish_uuid
    AND public.is_dom_for_user(wishes.created_by);

  IF wish_owner IS NULL THEN
    RAISE EXCEPTION 'Přání nebylo nalezeno.';
  END IF;

  clean_note := nullif(left(btrim(coalesce(next_note, '')), 5000), '');

  INSERT INTO public.wish_dom_notes (wish_id, created_by, note)
  VALUES (wish_uuid, auth.uid(), clean_note)
  ON CONFLICT (wish_id) DO UPDATE
  SET
    created_by = EXCLUDED.created_by,
    note = EXCLUDED.note;
END;
$$;

REVOKE ALL ON TABLE public.wishes FROM anon, authenticated;
REVOKE ALL ON TABLE public.wish_dom_notes FROM anon, authenticated;
REVOKE ALL ON TABLE public.wish_media FROM anon, authenticated;

GRANT SELECT, INSERT, DELETE ON TABLE public.wishes TO authenticated;
GRANT SELECT ON TABLE public.wish_dom_notes TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.wish_media TO authenticated;

REVOKE ALL ON FUNCTION public.is_dom_for_user(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_wish(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_own_wish(UUID, TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_wish_status(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_wish_dom_note(UUID, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_dom_for_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_wish(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_own_wish(UUID, TEXT, TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_wish_status(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_wish_dom_note(UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
