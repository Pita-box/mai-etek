DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname = 'message_type'
  ) THEN
    CREATE TYPE public.message_type AS ENUM ('text', 'image', 'video', 'voice', 'system');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.message_type NOT NULL DEFAULT 'text',
  content TEXT,
  media_url TEXT,
  media_thumbnail_url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT messages_content_check CHECK (
    (
      type = 'text'
      AND content IS NOT NULL
      AND btrim(content) <> ''
    )
    OR (
      type IN ('image', 'video', 'voice')
      AND media_url IS NOT NULL
      AND btrim(media_url) <> ''
    )
    OR type = 'system'
  )
);

CREATE INDEX IF NOT EXISTS messages_created_idx
  ON public.messages(created_at DESC);

CREATE INDEX IF NOT EXISTS messages_sender_idx
  ON public.messages(sender_id);

CREATE OR REPLACE FUNCTION public.can_access_chat_message(message_sender_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT message_sender_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.profiles viewer
      LEFT JOIN public.profiles sender ON sender.id = message_sender_id
      WHERE viewer.id = auth.uid()
        AND (
          (
            viewer.role = 'dom'
            AND sender.dom_id = viewer.id
            AND sender.role IN ('sub', 'unassigned')
          )
          OR (
            viewer.dom_id IS NOT NULL
            AND message_sender_id = viewer.dom_id
          )
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_delete_chat_message(message_sender_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles viewer
    LEFT JOIN public.profiles sender ON sender.id = message_sender_id
    WHERE viewer.id = auth.uid()
      AND viewer.role = 'dom'
      AND (
        message_sender_id = viewer.id
        OR sender.dom_id = viewer.id
      )
  );
$$;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chat participants can read messages"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (public.can_access_chat_message(sender_id));

CREATE POLICY "Users can create own chat messages"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Chat participants can mark partner messages read"
  ON public.messages
  FOR UPDATE
  TO authenticated
  USING (
    sender_id <> auth.uid()
    AND public.can_access_chat_message(sender_id)
  )
  WITH CHECK (
    sender_id <> auth.uid()
    AND public.can_access_chat_message(sender_id)
  );

CREATE POLICY "DOM can delete chat messages in own pair"
  ON public.messages
  FOR DELETE
  TO authenticated
  USING (public.can_delete_chat_message(sender_id));

REVOKE ALL ON TABLE public.messages FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.messages TO authenticated;
GRANT UPDATE (is_read, read_at) ON TABLE public.messages TO authenticated;
GRANT USAGE ON TYPE public.message_type TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_chat_message(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_delete_chat_message(UUID) TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'domsub-media',
  'domsub-media',
  true,
  52428800,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'audio/webm',
    'audio/mp4',
    'audio/mpeg',
    'audio/ogg',
    'audio/wav'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  updated_at = timezone('utc'::text, now());

NOTIFY pgrst, 'reload schema';
