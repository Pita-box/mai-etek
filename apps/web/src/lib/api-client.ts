import { createClient } from '../utils/supabase/client';
import { getApiBaseUrl } from './api-url';

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  const headers = new Headers(options.headers);
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }
  if (!headers.has('Content-Type') && options.body instanceof URLSearchParams === false) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = 'An error occurred';
    try {
      const data = await response.json();
      errorMsg = data.error || errorMsg;
    } catch {
      // JSON parse failed
    }
    throw new Error(errorMsg);
  }

  return response.json();
}
