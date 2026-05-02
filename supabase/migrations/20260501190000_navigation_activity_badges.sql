-- Phase 3: universal page activity notifications for sidebar badges.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS page_key TEXT,
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS entity_id UUID,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

UPDATE public.notifications
SET
  page_key = COALESCE(page_key, 'tasks'),
  entity_type = COALESCE(entity_type, 'task'),
  entity_id = COALESCE(entity_id, task_id)
WHERE task_id IS NOT NULL;

UPDATE public.notifications
SET page_key = COALESCE(page_key, 'tasks')
WHERE page_key IS NULL;

ALTER TABLE public.notifications
  ALTER COLUMN page_key SET DEFAULT 'tasks',
  ALTER COLUMN page_key SET NOT NULL;

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_page_key_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_page_key_check
  CHECK (page_key IN ('tasks', 'wishes', 'gallery', 'chat', 'monitoring', 'security', 'presence', 'default'));

CREATE INDEX IF NOT EXISTS notifications_user_page_unread_idx
  ON public.notifications(user_id, page_key, read_at, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_user_entity_unread_idx
  ON public.notifications(user_id, page_key, entity_type, entity_id, read_at)
  WHERE entity_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_unread_dedupe_key_idx
  ON public.notifications(user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL
    AND read_at IS NULL;

CREATE OR REPLACE FUNCTION public.create_activity_notification(
  p_user_id UUID,
  p_page_key TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_type TEXT DEFAULT 'activity',
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_dedupe_key TEXT DEFAULT NULL,
  p_task_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_actor RECORD;
  v_recipient RECORD;
  v_task RECORD;
  v_wish RECORD;
  v_gallery_media RECORD;
  v_notification_id UUID;
  v_task_id UUID;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_user_id IS NULL OR p_user_id = v_actor_id THEN
    RETURN NULL;
  END IF;

  IF p_page_key NOT IN ('tasks', 'wishes', 'gallery') THEN
    RAISE EXCEPTION 'Unsupported notification page: %', p_page_key USING ERRCODE = '22023';
  END IF;

  IF p_entity_id IS NULL THEN
    RAISE EXCEPTION 'Notification entity is required' USING ERRCODE = '22023';
  END IF;

  SELECT id, role, dom_id
  INTO v_actor
  FROM public.profiles
  WHERE id = v_actor_id;

  SELECT id, role, dom_id
  INTO v_recipient
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_actor.id IS NULL OR v_recipient.id IS NULL THEN
    RAISE EXCEPTION 'Notification participant profile not found' USING ERRCODE = '42501';
  END IF;

  IF p_page_key = 'tasks' THEN
    v_task_id := COALESCE(p_task_id, p_entity_id);

    SELECT id, assigned_by, assigned_to
    INTO v_task
    FROM public.tasks
    WHERE id = v_task_id;

    IF v_task.id IS NULL THEN
      RAISE EXCEPTION 'Task not found' USING ERRCODE = '42501';
    END IF;

    IF p_entity_type IS DISTINCT FROM 'task' THEN
      RAISE EXCEPTION 'Invalid task notification entity type' USING ERRCODE = '22023';
    END IF;

    IF v_actor_id NOT IN (v_task.assigned_by, v_task.assigned_to)
      OR p_user_id NOT IN (v_task.assigned_by, v_task.assigned_to)
    THEN
      RAISE EXCEPTION 'Task notification denied' USING ERRCODE = '42501';
    END IF;
  ELSIF p_page_key = 'wishes' THEN
    SELECT wishes.id, wishes.created_by, owner.dom_id
    INTO v_wish
    FROM public.wishes
    JOIN public.profiles owner ON owner.id = wishes.created_by
    WHERE wishes.id = p_entity_id;

    IF v_wish.id IS NULL THEN
      RAISE EXCEPTION 'Wish not found' USING ERRCODE = '42501';
    END IF;

    IF p_entity_type IS DISTINCT FROM 'wish' THEN
      RAISE EXCEPTION 'Invalid wish notification entity type' USING ERRCODE = '22023';
    END IF;

    IF NOT (
      (v_actor_id = v_wish.created_by AND p_user_id = v_wish.dom_id)
      OR (v_actor_id = v_wish.dom_id AND p_user_id = v_wish.created_by)
    ) THEN
      RAISE EXCEPTION 'Wish notification denied' USING ERRCODE = '42501';
    END IF;
  ELSIF p_page_key = 'gallery' THEN
    SELECT id, uploaded_by
    INTO v_gallery_media
    FROM public.gallery_media
    WHERE id = p_entity_id
      AND deleted_at IS NULL;

    IF v_gallery_media.id IS NULL THEN
      RAISE EXCEPTION 'Gallery media not found' USING ERRCODE = '42501';
    END IF;

    IF p_entity_type IS DISTINCT FROM 'gallery_media' THEN
      RAISE EXCEPTION 'Invalid gallery notification entity type' USING ERRCODE = '22023';
    END IF;

    IF v_gallery_media.uploaded_by IS DISTINCT FROM v_actor_id THEN
      RAISE EXCEPTION 'Gallery notification actor denied' USING ERRCODE = '42501';
    END IF;

    IF NOT (
      (v_actor.role = 'sub' AND v_actor.dom_id = p_user_id AND v_recipient.role = 'dom')
      OR (v_actor.role = 'dom' AND v_recipient.dom_id = v_actor_id AND v_recipient.role = 'sub')
    ) THEN
      RAISE EXCEPTION 'Gallery notification recipient denied' USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public.notifications (
    user_id,
    actor_id,
    task_id,
    page_key,
    entity_type,
    entity_id,
    title,
    body,
    type,
    metadata,
    dedupe_key
  )
  VALUES (
    p_user_id,
    v_actor_id,
    CASE WHEN p_page_key = 'tasks' THEN COALESCE(p_task_id, p_entity_id) ELSE NULL END,
    p_page_key,
    p_entity_type,
    p_entity_id,
    COALESCE(NULLIF(btrim(p_title), ''), 'Nová aktivita'),
    COALESCE(NULLIF(btrim(p_body), ''), 'Nová aktivita čeká na zobrazení.'),
    COALESCE(NULLIF(btrim(p_type), ''), 'activity'),
    COALESCE(p_metadata, '{}'::jsonb),
    NULLIF(btrim(p_dedupe_key), '')
  )
  ON CONFLICT (user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL
    AND read_at IS NULL
  DO UPDATE SET
    actor_id = EXCLUDED.actor_id,
    task_id = EXCLUDED.task_id,
    page_key = EXCLUDED.page_key,
    entity_type = EXCLUDED.entity_type,
    entity_id = EXCLUDED.entity_id,
    title = EXCLUDED.title,
    body = EXCLUDED.body,
    type = EXCLUDED.type,
    metadata = EXCLUDED.metadata,
    created_at = timezone('utc'::text, now())
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_activity_notification(
  UUID,
  TEXT,
  TEXT,
  UUID,
  TEXT,
  TEXT,
  TEXT,
  JSONB,
  TEXT,
  UUID
) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    NULL;
END $$;

NOTIFY pgrst, 'reload schema';
