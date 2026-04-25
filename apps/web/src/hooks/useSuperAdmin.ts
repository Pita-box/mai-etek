import { useState, useEffect } from 'react';
import { fetchApi } from '../lib/api-client';

export function useSuperAdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await fetchApi('/superadmin/users');
      setUsers(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

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

  const updateConfig = async (subId: string, app_config: any) => {
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
      const data = await fetchApi(`/superadmin/vault/reveal/${userId}`);
      return data.password;
    } finally {
      setLoading(false);
    }
  };

  return { reveal, loading };
}
