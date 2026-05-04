-- Allow DOM to remove already revoked monitoring installations from the dashboard.

DROP POLICY IF EXISTS "DOM can delete own revoked monitoring devices" ON public.monitoring_devices;
CREATE POLICY "DOM can delete own revoked monitoring devices"
  ON public.monitoring_devices
  FOR DELETE
  TO authenticated
  USING (
    revoked_at IS NOT NULL
    AND dom_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles dom_profile
      WHERE dom_profile.id = auth.uid()
        AND dom_profile.role = 'dom'
    )
  );

NOTIFY pgrst, 'reload schema';
