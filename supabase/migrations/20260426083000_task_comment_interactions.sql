-- Add task comment interactions: likes, author updates, and DOM-only soft delete.

CREATE TABLE IF NOT EXISTS public.task_comment_likes (
  comment_id UUID NOT NULL REFERENCES public.task_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS task_comment_likes_comment_idx
  ON public.task_comment_likes(comment_id, created_at DESC);

ALTER TABLE public.task_comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Task participants can read comment likes"
  ON public.task_comment_likes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.task_comments comments
      JOIN public.tasks tasks ON tasks.id = comments.task_id
      WHERE comments.id = task_comment_likes.comment_id
        AND comments.deleted_at IS NULL
        AND auth.uid() IN (tasks.assigned_by, tasks.assigned_to)
    )
  );

CREATE POLICY "Task participants can like comments"
  ON public.task_comment_likes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.task_comments comments
      JOIN public.tasks tasks ON tasks.id = comments.task_id
      WHERE comments.id = task_comment_likes.comment_id
        AND comments.deleted_at IS NULL
        AND auth.uid() IN (tasks.assigned_by, tasks.assigned_to)
    )
  );

CREATE POLICY "Users can remove own comment likes"
  ON public.task_comment_likes
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.task_comments comments
      JOIN public.tasks tasks ON tasks.id = comments.task_id
      WHERE comments.id = task_comment_likes.comment_id
        AND comments.deleted_at IS NULL
        AND auth.uid() IN (tasks.assigned_by, tasks.assigned_to)
    )
  );

CREATE POLICY "Comment authors can update their own comments"
  ON public.task_comments
  FOR UPDATE
  TO authenticated
  USING (
    author_id = auth.uid()
    AND deleted_at IS NULL
  )
  WITH CHECK (
    author_id = auth.uid()
    AND deleted_at IS NULL
  );

DROP TRIGGER IF EXISTS on_task_comments_updated ON public.task_comments;

CREATE TRIGGER on_task_comments_updated
  BEFORE UPDATE ON public.task_comments
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.dom_soft_delete_task_comment(p_comment_id UUID)
RETURNS public.task_comments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comment public.task_comments;
BEGIN
  UPDATE public.task_comments comments
  SET deleted_at = timezone('utc'::text, now()),
      updated_at = timezone('utc'::text, now())
  FROM public.tasks tasks
  WHERE comments.id = p_comment_id
    AND comments.task_id = tasks.id
    AND comments.deleted_at IS NULL
    AND tasks.assigned_by = auth.uid()
  RETURNING comments.* INTO v_comment;

  IF v_comment.id IS NULL THEN
    RAISE EXCEPTION 'Comment not found or forbidden';
  END IF;

  RETURN v_comment;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dom_soft_delete_task_comment(UUID) TO authenticated;
