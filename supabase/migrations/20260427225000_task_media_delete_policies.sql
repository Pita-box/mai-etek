DROP POLICY IF EXISTS "Task DOM can delete media" ON public.task_media;
DROP POLICY IF EXISTS "Uploaders can delete own media" ON public.task_media;

CREATE POLICY "Task DOM can delete media"
  ON public.task_media
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tasks
      WHERE tasks.id = task_media.task_id
        AND tasks.assigned_by = auth.uid()
    )
  );

CREATE POLICY "Uploaders can delete own media"
  ON public.task_media
  FOR DELETE
  TO authenticated
  USING (uploaded_by = auth.uid());
