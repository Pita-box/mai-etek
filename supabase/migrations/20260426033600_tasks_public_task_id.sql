-- Add short public task IDs for URL-safe task detail routes.
-- The internal primary key remains the full UUID; public_task_id is a stable alias.
DO $$
BEGIN
  IF to_regclass('public.tasks') IS NOT NULL THEN
    ALTER TABLE public.tasks
      ADD COLUMN IF NOT EXISTS public_task_id TEXT
      GENERATED ALWAYS AS (right(replace(id::text, '-', ''), 12)) STORED;

    CREATE UNIQUE INDEX IF NOT EXISTS tasks_public_task_id_key
      ON public.tasks(public_task_id);
  END IF;
END $$;
