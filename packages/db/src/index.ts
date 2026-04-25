import { createClient } from '@supabase/supabase-js';

export const createStandardClient = () => {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
  return createClient(supabaseUrl, supabaseAnonKey);
};

export const createAdminClient = () => {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

export const getSupabaseClient = () => createStandardClient();
