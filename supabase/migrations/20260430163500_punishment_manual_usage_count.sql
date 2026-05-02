-- Replace derived template usage counts with a manual per-template counter.

ALTER TABLE public.punishments
  ADD COLUMN IF NOT EXISTS usage_count INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0);

UPDATE public.punishments
SET usage_count = 0
WHERE usage_count IS NULL;

DROP FUNCTION IF EXISTS public.get_punishment_template_usage_counts();

CREATE OR REPLACE FUNCTION public.increment_punishment_template_usage(template_uuid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_usage_count INTEGER;
BEGIN
  UPDATE public.punishments
  SET usage_count = usage_count + 1
  WHERE id = template_uuid
    AND is_template = true
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'dom'
    )
  RETURNING usage_count INTO next_usage_count;

  IF next_usage_count IS NULL THEN
    RAISE EXCEPTION 'Punishment template not found';
  END IF;

  RETURN next_usage_count;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_punishment_template_usage(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_punishment_template_usage(UUID) TO authenticated;
