-- Add RLS policies for DOM/SUB task workflow tables.
-- Policies are scoped to participants of the related task:
-- DOM = tasks.assigned_by, SUB = tasks.assigned_to.

CREATE POLICY "Task participants can read attempts"
  ON public.task_attempts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tasks
      WHERE tasks.id = task_attempts.task_id
        AND auth.uid() IN (tasks.assigned_by, tasks.assigned_to)
    )
  );

CREATE POLICY "Assigned SUB can create attempts"
  ON public.task_attempts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    submitted_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.tasks
      WHERE tasks.id = task_attempts.task_id
        AND tasks.assigned_to = auth.uid()
    )
  );

CREATE POLICY "Task participants can read media"
  ON public.task_media
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tasks
      WHERE tasks.id = task_media.task_id
        AND auth.uid() IN (tasks.assigned_by, tasks.assigned_to)
    )
  );

CREATE POLICY "Task participants can upload media"
  ON public.task_media
  FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.tasks
      WHERE tasks.id = task_media.task_id
        AND auth.uid() IN (tasks.assigned_by, tasks.assigned_to)
    )
  );

CREATE POLICY "Task participants can read comments"
  ON public.task_comments
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.tasks
      WHERE tasks.id = task_comments.task_id
        AND auth.uid() IN (tasks.assigned_by, tasks.assigned_to)
    )
  );

CREATE POLICY "Task participants can create comments"
  ON public.task_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.tasks
      WHERE tasks.id = task_comments.task_id
        AND auth.uid() IN (tasks.assigned_by, tasks.assigned_to)
    )
  );

CREATE POLICY "Assigned SUB can read own task view summary"
  ON public.task_view_summary
  FOR SELECT
  TO authenticated
  USING (viewer_id = auth.uid());

CREATE POLICY "Assigned SUB can insert own task view summary"
  ON public.task_view_summary
  FOR INSERT
  TO authenticated
  WITH CHECK (
    viewer_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.tasks
      WHERE tasks.id = task_view_summary.task_id
        AND tasks.assigned_to = auth.uid()
    )
  );

CREATE POLICY "Assigned SUB can update own task view summary"
  ON public.task_view_summary
  FOR UPDATE
  TO authenticated
  USING (viewer_id = auth.uid())
  WITH CHECK (
    viewer_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.tasks
      WHERE tasks.id = task_view_summary.task_id
        AND tasks.assigned_to = auth.uid()
    )
  );

CREATE POLICY "Task participants can read visibility state"
  ON public.task_user_visibility
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.tasks
      WHERE tasks.id = task_user_visibility.task_id
        AND auth.uid() IN (tasks.assigned_by, tasks.assigned_to)
    )
  );

CREATE POLICY "Task participants can upsert visibility state"
  ON public.task_user_visibility
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.tasks
      WHERE tasks.id = task_user_visibility.task_id
        AND auth.uid() IN (tasks.assigned_by, tasks.assigned_to)
    )
  );

CREATE POLICY "Task participants can update visibility state"
  ON public.task_user_visibility
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.tasks
      WHERE tasks.id = task_user_visibility.task_id
        AND auth.uid() IN (tasks.assigned_by, tasks.assigned_to)
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.tasks
      WHERE tasks.id = task_user_visibility.task_id
        AND auth.uid() IN (tasks.assigned_by, tasks.assigned_to)
    )
  );

CREATE POLICY "Users can read own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Task participants can create task notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.tasks
      WHERE tasks.id = notifications.task_id
        AND auth.uid() IN (tasks.assigned_by, tasks.assigned_to)
        AND notifications.user_id IN (tasks.assigned_by, tasks.assigned_to)
    )
  );

CREATE POLICY "Users can update own notifications"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
