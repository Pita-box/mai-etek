-- Allow assigned SUB to update their own task attempts.

CREATE POLICY "Assigned SUB can update own attempts"
  ON public.task_attempts
  FOR UPDATE
  TO authenticated
  USING (
    submitted_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.tasks
      WHERE tasks.id = task_attempts.task_id
        AND tasks.assigned_to = auth.uid()
    )
  )
  WITH CHECK (
    submitted_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.tasks
      WHERE tasks.id = task_attempts.task_id
        AND tasks.assigned_to = auth.uid()
    )
  );
