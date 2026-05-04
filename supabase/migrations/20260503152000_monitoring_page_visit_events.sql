-- Page visit sync support for the MMM extension.

ALTER TABLE public.monitoring_events
  ADD COLUMN IF NOT EXISTS source_event_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS monitoring_events_device_source_event_idx
  ON public.monitoring_events(device_id, source_event_id);

CREATE INDEX IF NOT EXISTS monitoring_events_dom_type_occurred_idx
  ON public.monitoring_events(dom_id, event_type, occurred_at DESC);

NOTIFY pgrst, 'reload schema';
