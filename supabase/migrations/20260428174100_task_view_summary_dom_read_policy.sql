-- Allow assigning DOM/SuperAdmin users to read SUB view summaries
-- for tasks they assigned. SUB users still only read their own rows via
-- the existing viewer_id = auth.uid() policy.

CREATE POLICY "Assigning DOM can read task view summary"
  ON public.task_view_summary
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tasks
      WHERE tasks.id = task_view_summary.task_id
        AND tasks.assigned_by = auth.uid()
    )
  );
