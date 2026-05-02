-- Phase 3: Gamification core.
-- Adds XP stats, rewards, achievements, and activity badge support.

CREATE TABLE IF NOT EXISTS public.user_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_points INTEGER NOT NULL DEFAULT 0 CHECK (total_points >= 0),
  available_points INTEGER NOT NULL DEFAULT 0 CHECK (available_points >= 0),
  level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
  tasks_completed INTEGER NOT NULL DEFAULT 0 CHECK (tasks_completed >= 0),
  tasks_failed INTEGER NOT NULL DEFAULT 0 CHECK (tasks_failed >= 0),
  perfect_rating_count INTEGER NOT NULL DEFAULT 0 CHECK (perfect_rating_count >= 0),
  current_streak INTEGER NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  longest_streak INTEGER NOT NULL DEFAULT 0 CHECK (longest_streak >= 0),
  last_completed_on DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.xp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('task_award', 'reward_claim', 'reward_refund', 'manual_adjustment')),
  source_id UUID,
  points_delta INTEGER NOT NULL DEFAULT 0,
  available_delta INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CHECK (points_delta <> 0 OR available_delta <> 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS xp_transactions_unique_source_idx
  ON public.xp_transactions(user_id, source_type, source_id)
  WHERE source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS xp_transactions_user_created_idx
  ON public.xp_transactions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (char_length(btrim(title)) > 0),
  description TEXT,
  cost_points INTEGER NOT NULL CHECK (cost_points > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS rewards_active_created_idx
  ON public.rewards(is_active, deleted_at, created_at DESC);

CREATE TABLE IF NOT EXISTS public.reward_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_id UUID NOT NULL REFERENCES public.rewards(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_title TEXT NOT NULL,
  reward_description TEXT,
  cost_points INTEGER NOT NULL CHECK (cost_points > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS reward_claims_user_created_idx
  ON public.reward_claims(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS reward_claims_status_created_idx
  ON public.reward_claims(status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS reward_claims_one_pending_per_reward_idx
  ON public.reward_claims(user_id, reward_id)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  condition_type TEXT NOT NULL CHECK (condition_type IN ('points', 'level', 'streak', 'tasks_completed', 'perfect_rating_count')),
  condition_value INTEGER NOT NULL CHECK (condition_value > 0),
  icon_name TEXT NOT NULL DEFAULT 'trophy',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  source_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS user_achievements_user_unlocked_idx
  ON public.user_achievements(user_id, unlocked_at DESC);

ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users and paired DOM can read user stats" ON public.user_stats;
CREATE POLICY "Users and paired DOM can read user stats"
  ON public.user_stats
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.profiles target
      JOIN public.profiles viewer ON viewer.id = auth.uid()
      WHERE target.id = user_stats.user_id
        AND viewer.role = 'dom'
        AND target.dom_id = viewer.id
    )
  );

DROP POLICY IF EXISTS "Users and paired DOM can read xp transactions" ON public.xp_transactions;
CREATE POLICY "Users and paired DOM can read xp transactions"
  ON public.xp_transactions
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.profiles target
      JOIN public.profiles viewer ON viewer.id = auth.uid()
      WHERE target.id = xp_transactions.user_id
        AND viewer.role = 'dom'
        AND target.dom_id = viewer.id
    )
  );

DROP POLICY IF EXISTS "Authenticated users can read visible rewards" ON public.rewards;
CREATE POLICY "Authenticated users can read visible rewards"
  ON public.rewards
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND (
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
        is_active = true
        AND EXISTS (
          SELECT 1
          FROM public.profiles
          WHERE profiles.id = auth.uid()
            AND profiles.role = 'sub'
            AND profiles.dom_id = rewards.created_by
        )
      )
      OR EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'dom'
          AND rewards.created_by IS NULL
      )
    )
  );

DROP POLICY IF EXISTS "DOM can create rewards" ON public.rewards;
CREATE POLICY "DOM can create rewards"
  ON public.rewards
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

DROP POLICY IF EXISTS "DOM can update rewards" ON public.rewards;
CREATE POLICY "DOM can update rewards"
  ON public.rewards
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

DROP POLICY IF EXISTS "Users and paired DOM can read reward claims" ON public.reward_claims;
CREATE POLICY "Users and paired DOM can read reward claims"
  ON public.reward_claims
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.profiles target
      JOIN public.profiles viewer ON viewer.id = auth.uid()
      WHERE target.id = reward_claims.user_id
        AND viewer.role = 'dom'
        AND target.dom_id = viewer.id
    )
  );

DROP POLICY IF EXISTS "Authenticated users can read achievements" ON public.achievements;
CREATE POLICY "Authenticated users can read achievements"
  ON public.achievements
  FOR SELECT
  TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "Users and paired DOM can read user achievements" ON public.user_achievements;
CREATE POLICY "Users and paired DOM can read user achievements"
  ON public.user_achievements
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.profiles target
      JOIN public.profiles viewer ON viewer.id = auth.uid()
      WHERE target.id = user_achievements.user_id
        AND viewer.role = 'dom'
        AND target.dom_id = viewer.id
    )
  );

CREATE OR REPLACE FUNCTION public.calculate_user_level(points INTEGER)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT GREATEST(1, floor(GREATEST(COALESCE(points, 0), 0)::numeric / 100)::integer + 1);
$$;

CREATE OR REPLACE FUNCTION public.can_view_gamification_user(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() = target_user_id
    OR EXISTS (
      SELECT 1
      FROM public.profiles target
      JOIN public.profiles viewer ON viewer.id = auth.uid()
      WHERE target.id = target_user_id
        AND viewer.role = 'dom'
        AND target.dom_id = viewer.id
    );
$$;

INSERT INTO public.achievements (
  slug,
  title,
  description,
  condition_type,
  condition_value,
  icon_name,
  sort_order
)
VALUES
  ('first_steps', 'První kroky', 'Dokonči první schválený úkol.', 'tasks_completed', 1, 'trophy', 10),
  ('ten_tasks', 'Deset úkolů', 'Dokonči 10 schválených úkolů.', 'tasks_completed', 10, 'clipboard-check', 20),
  ('dedicated', 'Oddanost', 'Dokonči 25 schválených úkolů.', 'tasks_completed', 25, 'star', 30),
  ('first_100_xp', 'Prvních 100 XP', 'Získej celkem 100 XP.', 'points', 100, 'coins', 40),
  ('level_5', 'Level 5', 'Dosáhni levelu 5.', 'level', 5, 'trending-up', 50),
  ('on_fire', 'V plameni', 'Udrž sérii 3 dnů.', 'streak', 3, 'flame', 60),
  ('unstoppable', 'Nepřerušeno', 'Udrž sérii 7 dnů.', 'streak', 7, 'calendar-days', 70),
  ('perfect_touch', 'Perfektní výkon', 'Získej první pětihvězdičkové schválení.', 'perfect_rating_count', 1, 'check-circle', 80),
  ('perfectionist', 'Perfekcionista', 'Získej 10 pětihvězdičkových schválení.', 'perfect_rating_count', 10, 'sparkles', 90)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  condition_type = EXCLUDED.condition_type,
  condition_value = EXCLUDED.condition_value,
  icon_name = EXCLUDED.icon_name,
  sort_order = EXCLUDED.sort_order,
  is_active = true;

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_page_key_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_page_key_check
  CHECK (page_key IN ('tasks', 'wishes', 'gallery', 'rewards', 'achievements', 'chat', 'monitoring', 'security', 'presence', 'default'));

CREATE OR REPLACE FUNCTION public.create_activity_notification(
  p_user_id UUID,
  p_page_key TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_type TEXT DEFAULT 'activity',
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_dedupe_key TEXT DEFAULT NULL,
  p_task_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_actor RECORD;
  v_recipient RECORD;
  v_task RECORD;
  v_wish RECORD;
  v_gallery_media RECORD;
  v_reward_claim RECORD;
  v_user_achievement RECORD;
  v_notification_id UUID;
  v_task_id UUID;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_user_id IS NULL OR p_user_id = v_actor_id THEN
    RETURN NULL;
  END IF;

  IF p_page_key NOT IN ('tasks', 'wishes', 'gallery', 'rewards', 'achievements') THEN
    RAISE EXCEPTION 'Unsupported notification page: %', p_page_key USING ERRCODE = '22023';
  END IF;

  IF p_entity_id IS NULL THEN
    RAISE EXCEPTION 'Notification entity is required' USING ERRCODE = '22023';
  END IF;

  SELECT id, role, dom_id
  INTO v_actor
  FROM public.profiles
  WHERE id = v_actor_id;

  SELECT id, role, dom_id
  INTO v_recipient
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_actor.id IS NULL OR v_recipient.id IS NULL THEN
    RAISE EXCEPTION 'Notification participant profile not found' USING ERRCODE = '42501';
  END IF;

  IF p_page_key = 'tasks' THEN
    v_task_id := COALESCE(p_task_id, p_entity_id);

    SELECT id, assigned_by, assigned_to
    INTO v_task
    FROM public.tasks
    WHERE id = v_task_id;

    IF v_task.id IS NULL THEN
      RAISE EXCEPTION 'Task not found' USING ERRCODE = '42501';
    END IF;

    IF p_entity_type IS DISTINCT FROM 'task' THEN
      RAISE EXCEPTION 'Invalid task notification entity type' USING ERRCODE = '22023';
    END IF;

    IF v_actor_id NOT IN (v_task.assigned_by, v_task.assigned_to)
      OR p_user_id NOT IN (v_task.assigned_by, v_task.assigned_to)
    THEN
      RAISE EXCEPTION 'Task notification denied' USING ERRCODE = '42501';
    END IF;
  ELSIF p_page_key = 'wishes' THEN
    SELECT wishes.id, wishes.created_by, owner.dom_id
    INTO v_wish
    FROM public.wishes
    JOIN public.profiles owner ON owner.id = wishes.created_by
    WHERE wishes.id = p_entity_id;

    IF v_wish.id IS NULL THEN
      RAISE EXCEPTION 'Wish not found' USING ERRCODE = '42501';
    END IF;

    IF p_entity_type IS DISTINCT FROM 'wish' THEN
      RAISE EXCEPTION 'Invalid wish notification entity type' USING ERRCODE = '22023';
    END IF;

    IF NOT (
      (v_actor_id = v_wish.created_by AND p_user_id = v_wish.dom_id)
      OR (v_actor_id = v_wish.dom_id AND p_user_id = v_wish.created_by)
    ) THEN
      RAISE EXCEPTION 'Wish notification denied' USING ERRCODE = '42501';
    END IF;
  ELSIF p_page_key = 'gallery' THEN
    SELECT id, uploaded_by
    INTO v_gallery_media
    FROM public.gallery_media
    WHERE id = p_entity_id
      AND deleted_at IS NULL;

    IF v_gallery_media.id IS NULL THEN
      RAISE EXCEPTION 'Gallery media not found' USING ERRCODE = '42501';
    END IF;

    IF p_entity_type IS DISTINCT FROM 'gallery_media' THEN
      RAISE EXCEPTION 'Invalid gallery notification entity type' USING ERRCODE = '22023';
    END IF;

    IF v_gallery_media.uploaded_by IS DISTINCT FROM v_actor_id THEN
      RAISE EXCEPTION 'Gallery notification actor denied' USING ERRCODE = '42501';
    END IF;

    IF NOT (
      (v_actor.role = 'sub' AND v_actor.dom_id = p_user_id AND v_recipient.role = 'dom')
      OR (v_actor.role = 'dom' AND v_recipient.dom_id = v_actor_id AND v_recipient.role = 'sub')
    ) THEN
      RAISE EXCEPTION 'Gallery notification recipient denied' USING ERRCODE = '42501';
    END IF;
  ELSIF p_page_key = 'rewards' THEN
    SELECT reward_claims.id, reward_claims.user_id, claimant.dom_id
    INTO v_reward_claim
    FROM public.reward_claims
    JOIN public.profiles claimant ON claimant.id = reward_claims.user_id
    WHERE reward_claims.id = p_entity_id;

    IF v_reward_claim.id IS NULL THEN
      RAISE EXCEPTION 'Reward claim not found' USING ERRCODE = '42501';
    END IF;

    IF p_entity_type IS DISTINCT FROM 'reward_claim' THEN
      RAISE EXCEPTION 'Invalid reward notification entity type' USING ERRCODE = '22023';
    END IF;

    IF NOT (
      (v_actor_id = v_reward_claim.user_id AND p_user_id = v_reward_claim.dom_id AND v_recipient.role = 'dom')
      OR (v_actor_id = v_reward_claim.dom_id AND p_user_id = v_reward_claim.user_id)
    ) THEN
      RAISE EXCEPTION 'Reward notification denied' USING ERRCODE = '42501';
    END IF;
  ELSIF p_page_key = 'achievements' THEN
    SELECT user_achievements.id, user_achievements.user_id, owner.dom_id
    INTO v_user_achievement
    FROM public.user_achievements
    JOIN public.profiles owner ON owner.id = user_achievements.user_id
    WHERE user_achievements.id = p_entity_id;

    IF v_user_achievement.id IS NULL THEN
      RAISE EXCEPTION 'User achievement not found' USING ERRCODE = '42501';
    END IF;

    IF p_entity_type IS DISTINCT FROM 'achievement' THEN
      RAISE EXCEPTION 'Invalid achievement notification entity type' USING ERRCODE = '22023';
    END IF;

    IF NOT (
      p_user_id = v_user_achievement.user_id
      AND (
        v_actor_id = v_user_achievement.dom_id
        OR v_actor_id = v_user_achievement.user_id
      )
    ) THEN
      RAISE EXCEPTION 'Achievement notification denied' USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public.notifications (
    user_id,
    actor_id,
    task_id,
    page_key,
    entity_type,
    entity_id,
    title,
    body,
    type,
    metadata,
    dedupe_key
  )
  VALUES (
    p_user_id,
    v_actor_id,
    CASE WHEN p_page_key = 'tasks' THEN COALESCE(p_task_id, p_entity_id) ELSE NULL END,
    p_page_key,
    p_entity_type,
    p_entity_id,
    COALESCE(NULLIF(btrim(p_title), ''), 'Nová aktivita'),
    COALESCE(NULLIF(btrim(p_body), ''), 'Nová aktivita čeká na zobrazení.'),
    COALESCE(NULLIF(btrim(p_type), ''), 'activity'),
    COALESCE(p_metadata, '{}'::jsonb),
    NULLIF(btrim(p_dedupe_key), '')
  )
  ON CONFLICT (user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL
    AND read_at IS NULL
  DO UPDATE SET
    actor_id = EXCLUDED.actor_id,
    task_id = EXCLUDED.task_id,
    page_key = EXCLUDED.page_key,
    entity_type = EXCLUDED.entity_type,
    entity_id = EXCLUDED.entity_id,
    title = EXCLUDED.title,
    body = EXCLUDED.body,
    type = EXCLUDED.type,
    metadata = EXCLUDED.metadata,
    created_at = timezone('utc'::text, now())
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

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
  v_unlocked_count INTEGER := 0;
  v_unlock RECORD;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT public.can_view_gamification_user(user_uuid) THEN
    RAISE EXCEPTION 'Achievement check denied' USING ERRCODE = '42501';
  END IF;

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
        AND NOT EXISTS (
          SELECT 1
          FROM public.user_achievements
          WHERE user_achievements.user_id = user_uuid
            AND user_achievements.achievement_id = achievements.id
        )
        AND (
          (achievements.condition_type = 'points' AND v_stats.total_points >= achievements.condition_value)
          OR (achievements.condition_type = 'level' AND v_stats.level >= achievements.condition_value)
          OR (achievements.condition_type = 'streak' AND v_stats.longest_streak >= achievements.condition_value)
          OR (achievements.condition_type = 'tasks_completed' AND v_stats.tasks_completed >= achievements.condition_value)
          OR (achievements.condition_type = 'perfect_rating_count' AND v_stats.perfect_rating_count >= achievements.condition_value)
        )
    )
    INSERT INTO public.user_achievements (user_id, achievement_id, source_task_id)
    SELECT user_uuid, eligible.id, source_task_uuid
    FROM eligible
    ON CONFLICT (user_id, achievement_id) DO NOTHING
    RETURNING id, achievement_id
  LOOP
    v_unlocked_count := v_unlocked_count + 1;

    PERFORM public.create_activity_notification(
      user_uuid,
      'achievements',
      'achievement',
      v_unlock.id,
      'Nový achievement',
      COALESCE(
        (
          SELECT title
          FROM public.achievements
          WHERE id = v_unlock.achievement_id
        ),
        'Achievement odemčen'
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

CREATE OR REPLACE FUNCTION public.award_task_xp(task_uuid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_task RECORD;
  v_stats public.user_stats%ROWTYPE;
  v_points INTEGER;
  v_completion_on DATE;
  v_current_streak INTEGER;
  v_longest_streak INTEGER;
  v_total_points INTEGER;
  v_available_points INTEGER;
  v_level INTEGER;
  v_unlocked_count INTEGER := 0;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT id, assigned_by, assigned_to, title, points_reward, rating, completed_at, xp_awarded_at
  INTO v_task
  FROM public.tasks
  WHERE id = task_uuid
  FOR UPDATE;

  IF v_task.id IS NULL THEN
    RAISE EXCEPTION 'Task not found' USING ERRCODE = '42501';
  END IF;

  IF v_task.assigned_by IS DISTINCT FROM v_actor_id THEN
    RAISE EXCEPTION 'Only assigning DOM can award task XP' USING ERRCODE = '42501';
  END IF;

  IF v_task.xp_awarded_at IS NOT NULL THEN
    SELECT *
    INTO v_stats
    FROM public.user_stats
    WHERE user_id = v_task.assigned_to;

    RETURN jsonb_build_object(
      'awarded', false,
      'reason', 'already_awarded',
      'total_points', COALESCE(v_stats.total_points, 0),
      'available_points', COALESCE(v_stats.available_points, 0),
      'level', COALESCE(v_stats.level, 1)
    );
  END IF;

  v_points := GREATEST(COALESCE(v_task.points_reward, 0), 0);
  v_completion_on := (COALESCE(v_task.completed_at, timezone('utc'::text, now())) AT TIME ZONE 'Europe/Prague')::date;

  INSERT INTO public.user_stats (user_id)
  VALUES (v_task.assigned_to)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT *
  INTO v_stats
  FROM public.user_stats
  WHERE user_id = v_task.assigned_to
  FOR UPDATE;

  IF v_stats.last_completed_on IS NULL THEN
    v_current_streak := 1;
  ELSIF v_stats.last_completed_on = v_completion_on THEN
    v_current_streak := v_stats.current_streak;
  ELSIF v_stats.last_completed_on = v_completion_on - 1 THEN
    v_current_streak := v_stats.current_streak + 1;
  ELSE
    v_current_streak := 1;
  END IF;

  v_longest_streak := GREATEST(v_stats.longest_streak, v_current_streak);
  v_total_points := v_stats.total_points + v_points;
  v_available_points := v_stats.available_points + v_points;
  v_level := public.calculate_user_level(v_total_points);

  UPDATE public.user_stats
  SET
    total_points = v_total_points,
    available_points = v_available_points,
    level = v_level,
    tasks_completed = tasks_completed + 1,
    perfect_rating_count = perfect_rating_count + CASE WHEN COALESCE(v_task.rating, 0) >= 5 THEN 1 ELSE 0 END,
    current_streak = v_current_streak,
    longest_streak = v_longest_streak,
    last_completed_on = GREATEST(COALESCE(last_completed_on, v_completion_on), v_completion_on),
    updated_at = timezone('utc'::text, now())
  WHERE user_id = v_task.assigned_to;

  IF v_points > 0 THEN
    INSERT INTO public.xp_transactions (
      user_id,
      source_type,
      source_id,
      points_delta,
      available_delta,
      reason,
      created_by
    )
    VALUES (
      v_task.assigned_to,
      'task_award',
      task_uuid,
      v_points,
      v_points,
      'XP za schválený úkol: ' || COALESCE(v_task.title, 'Úkol'),
      v_actor_id
    )
    ON CONFLICT (user_id, source_type, source_id)
    WHERE source_id IS NOT NULL
    DO NOTHING;
  END IF;

  UPDATE public.tasks
  SET xp_awarded_at = timezone('utc'::text, now())
  WHERE id = task_uuid
    AND xp_awarded_at IS NULL;

  v_unlocked_count := public.check_user_achievements(v_task.assigned_to, task_uuid);

  RETURN jsonb_build_object(
    'awarded', true,
    'points_awarded', v_points,
    'total_points', v_total_points,
    'available_points', v_available_points,
    'level', v_level,
    'unlocked_count', v_unlocked_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_reward(reward_uuid UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_profile RECORD;
  v_reward public.rewards%ROWTYPE;
  v_stats public.user_stats%ROWTYPE;
  v_claim_id UUID;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT id, role, dom_id
  INTO v_profile
  FROM public.profiles
  WHERE id = v_actor_id;

  IF v_profile.role IS DISTINCT FROM 'sub' THEN
    RAISE EXCEPTION 'Only SUB can claim rewards' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_reward
  FROM public.rewards
  WHERE id = reward_uuid
    AND deleted_at IS NULL
    AND created_by = v_profile.dom_id
  FOR UPDATE;

  IF v_reward.id IS NULL OR v_reward.is_active IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Reward is not available' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.reward_claims
    WHERE user_id = v_actor_id
      AND reward_id = reward_uuid
      AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Reward claim is already pending' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.user_stats (user_id)
  VALUES (v_actor_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT *
  INTO v_stats
  FROM public.user_stats
  WHERE user_id = v_actor_id
  FOR UPDATE;

  IF v_stats.available_points < v_reward.cost_points THEN
    RAISE EXCEPTION 'Not enough available XP' USING ERRCODE = '22023';
  END IF;

  UPDATE public.user_stats
  SET
    available_points = available_points - v_reward.cost_points,
    updated_at = timezone('utc'::text, now())
  WHERE user_id = v_actor_id;

  INSERT INTO public.reward_claims (
    reward_id,
    user_id,
    reward_title,
    reward_description,
    cost_points
  )
  VALUES (
    v_reward.id,
    v_actor_id,
    v_reward.title,
    v_reward.description,
    v_reward.cost_points
  )
  RETURNING id INTO v_claim_id;

  INSERT INTO public.xp_transactions (
    user_id,
    source_type,
    source_id,
    points_delta,
    available_delta,
    reason,
    created_by
  )
  VALUES (
    v_actor_id,
    'reward_claim',
    v_claim_id,
    0,
    -v_reward.cost_points,
    'Rezervace XP za odměnu: ' || v_reward.title,
    v_actor_id
  );

  RETURN v_claim_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_reward_claim(
  claim_uuid UUID,
  next_status TEXT,
  note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_claim public.reward_claims%ROWTYPE;
  v_claimant RECORD;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF next_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Unsupported reward claim status: %', next_status USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_claim
  FROM public.reward_claims
  WHERE id = claim_uuid
  FOR UPDATE;

  IF v_claim.id IS NULL THEN
    RAISE EXCEPTION 'Reward claim not found' USING ERRCODE = '42501';
  END IF;

  IF v_claim.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'Reward claim was already reviewed' USING ERRCODE = '22023';
  END IF;

  SELECT id, role, dom_id
  INTO v_claimant
  FROM public.profiles
  WHERE id = v_claim.user_id;

  IF v_claimant.dom_id IS DISTINCT FROM v_actor_id THEN
    RAISE EXCEPTION 'Only paired DOM can review this reward claim' USING ERRCODE = '42501';
  END IF;

  IF next_status = 'rejected' THEN
    INSERT INTO public.user_stats (user_id)
    VALUES (v_claim.user_id)
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE public.user_stats
    SET
      available_points = available_points + v_claim.cost_points,
      updated_at = timezone('utc'::text, now())
    WHERE user_id = v_claim.user_id;

    INSERT INTO public.xp_transactions (
      user_id,
      source_type,
      source_id,
      points_delta,
      available_delta,
      reason,
      created_by
    )
    VALUES (
      v_claim.user_id,
      'reward_refund',
      v_claim.id,
      0,
      v_claim.cost_points,
      'Vrácení XP za odmítnutou odměnu: ' || v_claim.reward_title,
      v_actor_id
    )
    ON CONFLICT (user_id, source_type, source_id)
    WHERE source_id IS NOT NULL
    DO NOTHING;
  END IF;

  UPDATE public.reward_claims
  SET
    status = next_status,
    reviewed_by = v_actor_id,
    reviewed_at = timezone('utc'::text, now()),
    review_note = NULLIF(btrim(COALESCE(note, '')), ''),
    updated_at = timezone('utc'::text, now())
  WHERE id = v_claim.id;

  RETURN jsonb_build_object(
    'claim_id', v_claim.id,
    'user_id', v_claim.user_id,
    'status', next_status,
    'reward_title', v_claim.reward_title,
    'cost_points', v_claim.cost_points
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_user_level(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_gamification_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_user_achievements(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_task_xp(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_reward(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_reward_claim(UUID, TEXT, TEXT) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'on_user_stats_updated'
  ) THEN
    CREATE TRIGGER on_user_stats_updated
      BEFORE UPDATE ON public.user_stats
      FOR EACH ROW
      EXECUTE PROCEDURE public.handle_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'on_rewards_updated'
  ) THEN
    CREATE TRIGGER on_rewards_updated
      BEFORE UPDATE ON public.rewards
      FOR EACH ROW
      EXECUTE PROCEDURE public.handle_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'on_reward_claims_updated'
  ) THEN
    CREATE TRIGGER on_reward_claims_updated
      BEFORE UPDATE ON public.reward_claims
      FOR EACH ROW
      EXECUTE PROCEDURE public.handle_updated_at();
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
