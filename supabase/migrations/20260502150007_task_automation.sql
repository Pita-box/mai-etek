-- Phase 3: task expiry worker and recurring task generator.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS recurrence_config JSONB,
  ADD COLUMN IF NOT EXISTS recurrence_instance_date DATE,
  ADD COLUMN IF NOT EXISTS expiry_penalty_points INTEGER NOT NULL DEFAULT 0 CHECK (expiry_penalty_points >= 0),
  ADD COLUMN IF NOT EXISTS expiry_penalty_reason TEXT,
  ADD COLUMN IF NOT EXISTS expired_at TIMESTAMP WITH TIME ZONE;

UPDATE public.tasks
SET recurrence_config = '{}'::jsonb
WHERE recurrence_config IS NULL;

ALTER TABLE public.tasks
  ALTER COLUMN recurrence_config SET DEFAULT '{}'::jsonb,
  ALTER COLUMN recurrence_config SET NOT NULL;

DO $$
DECLARE
  v_parent_task_attnum SMALLINT;
BEGIN
  SELECT attnum
  INTO v_parent_task_attnum
  FROM pg_attribute
  WHERE attrelid = 'public.tasks'::regclass
    AND attname = 'parent_task_id'
    AND NOT attisdropped;

  IF v_parent_task_attnum IS NULL THEN
    ALTER TABLE public.tasks
      ADD COLUMN parent_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL;
  ELSIF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.tasks'::regclass
      AND contype = 'f'
      AND confrelid = 'public.tasks'::regclass
      AND conkey = ARRAY[v_parent_task_attnum]
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_parent_task_id_fkey
      FOREIGN KEY (parent_task_id)
      REFERENCES public.tasks(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS tasks_due_expiry_idx
  ON public.tasks(deadline, status)
  WHERE deadline IS NOT NULL
    AND status IN (
      'pending'::public.task_status,
      'in_progress'::public.task_status,
      'revision_requested'::public.task_status
    )
    AND NOT (
      parent_task_id IS NULL
      AND recurrence IS NOT NULL
      AND recurrence <> 'none'::public.recurrence_type
    );

CREATE INDEX IF NOT EXISTS tasks_recurring_templates_idx
  ON public.tasks(recurrence, parent_task_id, deadline)
  WHERE recurrence IS NOT NULL
    AND recurrence <> 'none'::public.recurrence_type
    AND parent_task_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tasks_recurring_instance_unique_idx
  ON public.tasks(parent_task_id, recurrence_instance_date)
  WHERE parent_task_id IS NOT NULL
    AND recurrence_instance_date IS NOT NULL;

CREATE OR REPLACE FUNCTION public.expire_due_tasks(run_limit INTEGER DEFAULT 100)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INTEGER := GREATEST(COALESCE(run_limit, 100), 1);
  v_task public.tasks%ROWTYPE;
  v_expired_count INTEGER := 0;
  v_penalized_count INTEGER := 0;
  v_penalty_points INTEGER;
  v_penalty_reason TEXT;
  v_transaction_id UUID;
BEGIN
  FOR v_task IN
    WITH due_tasks AS (
      SELECT tasks.*
      FROM public.tasks
      WHERE tasks.deadline IS NOT NULL
        AND tasks.deadline < now()
        AND tasks.status IN (
          'pending'::public.task_status,
          'in_progress'::public.task_status,
          'revision_requested'::public.task_status
        )
        AND NOT (
          tasks.parent_task_id IS NULL
          AND tasks.recurrence IS NOT NULL
          AND tasks.recurrence <> 'none'::public.recurrence_type
        )
      ORDER BY tasks.deadline ASC
      LIMIT v_limit
      FOR UPDATE SKIP LOCKED
    )
    UPDATE public.tasks
    SET
      status = 'expired'::public.task_status,
      expired_at = COALESCE(public.tasks.expired_at, now()),
      updated_at = now()
    FROM due_tasks
    WHERE public.tasks.id = due_tasks.id
      AND public.tasks.status IN (
        'pending'::public.task_status,
        'in_progress'::public.task_status,
        'revision_requested'::public.task_status
      )
    RETURNING public.tasks.*
  LOOP
    v_expired_count := v_expired_count + 1;
    v_penalty_points := GREATEST(COALESCE(v_task.expiry_penalty_points, 0), 0);
    v_penalty_reason := COALESCE(
      NULLIF(btrim(COALESCE(v_task.expiry_penalty_reason, '')), ''),
      'Prošlý úkol: ' || COALESCE(v_task.title, 'Úkol')
    );

    INSERT INTO public.user_stats (user_id)
    VALUES (v_task.assigned_to)
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE public.user_stats
    SET
      tasks_failed = tasks_failed + 1,
      current_streak = 0,
      updated_at = now()
    WHERE user_id = v_task.assigned_to;

    IF v_penalty_points > 0 THEN
      v_transaction_id := NULL;

      INSERT INTO public.xp_transactions (
        user_id,
        source_type,
        source_id,
        discipline_delta,
        reason,
        created_by
      )
      VALUES (
        v_task.assigned_to,
        'task_expiry_penalty',
        v_task.id,
        v_penalty_points,
        v_penalty_reason,
        v_task.assigned_by
      )
      ON CONFLICT (user_id, source_type, source_id)
      WHERE source_id IS NOT NULL
      DO NOTHING
      RETURNING id INTO v_transaction_id;

      IF v_transaction_id IS NOT NULL THEN
        UPDATE public.user_stats
        SET
          discipline_points = discipline_points + v_penalty_points,
          updated_at = now()
        WHERE user_id = v_task.assigned_to;

        v_penalized_count := v_penalized_count + 1;
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
      v_task.assigned_to,
      v_task.assigned_by,
      v_task.id,
      'tasks',
      'task',
      v_task.id,
      'Úkol prošel',
      'Termín úkolu "' || COALESCE(v_task.title, 'Úkol') || '" vypršel.',
      'task_expired',
      jsonb_build_object(
        'source', 'task_expiry_worker',
        'expiry_penalty_points', v_penalty_points
      ),
      'task_expired:' || v_task.id::text || ':sub'
    )
    ON CONFLICT (user_id, dedupe_key)
    WHERE dedupe_key IS NOT NULL
      AND read_at IS NULL
    DO NOTHING;

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
      v_task.assigned_by,
      v_task.assigned_to,
      v_task.id,
      'tasks',
      'task',
      v_task.id,
      'SUB nesplnil úkol včas',
      'Úkol "' || COALESCE(v_task.title, 'Úkol') || '" prošel bez schváleného odevzdání.',
      'task_expired',
      jsonb_build_object(
        'source', 'task_expiry_worker',
        'expiry_penalty_points', v_penalty_points
      ),
      'task_expired:' || v_task.id::text || ':dom'
    )
    ON CONFLICT (user_id, dedupe_key)
    WHERE dedupe_key IS NOT NULL
      AND read_at IS NULL
    DO NOTHING;
  END LOOP;

  RETURN jsonb_build_object(
    'expired_count', v_expired_count,
    'penalized_count', v_penalized_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_recurring_tasks(
  p_run_date DATE DEFAULT NULL,
  run_limit INTEGER DEFAULT 100
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_date DATE := COALESCE(p_run_date, (timezone('Europe/Prague', now()))::date);
  v_limit INTEGER := GREATEST(COALESCE(run_limit, 100), 1);
  v_template public.tasks%ROWTYPE;
  v_deadline TIMESTAMP WITH TIME ZONE;
  v_instance_id UUID;
  v_generated_count INTEGER := 0;
BEGIN
  FOR v_template IN
    SELECT tasks.*
    FROM public.tasks
    WHERE tasks.parent_task_id IS NULL
      AND tasks.deadline IS NOT NULL
      AND (tasks.deadline AT TIME ZONE 'Europe/Prague')::date <= v_run_date
      AND tasks.recurrence IS NOT NULL
      AND tasks.recurrence <> 'none'::public.recurrence_type
      AND tasks.status NOT IN (
        'cancelled'::public.task_status,
        'expired'::public.task_status
      )
      AND (
        tasks.recurrence = 'daily'::public.recurrence_type
        OR (
          tasks.recurrence = 'weekly'::public.recurrence_type
          AND EXTRACT(ISODOW FROM (tasks.deadline AT TIME ZONE 'Europe/Prague')) =
            EXTRACT(ISODOW FROM v_run_date::timestamp)
        )
        OR (
          tasks.recurrence = 'monthly'::public.recurrence_type
          AND EXTRACT(DAY FROM (tasks.deadline AT TIME ZONE 'Europe/Prague')) =
            EXTRACT(DAY FROM v_run_date::timestamp)
        )
      )
    ORDER BY tasks.deadline ASC
    LIMIT v_limit
  LOOP
    v_deadline := (
      v_run_date::timestamp
      + (v_template.deadline AT TIME ZONE 'Europe/Prague')::time
    ) AT TIME ZONE 'Europe/Prague';
    v_instance_id := NULL;

    INSERT INTO public.tasks (
      title,
      description,
      assigned_by,
      assigned_to,
      status,
      priority,
      points_reward,
      deadline,
      recurrence,
      recurrence_config,
      parent_task_id,
      recurrence_instance_date,
      expiry_penalty_points,
      expiry_penalty_reason
    )
    VALUES (
      v_template.title,
      v_template.description,
      v_template.assigned_by,
      v_template.assigned_to,
      'in_progress'::public.task_status,
      v_template.priority,
      v_template.points_reward,
      v_deadline,
      'none'::public.recurrence_type,
      '{}'::jsonb,
      v_template.id,
      v_run_date,
      COALESCE(v_template.expiry_penalty_points, 0),
      v_template.expiry_penalty_reason
    )
    ON CONFLICT (parent_task_id, recurrence_instance_date)
    WHERE parent_task_id IS NOT NULL
      AND recurrence_instance_date IS NOT NULL
    DO NOTHING
    RETURNING id INTO v_instance_id;

    IF v_instance_id IS NOT NULL THEN
      v_generated_count := v_generated_count + 1;

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
        v_template.assigned_to,
        v_template.assigned_by,
        v_instance_id,
        'tasks',
        'task',
        v_instance_id,
        'Nový opakovaný úkol',
        'DOM naplánoval opakovaný úkol: ' || COALESCE(v_template.title, 'Úkol'),
        'task_created',
        jsonb_build_object(
          'source', 'task_recurring_generator',
          'template_task_id', v_template.id,
          'recurrence_instance_date', v_run_date
        ),
        'task_recurring_created:' || v_instance_id::text || ':sub'
      )
      ON CONFLICT (user_id, dedupe_key)
      WHERE dedupe_key IS NOT NULL
        AND read_at IS NULL
      DO NOTHING;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'generated_count', v_generated_count,
    'run_date', v_run_date
  );
END;
$$;

REVOKE ALL ON FUNCTION public.expire_due_tasks(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_recurring_tasks(DATE, INTEGER) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.expire_due_tasks(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_recurring_tasks(DATE, INTEGER) TO service_role;

NOTIFY pgrst, 'reload schema';
