ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_online_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS profiles_last_online_at_idx
ON public.profiles(last_online_at DESC);

UPDATE public.profiles
SET last_online_at = COALESCE(last_online_at, updated_at, timezone('utc'::text, now()))
WHERE last_online_at IS NULL;
