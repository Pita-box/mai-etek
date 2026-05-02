-- Fix ambiguous usage_count references inside the punishment plan toggle helper.

CREATE OR REPLACE FUNCTION public.set_punishment_plan_item_done(item_uuid UUID, next_done BOOLEAN)
RETURNS TABLE(item_id UUID, is_done BOOLEAN, done_at TIMESTAMP WITH TIME ZONE, usage_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item_record public.punishment_plan_items%ROWTYPE;
  next_done_at TIMESTAMP WITH TIME ZONE;
  next_usage_count INTEGER;
BEGIN
  SELECT punishment_plan_items.*
  INTO item_record
  FROM public.punishment_plan_items
  JOIN public.punishment_plans
    ON punishment_plans.id = punishment_plan_items.plan_id
  WHERE punishment_plan_items.id = item_uuid
    AND punishment_plans.created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'dom'
    )
  FOR UPDATE OF punishment_plan_items;

  IF item_record.id IS NULL THEN
    RAISE EXCEPTION 'Punishment plan item not found';
  END IF;

  IF item_record.is_done = next_done THEN
    SELECT punishments.usage_count
    INTO next_usage_count
    FROM public.punishments
    WHERE punishments.id = item_record.template_id
      AND punishments.is_template = true
      AND punishments.created_by = auth.uid();

    item_id := item_record.id;
    is_done := item_record.is_done;
    done_at := item_record.done_at;
    usage_count := COALESCE(next_usage_count, 0);
    RETURN NEXT;
    RETURN;
  END IF;

  next_done_at := CASE
    WHEN next_done THEN timezone('utc'::text, now())
    ELSE NULL
  END;

  UPDATE public.punishment_plan_items
  SET
    is_done = next_done,
    done_at = next_done_at,
    usage_counted_at = next_done_at
  WHERE id = item_record.id;

  IF item_record.template_id IS NOT NULL THEN
    IF next_done THEN
      UPDATE public.punishments AS p
      SET usage_count = p.usage_count + 1
      WHERE p.id = item_record.template_id
        AND p.is_template = true
        AND p.created_by = auth.uid()
      RETURNING p.usage_count INTO next_usage_count;
    ELSE
      UPDATE public.punishments AS p
      SET usage_count = greatest(p.usage_count - 1, 0)
      WHERE p.id = item_record.template_id
        AND p.is_template = true
        AND p.created_by = auth.uid()
      RETURNING p.usage_count INTO next_usage_count;
    END IF;
  END IF;

  item_id := item_record.id;
  is_done := next_done;
  done_at := next_done_at;
  usage_count := COALESCE(next_usage_count, 0);
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.set_punishment_plan_item_done(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_punishment_plan_item_done(UUID, BOOLEAN) TO authenticated;

NOTIFY pgrst, 'reload schema';
