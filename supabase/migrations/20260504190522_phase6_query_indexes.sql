-- Phase 6: query-focused indexes from the performance EXPLAIN pass.

CREATE INDEX IF NOT EXISTS profiles_dom_full_name_idx
  ON public.profiles(dom_id, full_name)
  WHERE dom_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS tasks_created_at_idx
  ON public.tasks(created_at DESC);

CREATE INDEX IF NOT EXISTS task_media_task_created_idx
  ON public.task_media(task_id, created_at DESC);

CREATE INDEX IF NOT EXISTS task_comments_active_task_tab_created_idx
  ON public.task_comments(task_id, tab_type, created_at)
  WHERE deleted_at IS NULL;

NOTIFY pgrst, 'reload schema';
