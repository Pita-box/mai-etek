import { createAdminClient } from '@maietek/db';

export type AuthenticatedRequestUser = {
  id: string;
  user_metadata?: Record<string, unknown>;
};

export async function getAuthenticatedUserFromAuthorizationHeader(authorizationHeader?: string | null) {
  if (!authorizationHeader) {
    return { user: null, error: 'No authorization header', status: 401 as const };
  }

  const token = authorizationHeader.replace('Bearer ', '').trim();
  if (!token) {
    return { user: null, error: 'Unauthorized', status: 401 as const };
  }

  const supabaseAdmin = createAdminClient();
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return { user: null, error: 'Unauthorized', status: 401 as const };
  }

  return {
    user: {
      id: user.id,
      user_metadata: user.user_metadata,
    } as AuthenticatedRequestUser,
    error: null,
    status: 200 as const,
  };
}
