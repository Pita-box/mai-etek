-- Add punishment templates and assigned punishment instances.
-- The current app uses auth.users + public.profiles, not the legacy public.users table.

CREATE TABLE IF NOT EXISTS public.punishments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 255),
  description TEXT,
  severity INTEGER NOT NULL DEFAULT 1 CHECK (severity BETWEEN 1 AND 5),
  is_template BOOLEAN NOT NULL DEFAULT false,
  template_id UUID REFERENCES public.punishments(id) ON DELETE SET NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'submitted', 'completed', 'cancelled')),
  completion_note TEXT,
  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT punishments_template_shape_check CHECK (
    (
      is_template = true
      AND assigned_to IS NULL
      AND task_id IS NULL
      AND template_id IS NULL
      AND status = 'assigned'
      AND completion_note IS NULL
      AND completed_by IS NULL
      AND completed_at IS NULL
      AND verified_by IS NULL
      AND verified_at IS NULL
    )
    OR
    (
      is_template = false
      AND assigned_to IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS punishments_template_idx
  ON public.punishments(is_template, severity, created_at DESC);

CREATE INDEX IF NOT EXISTS punishments_assigned_status_idx
  ON public.punishments(assigned_to, status, created_at DESC)
  WHERE is_template = false;

CREATE INDEX IF NOT EXISTS punishments_task_id_idx
  ON public.punishments(task_id)
  WHERE task_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS punishments_created_by_idx
  ON public.punishments(created_by, created_at DESC);

DROP TRIGGER IF EXISTS on_punishments_updated ON public.punishments;
CREATE TRIGGER on_punishments_updated
  BEFORE UPDATE ON public.punishments
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

ALTER TABLE public.punishments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "DOM can read own punishment templates" ON public.punishments;
DROP POLICY IF EXISTS "DOM can read pair punishments" ON public.punishments;
DROP POLICY IF EXISTS "Assigned SUB can read own punishments" ON public.punishments;
DROP POLICY IF EXISTS "DOM can create punishment templates" ON public.punishments;
DROP POLICY IF EXISTS "DOM can assign punishments to own SUB" ON public.punishments;
DROP POLICY IF EXISTS "DOM can update own punishment templates" ON public.punishments;
DROP POLICY IF EXISTS "DOM can update pair punishments" ON public.punishments;
DROP POLICY IF EXISTS "Assigned SUB can submit own punishments" ON public.punishments;
DROP POLICY IF EXISTS "DOM can delete own punishment templates" ON public.punishments;

CREATE POLICY "DOM can read own punishment templates"
  ON public.punishments
  FOR SELECT
  TO authenticated
  USING (
    is_template = true
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'dom'
    )
  );

CREATE POLICY "DOM can read pair punishments"
  ON public.punishments
  FOR SELECT
  TO authenticated
  USING (
    is_template = false
    AND EXISTS (
      SELECT 1
      FROM public.profiles assigned_profile
      WHERE assigned_profile.id = punishments.assigned_to
        AND assigned_profile.dom_id = auth.uid()
    )
  );

CREATE POLICY "Assigned SUB can read own punishments"
  ON public.punishments
  FOR SELECT
  TO authenticated
  USING (
    is_template = false
    AND assigned_to = auth.uid()
  );

CREATE POLICY "DOM can create punishment templates"
  ON public.punishments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_template = true
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'dom'
    )
  );

CREATE POLICY "DOM can assign punishments to own SUB"
  ON public.punishments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_template = false
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles assigned_profile
      WHERE assigned_profile.id = punishments.assigned_to
        AND assigned_profile.dom_id = auth.uid()
    )
    AND (
      task_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.tasks
        WHERE tasks.id = punishments.task_id
          AND tasks.assigned_by = auth.uid()
          AND tasks.assigned_to = punishments.assigned_to
      )
    )
  );

CREATE POLICY "DOM can update own punishment templates"
  ON public.punishments
  FOR UPDATE
  TO authenticated
  USING (
    is_template = true
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'dom'
    )
  )
  WITH CHECK (
    is_template = true
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'dom'
    )
  );

CREATE POLICY "DOM can update pair punishments"
  ON public.punishments
  FOR UPDATE
  TO authenticated
  USING (
    is_template = false
    AND EXISTS (
      SELECT 1
      FROM public.profiles assigned_profile
      WHERE assigned_profile.id = punishments.assigned_to
        AND assigned_profile.dom_id = auth.uid()
    )
  )
  WITH CHECK (
    is_template = false
    AND EXISTS (
      SELECT 1
      FROM public.profiles assigned_profile
      WHERE assigned_profile.id = punishments.assigned_to
        AND assigned_profile.dom_id = auth.uid()
    )
  );

CREATE POLICY "Assigned SUB can submit own punishments"
  ON public.punishments
  FOR UPDATE
  TO authenticated
  USING (
    is_template = false
    AND assigned_to = auth.uid()
    AND status = 'assigned'
  )
  WITH CHECK (
    is_template = false
    AND assigned_to = auth.uid()
    AND status = 'submitted'
  );

CREATE POLICY "DOM can delete own punishment templates"
  ON public.punishments
  FOR DELETE
  TO authenticated
  USING (
    is_template = true
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'dom'
    )
  );

DROP POLICY IF EXISTS "Punishment participants can create notifications" ON public.notifications;

CREATE POLICY "Punishment participants can create notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND type IN (
      'punishment_assigned',
      'punishment_submitted',
      'punishment_completed',
      'punishment_cancelled'
    )
    AND (
      EXISTS (
        SELECT 1
        FROM public.profiles recipient
        WHERE recipient.id = notifications.user_id
          AND recipient.dom_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.profiles actor
        WHERE actor.id = auth.uid()
          AND actor.dom_id = notifications.user_id
      )
    )
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'punishments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.punishments;
  END IF;
END $$;
