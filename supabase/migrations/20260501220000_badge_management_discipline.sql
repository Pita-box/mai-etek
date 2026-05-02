-- Phase 3: DOM-managed badges, negative badges, and discipline debt.

ALTER TABLE public.user_stats
  ADD COLUMN IF NOT EXISTS discipline_points INTEGER NOT NULL DEFAULT 0 CHECK (discipline_points >= 0);

ALTER TABLE public.xp_transactions
  ADD COLUMN IF NOT EXISTS discipline_delta INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.xp_transactions
  DROP CONSTRAINT IF EXISTS xp_transactions_source_type_check,
  DROP CONSTRAINT IF EXISTS xp_transactions_nonzero_delta_check,
  DROP CONSTRAINT IF EXISTS xp_transactions_check;

ALTER TABLE public.xp_transactions
  ADD CONSTRAINT xp_transactions_source_type_check
  CHECK (source_type IN (
    'task_award',
    'reward_claim',
    'reward_refund',
    'manual_adjustment',
    'manual_discipline',
    'task_rejection_penalty',
    'task_expiry_penalty',
    'badge_penalty',
    'discipline_refund'
  )),
  ADD CONSTRAINT xp_transactions_nonzero_delta_check
  CHECK (points_delta <> 0 OR available_delta <> 0 OR discipline_delta <> 0);

ALTER TABLE public.achievements
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS badge_type TEXT NOT NULL DEFAULT 'positive',
  ADD COLUMN IF NOT EXISTS xp_reward INTEGER NOT NULL DEFAULT 0 CHECK (xp_reward >= 0),
  ADD COLUMN IF NOT EXISTS xp_penalty INTEGER NOT NULL DEFAULT 0 CHECK (xp_penalty >= 0),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;

ALTER TABLE public.achievements
  DROP CONSTRAINT IF EXISTS achievements_badge_type_check;

ALTER TABLE public.achievements
  ADD CONSTRAINT achievements_badge_type_check
  CHECK (badge_type IN ('positive', 'negative'));

UPDATE public.achievements
SET created_by = (
  SELECT profiles.id
  FROM public.profiles
  WHERE profiles.role = 'dom'
  ORDER BY profiles.updated_at ASC NULLS LAST, profiles.id ASC
  LIMIT 1
)
WHERE created_by IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.role = 'dom'
  );

CREATE INDEX IF NOT EXISTS achievements_created_by_active_idx
  ON public.achievements(created_by, is_active, deleted_at, sort_order);

ALTER TABLE public.user_achievements
  ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assign_reason TEXT,
  ADD COLUMN IF NOT EXISTS removed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS removed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS remove_reason TEXT;

ALTER TABLE public.user_achievements
  DROP CONSTRAINT IF EXISTS user_achievements_user_id_achievement_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS user_achievements_active_unique_idx
  ON public.user_achievements(user_id, achievement_id)
  WHERE removed_at IS NULL;

CREATE INDEX IF NOT EXISTS user_achievements_user_removed_idx
  ON public.user_achievements(user_id, removed_at, unlocked_at DESC);

DROP POLICY IF EXISTS "Authenticated users can read achievements" ON public.achievements;
DROP POLICY IF EXISTS "Users can read scoped active achievements" ON public.achievements;
CREATE POLICY "Users can read scoped active achievements"
  ON public.achievements
  FOR SELECT
  TO authenticated
  USING (
    (
      created_by = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'dom'
      )
    )
    OR (
      deleted_at IS NULL
      AND (
        (
          is_active = true
          AND created_by IS NULL
        )
        OR (
          is_active = true
          AND EXISTS (
            SELECT 1
            FROM public.profiles viewer
            WHERE viewer.id = auth.uid()
              AND viewer.role = 'sub'
              AND viewer.dom_id = achievements.created_by
          )
        )
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_achievements visible_badges
      JOIN public.profiles target ON target.id = visible_badges.user_id
      JOIN public.profiles viewer ON viewer.id = auth.uid()
      WHERE visible_badges.achievement_id = achievements.id
        AND (
          visible_badges.user_id = auth.uid()
          OR (
            viewer.role = 'dom'
            AND target.dom_id = viewer.id
          )
        )
    )
  );

DROP POLICY IF EXISTS "DOM can create achievements" ON public.achievements;
CREATE POLICY "DOM can create achievements"
  ON public.achievements
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

DROP POLICY IF EXISTS "DOM can update achievements" ON public.achievements;
CREATE POLICY "DOM can update achievements"
  ON public.achievements
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

CREATE OR REPLACE FUNCTION public.check_user_achievements(
  user_uuid UUID,
  source_task_uuid UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_stats public.user_stats%ROWTYPE;
  v_owner_dom_id UUID;
  v_unlocked_count INTEGER := 0;
  v_unlock RECORD;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT public.can_view_gamification_user(user_uuid) THEN
    RAISE EXCEPTION 'Achievement check denied' USING ERRCODE = '42501';
  END IF;

  SELECT dom_id
  INTO v_owner_dom_id
  FROM public.profiles
  WHERE id = user_uuid;

  SELECT *
  INTO v_stats
  FROM public.user_stats
  WHERE user_id = user_uuid;

  IF v_stats.user_id IS NULL THEN
    RETURN 0;
  END IF;

  FOR v_unlock IN
    WITH eligible AS (
      SELECT achievements.*
      FROM public.achievements
      WHERE achievements.is_active = true
        AND achievements.deleted_at IS NULL
        AND achievements.badge_type = 'positive'
        AND (
          achievements.created_by = v_owner_dom_id
          OR achievements.created_by IS NULL
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public.user_achievements
          WHERE user_achievements.user_id = user_uuid
            AND user_achievements.achievement_id = achievements.id
            AND user_achievements.removed_at IS NULL
        )
        AND (
          (achievements.condition_type = 'points' AND v_stats.total_points >= achievements.condition_value)
          OR (achievements.condition_type = 'level' AND v_stats.level >= achievements.condition_value)
          OR (achievements.condition_type = 'streak' AND v_stats.longest_streak >= achievements.condition_value)
          OR (achievements.condition_type = 'tasks_completed' AND v_stats.tasks_completed >= achievements.condition_value)
          OR (achievements.condition_type = 'perfect_rating_count' AND v_stats.perfect_rating_count >= achievements.condition_value)
        )
    )
    INSERT INTO public.user_achievements (
      user_id,
      achievement_id,
      source_task_id,
      assigned_by,
      assign_reason
    )
    SELECT
      user_uuid,
      eligible.id,
      source_task_uuid,
      v_actor_id,
      'Automaticky odemčeno splněním podmínky.'
    FROM eligible
    ON CONFLICT (user_id, achievement_id) WHERE removed_at IS NULL DO NOTHING
    RETURNING id, achievement_id
  LOOP
    v_unlocked_count := v_unlocked_count + 1;

    PERFORM public.create_activity_notification(
      user_uuid,
      'achievements',
      'achievement',
      v_unlock.id,
      'Nový odznak',
      COALESCE(
        (
          SELECT title
          FROM public.achievements
          WHERE id = v_unlock.achievement_id
        ),
        'Odznak odemčen'
      ),
      'achievement_unlocked',
      jsonb_build_object('achievement_id', v_unlock.achievement_id),
      'achievement_unlocked:' || v_unlock.id::text,
      NULL
    );
  END LOOP;

  RETURN v_unlocked_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_manual_discipline(
  target_user_id UUID,
  points INTEGER,
  reason TEXT,
  source_type TEXT DEFAULT 'manual_discipline',
  source_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_target RECORD;
  v_clean_reason TEXT := NULLIF(btrim(COALESCE(reason, '')), '');
  v_safe_points INTEGER := GREATEST(COALESCE(points, 0), 0);
  v_source_type TEXT := COALESCE(NULLIF(btrim(source_type), ''), 'manual_discipline');
  v_transaction_source_id UUID := source_id;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF v_safe_points <= 0 THEN
    RAISE EXCEPTION 'Discipline points must be positive' USING ERRCODE = '22023';
  END IF;

  IF v_clean_reason IS NULL THEN
    RAISE EXCEPTION 'Reason is required' USING ERRCODE = '22023';
  END IF;

  IF v_source_type NOT IN (
    'manual_discipline',
    'task_rejection_penalty',
    'task_expiry_penalty',
    'badge_penalty'
  ) THEN
    RAISE EXCEPTION 'Unsupported discipline source type: %', v_source_type USING ERRCODE = '22023';
  END IF;

  SELECT id, role, dom_id
  INTO v_target
  FROM public.profiles
  WHERE id = target_user_id;

  IF v_target.id IS NULL OR v_target.role IS DISTINCT FROM 'sub' OR v_target.dom_id IS DISTINCT FROM v_actor_id THEN
    RAISE EXCEPTION 'Only paired DOM can add discipline debt' USING ERRCODE = '42501';
  END IF;

  IF v_source_type IN ('manual_discipline', 'task_rejection_penalty') THEN
    v_transaction_source_id := NULL;
  END IF;

  INSERT INTO public.user_stats (user_id)
  VALUES (target_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.user_stats
  SET
    discipline_points = discipline_points + v_safe_points,
    updated_at = timezone('utc'::text, now())
  WHERE user_id = target_user_id;

  INSERT INTO public.xp_transactions (
    user_id,
    source_type,
    source_id,
    discipline_delta,
    reason,
    created_by
  )
  VALUES (
    target_user_id,
    v_source_type,
    v_transaction_source_id,
    v_safe_points,
    v_clean_reason,
    v_actor_id
  );

  RETURN jsonb_build_object(
    'user_id', target_user_id,
    'discipline_delta', v_safe_points,
    'source_type', v_source_type
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_user_badge(
  target_user_id UUID,
  achievement_uuid UUID,
  reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_target RECORD;
  v_achievement public.achievements%ROWTYPE;
  v_clean_reason TEXT := NULLIF(btrim(COALESCE(reason, '')), '');
  v_user_achievement_id UUID;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF v_clean_reason IS NULL THEN
    RAISE EXCEPTION 'Reason is required' USING ERRCODE = '22023';
  END IF;

  SELECT id, role, dom_id
  INTO v_target
  FROM public.profiles
  WHERE id = target_user_id;

  IF v_target.id IS NULL OR v_target.role IS DISTINCT FROM 'sub' OR v_target.dom_id IS DISTINCT FROM v_actor_id THEN
    RAISE EXCEPTION 'Only paired DOM can assign badges' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_achievement
  FROM public.achievements
  WHERE id = achievement_uuid
    AND deleted_at IS NULL
    AND is_active = true
    AND (
      created_by = v_actor_id
      OR created_by IS NULL
    );

  IF v_achievement.id IS NULL THEN
    RAISE EXCEPTION 'Badge not found or inactive' USING ERRCODE = '42501';
  END IF;

  SELECT id
  INTO v_user_achievement_id
  FROM public.user_achievements
  WHERE user_id = target_user_id
    AND achievement_id = achievement_uuid
    AND removed_at IS NULL
  LIMIT 1;

  IF v_user_achievement_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'assigned', false,
      'reason', 'already_assigned',
      'user_achievement_id', v_user_achievement_id
    );
  END IF;

  INSERT INTO public.user_achievements (
    user_id,
    achievement_id,
    assigned_by,
    assign_reason
  )
  VALUES (
    target_user_id,
    achievement_uuid,
    v_actor_id,
    v_clean_reason
  )
  RETURNING id INTO v_user_achievement_id;

  IF v_achievement.badge_type = 'negative' AND COALESCE(v_achievement.xp_penalty, 0) > 0 THEN
    PERFORM public.apply_manual_discipline(
      target_user_id,
      v_achievement.xp_penalty,
      'Prohřeškový odznak: ' || v_achievement.title || '. ' || v_clean_reason,
      'badge_penalty',
      v_user_achievement_id
    );
  END IF;

  PERFORM public.create_activity_notification(
    target_user_id,
    'achievements',
    'achievement',
    v_user_achievement_id,
    CASE WHEN v_achievement.badge_type = 'negative' THEN 'Nový kázeňský odznak' ELSE 'Nový odznak' END,
    v_achievement.title || ': ' || v_clean_reason,
    'achievement_assigned',
    jsonb_build_object(
      'achievement_id', achievement_uuid,
      'badge_type', v_achievement.badge_type
    ),
    'achievement_assigned:' || v_user_achievement_id::text,
    NULL
  );

  RETURN jsonb_build_object(
    'assigned', true,
    'user_achievement_id', v_user_achievement_id,
    'achievement_id', achievement_uuid,
    'badge_type', v_achievement.badge_type,
    'xp_penalty', COALESCE(v_achievement.xp_penalty, 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_user_badge(
  user_achievement_uuid UUID,
  reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_user_achievement public.user_achievements%ROWTYPE;
  v_target RECORD;
  v_clean_reason TEXT := NULLIF(btrim(COALESCE(reason, '')), '');
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF v_clean_reason IS NULL THEN
    RAISE EXCEPTION 'Reason is required' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_user_achievement
  FROM public.user_achievements
  WHERE id = user_achievement_uuid
  FOR UPDATE;

  IF v_user_achievement.id IS NULL OR v_user_achievement.removed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Active user badge not found' USING ERRCODE = '42501';
  END IF;

  SELECT id, role, dom_id
  INTO v_target
  FROM public.profiles
  WHERE id = v_user_achievement.user_id;

  IF v_target.id IS NULL OR v_target.role IS DISTINCT FROM 'sub' OR v_target.dom_id IS DISTINCT FROM v_actor_id THEN
    RAISE EXCEPTION 'Only paired DOM can remove badges' USING ERRCODE = '42501';
  END IF;

  UPDATE public.user_achievements
  SET
    removed_at = timezone('utc'::text, now()),
    removed_by = v_actor_id,
    remove_reason = v_clean_reason
  WHERE id = v_user_achievement.id;

  RETURN jsonb_build_object(
    'removed', true,
    'user_achievement_id', v_user_achievement.id,
    'achievement_id', v_user_achievement.achievement_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_manual_discipline(UUID, INTEGER, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_user_badge(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_user_badge(UUID, TEXT) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'on_achievements_updated'
  ) THEN
    CREATE TRIGGER on_achievements_updated
      BEFORE UPDATE ON public.achievements
      FOR EACH ROW
      EXECUTE PROCEDURE public.handle_updated_at();
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
