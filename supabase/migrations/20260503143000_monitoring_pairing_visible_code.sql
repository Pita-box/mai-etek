-- Store the currently active pairing code for DOM display.
-- Old active codes only have a hash, so they are revoked instead of shown invisibly.

ALTER TABLE public.monitoring_pairing_codes
  ADD COLUMN IF NOT EXISTS display_code TEXT;

UPDATE public.monitoring_pairing_codes
SET revoked_at = timezone('utc'::text, now())
WHERE used_at IS NULL
  AND revoked_at IS NULL
  AND display_code IS NULL;

NOTIFY pgrst, 'reload schema';
