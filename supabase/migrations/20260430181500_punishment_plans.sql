-- Add DOM-only punishment plans and plan items.

CREATE TABLE IF NOT EXISTS public.punishment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 255),
  description TEXT,
  event_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'used', 'archived')),
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.punishment_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.punishment_plans(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.punishments(id) ON DELETE SET NULL,
  title_snapshot TEXT NOT NULL CHECK (char_length(btrim(title_snapshot)) BETWEEN 1 AND 255),
  description_snapshot TEXT,
  severity_snapshot INTEGER NOT NULL CHECK (severity_snapshot BETWEEN 1 AND 5),
  categories_snapshot TEXT[] NOT NULL DEFAULT '{}'::text[],
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  is_done BOOLEAN NOT NULL DEFAULT false,
  done_at TIMESTAMP WITH TIME ZONE,
  usage_counted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS punishment_plans_created_by_idx
  ON public.punishment_plans(created_by, event_at NULLS LAST, created_at DESC);

CREATE INDEX IF NOT EXISTS punishment_plan_items_plan_position_idx
  ON public.punishment_plan_items(plan_id, position, created_at);

CREATE INDEX IF NOT EXISTS punishment_plan_items_template_idx
  ON public.punishment_plan_items(template_id)
  WHERE template_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS punishment_plan_items_plan_template_unique_idx
  ON public.punishment_plan_items(plan_id, template_id)
  WHERE template_id IS NOT NULL;

DROP TRIGGER IF EXISTS on_punishment_plans_updated ON public.punishment_plans;
CREATE TRIGGER on_punishment_plans_updated
  BEFORE UPDATE ON public.punishment_plans
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

DROP TRIGGER IF EXISTS on_punishment_plan_items_updated ON public.punishment_plan_items;
CREATE TRIGGER on_punishment_plan_items_updated
  BEFORE UPDATE ON public.punishment_plan_items
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

ALTER TABLE public.punishment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.punishment_plan_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "DOM can read own punishment plans" ON public.punishment_plans;
DROP POLICY IF EXISTS "DOM can create own punishment plans" ON public.punishment_plans;
DROP POLICY IF EXISTS "DOM can update own punishment plans" ON public.punishment_plans;
DROP POLICY IF EXISTS "DOM can delete own punishment plans" ON public.punishment_plans;

CREATE POLICY "DOM can read own punishment plans"
  ON public.punishment_plans
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'dom'
    )
  );

CREATE POLICY "DOM can create own punishment plans"
  ON public.punishment_plans
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'dom'
    )
  );

CREATE POLICY "DOM can update own punishment plans"
  ON public.punishment_plans
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'dom'
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'dom'
    )
  );

CREATE POLICY "DOM can delete own punishment plans"
  ON public.punishment_plans
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'dom'
    )
  );

DROP POLICY IF EXISTS "DOM can read own punishment plan items" ON public.punishment_plan_items;
DROP POLICY IF EXISTS "DOM can create own punishment plan items" ON public.punishment_plan_items;
DROP POLICY IF EXISTS "DOM can update own punishment plan items" ON public.punishment_plan_items;
DROP POLICY IF EXISTS "DOM can delete own punishment plan items" ON public.punishment_plan_items;

CREATE POLICY "DOM can read own punishment plan items"
  ON public.punishment_plan_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.punishment_plans
      WHERE punishment_plans.id = punishment_plan_items.plan_id
        AND punishment_plans.created_by = auth.uid()
    )
  );

CREATE POLICY "DOM can create own punishment plan items"
  ON public.punishment_plan_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    template_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.punishment_plans
      WHERE punishment_plans.id = punishment_plan_items.plan_id
        AND punishment_plans.created_by = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM public.punishments
      WHERE punishments.id = punishment_plan_items.template_id
        AND punishments.is_template = true
        AND punishments.created_by = auth.uid()
    )
  );

CREATE POLICY "DOM can update own punishment plan items"
  ON public.punishment_plan_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.punishment_plans
      WHERE punishment_plans.id = punishment_plan_items.plan_id
        AND punishment_plans.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.punishment_plans
      WHERE punishment_plans.id = punishment_plan_items.plan_id
        AND punishment_plans.created_by = auth.uid()
    )
    AND (
      template_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.punishments
        WHERE punishments.id = punishment_plan_items.template_id
          AND punishments.is_template = true
          AND punishments.created_by = auth.uid()
      )
    )
  );

CREATE POLICY "DOM can delete own punishment plan items"
  ON public.punishment_plan_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.punishment_plans
      WHERE punishment_plans.id = punishment_plan_items.plan_id
        AND punishment_plans.created_by = auth.uid()
    )
  );

DROP FUNCTION IF EXISTS public.set_punishment_plan_item_done(UUID, BOOLEAN);

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
