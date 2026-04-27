-- Add DOM/SUB task workflow support tables.
-- This migration is additive and keeps existing UUID task primary keys intact.

DO $$
BEGIN
  IF to_regclass('public.tasks') IS NOT NULL THEN
    ALTER TABLE public.tasks
      ADD COLUMN IF NOT EXISTS drive_folder_id TEXT,
      ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS xp_awarded_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;

    ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_status_check
      CHECK (status IN (
        'pending',
        'in_progress',
        'submitted',
        'in_review',
        'revision_requested',
        'completed',
        'approved',
        'rejected',
        'expired',
        'cancelled'
      ));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.task_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  text_content TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'revision_requested')),
  submitted_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(task_id, attempt_number)
);

CREATE TABLE IF NOT EXISTS public.task_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  attempt_id UUID REFERENCES public.task_attempts(id) ON DELETE SET NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('photo', 'video')),
  original_filename TEXT NOT NULL,
  drive_file_id TEXT NOT NULL,
  drive_web_view_link TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  attempt_id UUID REFERENCES public.task_attempts(id) ON DELETE SET NULL,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tab_type TEXT NOT NULL CHECK (tab_type IN ('text', 'photos', 'videos')),
  body TEXT NOT NULL,
  parent_comment_id UUID REFERENCES public.task_comments(id) ON DELETE CASCADE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.task_view_summary (
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  view_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (task_id, viewer_id)
);

CREATE TABLE IF NOT EXISTS public.task_user_visibility (
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dom_feedback_read_at TIMESTAMP WITH TIME ZONE,
  hide_from_sub_after_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (task_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'task',
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS task_attempts_task_id_idx ON public.task_attempts(task_id);
CREATE INDEX IF NOT EXISTS task_media_task_id_idx ON public.task_media(task_id);
CREATE INDEX IF NOT EXISTS task_comments_task_tab_idx ON public.task_comments(task_id, tab_type);
CREATE INDEX IF NOT EXISTS task_view_summary_task_id_idx ON public.task_view_summary(task_id);
CREATE INDEX IF NOT EXISTS notifications_user_read_idx ON public.notifications(user_id, read_at, created_at DESC);

ALTER TABLE public.task_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_view_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_user_visibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
