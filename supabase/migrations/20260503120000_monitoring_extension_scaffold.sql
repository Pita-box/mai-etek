-- Phase 4: Monitoring extension scaffold.
-- Adds pairing codes, paired device sessions, and future event metadata table.

CREATE TABLE IF NOT EXISTS public.monitoring_pairing_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dom_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sub_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  used_device_id UUID,
  revoked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT monitoring_pairing_codes_not_empty_hash CHECK (char_length(btrim(code_hash)) > 0),
  CONSTRAINT monitoring_pairing_codes_expire_after_create CHECK (expires_at > created_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS monitoring_pairing_codes_active_hash_idx
  ON public.monitoring_pairing_codes(code_hash)
  WHERE used_at IS NULL
    AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS monitoring_pairing_codes_dom_created_idx
  ON public.monitoring_pairing_codes(dom_id, created_at DESC);

CREATE INDEX IF NOT EXISTS monitoring_pairing_codes_sub_created_idx
  ON public.monitoring_pairing_codes(sub_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.monitoring_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dom_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sub_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Zařízení 1',
  token_hash TEXT NOT NULL UNIQUE,
  paired_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  last_heartbeat_at TIMESTAMP WITH TIME ZONE,
  last_seen_at TIMESTAMP WITH TIME ZONE,
  extension_version TEXT,
  sync_status TEXT NOT NULL DEFAULT 'connected',
  pending_items INTEGER NOT NULL DEFAULT 0 CHECK (pending_items >= 0),
  last_error TEXT,
  revoked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT monitoring_devices_not_empty_name CHECK (char_length(btrim(name)) > 0),
  CONSTRAINT monitoring_devices_not_empty_hash CHECK (char_length(btrim(token_hash)) > 0),
  CONSTRAINT monitoring_devices_sync_status_check
    CHECK (sync_status IN ('connected', 'pending', 'error', 'revoked'))
);

CREATE INDEX IF NOT EXISTS monitoring_devices_dom_created_idx
  ON public.monitoring_devices(dom_id, created_at DESC);

CREATE INDEX IF NOT EXISTS monitoring_devices_sub_created_idx
  ON public.monitoring_devices(sub_id, created_at DESC);

CREATE INDEX IF NOT EXISTS monitoring_devices_last_seen_idx
  ON public.monitoring_devices(last_seen_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'monitoring_pairing_codes_used_device_fkey'
  ) THEN
    ALTER TABLE public.monitoring_pairing_codes
      ADD CONSTRAINT monitoring_pairing_codes_used_device_fkey
      FOREIGN KEY (used_device_id)
      REFERENCES public.monitoring_devices(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.monitoring_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID REFERENCES public.monitoring_devices(id) ON DELETE SET NULL,
  dom_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sub_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT monitoring_events_not_empty_type CHECK (char_length(btrim(event_type)) > 0)
);

CREATE INDEX IF NOT EXISTS monitoring_events_dom_occurred_idx
  ON public.monitoring_events(dom_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS monitoring_events_device_occurred_idx
  ON public.monitoring_events(device_id, occurred_at DESC);

ALTER TABLE public.monitoring_pairing_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "DOM can read own monitoring pairing codes" ON public.monitoring_pairing_codes;
CREATE POLICY "DOM can read own monitoring pairing codes"
  ON public.monitoring_pairing_codes
  FOR SELECT
  TO authenticated
  USING (
    dom_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles dom_profile
      WHERE dom_profile.id = auth.uid()
        AND dom_profile.role = 'dom'
    )
  );

DROP POLICY IF EXISTS "DOM can create own monitoring pairing codes" ON public.monitoring_pairing_codes;
CREATE POLICY "DOM can create own monitoring pairing codes"
  ON public.monitoring_pairing_codes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    dom_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles sub_profile
      WHERE sub_profile.id = sub_id
        AND sub_profile.role = 'sub'
        AND sub_profile.dom_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "DOM can update own monitoring pairing codes" ON public.monitoring_pairing_codes;
CREATE POLICY "DOM can update own monitoring pairing codes"
  ON public.monitoring_pairing_codes
  FOR UPDATE
  TO authenticated
  USING (
    dom_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles dom_profile
      WHERE dom_profile.id = auth.uid()
        AND dom_profile.role = 'dom'
    )
  )
  WITH CHECK (
    dom_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles sub_profile
      WHERE sub_profile.id = sub_id
        AND sub_profile.role = 'sub'
        AND sub_profile.dom_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "DOM can read own monitoring devices" ON public.monitoring_devices;
CREATE POLICY "DOM can read own monitoring devices"
  ON public.monitoring_devices
  FOR SELECT
  TO authenticated
  USING (
    dom_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles dom_profile
      WHERE dom_profile.id = auth.uid()
        AND dom_profile.role = 'dom'
    )
  );

DROP POLICY IF EXISTS "DOM can update own monitoring devices" ON public.monitoring_devices;
CREATE POLICY "DOM can update own monitoring devices"
  ON public.monitoring_devices
  FOR UPDATE
  TO authenticated
  USING (
    dom_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles dom_profile
      WHERE dom_profile.id = auth.uid()
        AND dom_profile.role = 'dom'
    )
  )
  WITH CHECK (
    dom_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles sub_profile
      WHERE sub_profile.id = sub_id
        AND sub_profile.role = 'sub'
        AND sub_profile.dom_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "DOM can read own monitoring events" ON public.monitoring_events;
CREATE POLICY "DOM can read own monitoring events"
  ON public.monitoring_events
  FOR SELECT
  TO authenticated
  USING (
    dom_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles dom_profile
      WHERE dom_profile.id = auth.uid()
        AND dom_profile.role = 'dom'
    )
  );

DROP TRIGGER IF EXISTS on_monitoring_devices_updated ON public.monitoring_devices;
CREATE TRIGGER on_monitoring_devices_updated
  BEFORE UPDATE ON public.monitoring_devices
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

NOTIFY pgrst, 'reload schema';
