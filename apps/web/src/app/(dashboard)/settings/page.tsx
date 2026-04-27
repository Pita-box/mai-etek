'use client';

import { useEffect, useState } from 'react';
import { fetchApi } from '../../../lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/utils/supabase/client';

export default function SettingsPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const currentName = data.user?.user_metadata?.full_name;
      setName(typeof currentName === 'string' && currentName.trim() ? currentName : 'subíček');
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const payload: { email?: string; password?: string; full_name?: string } = {};
      if (email) payload.email = email;
      if (password) payload.password = password;
      payload.full_name = name.trim() || 'subíček';

      if (Object.keys(payload).length === 0) {
        setMessage({ type: 'error', text: 'Zadejte alespoň jeden údaj ke změně.' });
        setLoading(false);
        return;
      }

      await fetchApi('/user/settings', {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      setMessage({ type: 'success', text: 'Údaje byly úspěšně změněny.' });
      setName(payload.full_name);
      setEmail('');
      setPassword('');
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Uložení se nepodařilo.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto mt-12 max-w-md rounded-xl p-8 glass-card glass-card-hover">
      <h1 className="mb-2 text-2xl font-black tracking-tight text-white">Nastavení účtu</h1>
      <p className="mb-6 text-sm text-muted-foreground">Uprav jméno, e-mail nebo heslo účtu.</p>
      
      {message && (
        <div className={`p-4 mb-6 rounded-md border ${message.type === 'success' ? 'bg-primary/10 border-primary text-primary' : 'bg-destructive/10 border-destructive text-destructive'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="settings-name" className="block text-sm font-medium text-muted-foreground">Jméno</label>
          <Input
            id="settings-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="subíček"
          />
          <p className="text-xs text-muted-foreground">Když pole necháš prázdné, uloží se jméno subíček.</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="settings-email" className="block text-sm font-medium text-muted-foreground">Nový e-mail</label>
          <Input
            id="settings-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Ponechte prázdné pro zachování"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="settings-password" className="block text-sm font-medium text-muted-foreground">Nové heslo</label>
          <Input
            id="settings-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Ponechte prázdné pro zachování"
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full shadow-[0_0_15px_rgba(255,31,87,0.2)] hover:shadow-[0_0_25px_rgba(255,31,87,0.4)] transition-all"
        >
          {loading ? 'Ukládám...' : 'Uložit změny'}
        </Button>
      </form>
    </div>
  );
}
