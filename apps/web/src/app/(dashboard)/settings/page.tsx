'use client';

import { useState } from 'react';
import { fetchApi } from '../../../lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function SettingsPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const payload: any = {};
      if (email) payload.email = email;
      if (password) payload.password = password;

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
      setEmail('');
      setPassword('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12 p-8 glass-card glass-card-hover rounded-xl">
      <h1 className="text-2xl font-black tracking-tight mb-6 text-white">Nastavení účtu</h1>
      
      {message && (
        <div className={`p-4 mb-6 rounded-md border ${message.type === 'success' ? 'bg-primary/10 border-primary text-primary' : 'bg-destructive/10 border-destructive text-destructive'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-muted-foreground ">Nový e-mail</label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Ponechte prázdné pro zachování"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-muted-foreground ">Nové heslo</label>
          <Input
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
