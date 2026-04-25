-- Phase 1: Database Schema Updates for Superpowers

-- Step 1.1: Update profiles table
ALTER TABLE public.profiles 
ADD COLUMN dom_id UUID REFERENCES public.profiles(id),
ADD COLUMN app_config JSONB DEFAULT '{}'::jsonb,
ADD COLUMN role TEXT DEFAULT 'unassigned' CHECK (role IN ('unassigned', 'sub', 'dom'));

-- Step 1.2: Create user_vault table
CREATE TABLE IF NOT EXISTS public.user_vault (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  encrypted_password TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on user_vault
ALTER TABLE public.user_vault ENABLE ROW LEVEL SECURITY;

-- Ensure only service role / backend API can insert and read from this table.
-- No policies means it's fully locked down to standard users, only accessible by service_role
CREATE POLICY "Service role has full access to user_vault"
  ON public.user_vault
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Update trigger function for updated_at on user_vault
CREATE TRIGGER on_user_vault_updated
  BEFORE UPDATE ON public.user_vault
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();
