import { useCallback, useEffect, useState } from 'react';
import { fetchApi } from '../lib/api-client';
import type { PageAccessAppConfig } from '../types/page-access';

export type SuperAdminUser = {
  id: string;
  email?: string | null;
  role: 'unassigned' | 'sub' | 'dom';
  app_config?: PageAccessAppConfig | null;
};

type RevealPasswordResponse = {
  password: string;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Neznámá chyba';
}

export function useSuperAdminUsers() {
  const [users, setUsers] = useState<SuperAdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = (await fetchApi('/superadmin/users')) as SuperAdminUser[];
      setUsers(data);
      setError(null);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void loadUsers();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [loadUsers]);

  return { users, loading, error, refetch: loadUsers };
}

export function useClaimUser() {
  const [loading, setLoading] = useState(false);

  const claim = async (subId: string) => {
    setLoading(true);
    try {
      await fetchApi(`/superadmin/claim/${subId}`, { method: 'POST' });
    } finally {
      setLoading(false);
    }
  };

  return { claim, loading };
}

export function useUpdateAppConfig() {
  const [loading, setLoading] = useState(false);

  const updateConfig = async (
    subId: string,
    app_config: PageAccessAppConfig,
  ) => {
    setLoading(true);
    try {
      await fetchApi(`/superadmin/config/${subId}`, {
        method: 'PATCH',
        body: JSON.stringify({ app_config }),
      });
    } finally {
      setLoading(false);
    }
  };

  return { updateConfig, loading };
}

export function useRevealPassword() {
  const [loading, setLoading] = useState(false);

  const reveal = async (userId: string) => {
    setLoading(true);
    try {
      const data = (await fetchApi(
        `/superadmin/vault/reveal/${userId}`,
      )) as RevealPasswordResponse;
      return data.password;
    } finally {
      setLoading(false);
    }
  };

  return { reveal, loading };
}
