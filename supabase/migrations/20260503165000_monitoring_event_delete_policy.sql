-- Allow DOM to manually delete own monitoring timeline events from the dashboard.

DROP POLICY IF EXISTS "DOM can delete own monitoring events" ON public.monitoring_events;
CREATE POLICY "DOM can delete own monitoring events"
  ON public.monitoring_events
  FOR DELETE
  TO authenticated
  USING (
    dom_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles dom_profile
      WHERE dom_profile.id = auth.uid()
        AND dom_profile.role = 'dom'
    )
  );

NOTIFY pgrst, 'reload schema';
