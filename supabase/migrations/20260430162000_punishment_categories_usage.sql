-- Add DOM-managed category tags and a narrow usage-count helper for templates.

ALTER TABLE public.punishments
  ADD COLUMN IF NOT EXISTS categories TEXT[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.punishments
  ALTER COLUMN categories SET DEFAULT '{}'::text[];

UPDATE public.punishments
SET categories = '{}'::text[]
WHERE categories IS NULL;

ALTER TABLE public.punishments
  ALTER COLUMN categories SET NOT NULL;

CREATE INDEX IF NOT EXISTS punishments_template_categories_gin_idx
  ON public.punishments USING GIN (categories)
  WHERE is_template = true;

CREATE OR REPLACE FUNCTION public.get_punishment_template_usage_counts()
RETURNS TABLE(template_id UUID, usage_count BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    template.id AS template_id,
    count(instance.id)::bigint AS usage_count
  FROM public.punishments AS template
  LEFT JOIN public.punishments AS instance
    ON instance.template_id = template.id
    AND instance.is_template = false
  WHERE template.is_template = true
    AND template.created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'dom'
    )
  GROUP BY template.id;
$$;

REVOKE ALL ON FUNCTION public.get_punishment_template_usage_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_punishment_template_usage_counts() TO authenticated;
