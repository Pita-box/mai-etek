'use client';

import { useState } from 'react';
import { useSuperAdminUsers, useClaimUser, useUpdateAppConfig, useRevealPassword } from '../../../hooks/useSuperAdmin';
import { Eye, EyeOff } from 'lucide-react';

export default function SuperAdminPage() {
  const { users, loading, error, refetch } = useSuperAdminUsers();
  const { claim, loading: claiming } = useClaimUser();
  const { updateConfig, loading: updatingConfig } = useUpdateAppConfig();
  const { reveal, loading: revealing } = useRevealPassword();

  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});

  const handleClaim = async (id: string) => {
    await claim(id);
    refetch();
  };

  const handleReveal = async (id: string) => {
    if (revealedPasswords[id]) {
      // Toggle off
      const updated = { ...revealedPasswords };
      delete updated[id];
      setRevealedPasswords(updated);
      return;
    }

    // Toggle on (fetch if needed)
    try {
      const password = await reveal(id);
      setRevealedPasswords(prev => ({ ...prev, [id]: password }));
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleToggleModule = async (userId: string, config: any, module: string) => {
    const currentConfig = config || { modules: { chat: false, tasks: false, gallery: false } };
    const newConfig = {
      ...currentConfig,
      modules: {
        ...currentConfig.modules,
        [module]: !currentConfig.modules?.[module]
      }
    };
    await updateConfig(userId, newConfig);
    refetch();
  };

  if (loading) return <div className="p-8">Načítání...</div>;
  if (error) return <div className="p-8 text-red-500">Chyba: {error}</div>;

  const unassigned = users.filter(u => u.role === 'unassigned');
  const subs = users.filter(u => u.role === 'sub');

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-black tracking-tight text-white">SuperAdmin Dashboard</h1>

      <div>
        <h2 className="text-xl font-bold mb-4 text-white">Čekající na přiřazení</h2>
        <div className="glass-card glass-card-hover rounded-xl overflow-hidden border border-border">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-black/40">
              <tr>
                <th className="px-6 py-4 text-left text-xs text-muted-foreground uppercase tracking-wider">Email</th>
                <th className="px-6 py-4 text-left text-xs text-muted-foreground uppercase tracking-wider">Heslo</th>
                <th className="px-6 py-4 text-left text-xs text-muted-foreground uppercase tracking-wider">Akce</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {unassigned.map(user => (
                <tr key={user.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-white">{user.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-muted-foreground flex items-center space-x-3">
                    <span className="bg-black/50 px-2 py-1 rounded inline-block transition-all duration-300 w-[140px] overflow-x-auto whitespace-nowrap scrollbar-hide text-center">
                      {revealedPasswords[user.id] ? revealedPasswords[user.id] : '••••••••••••••••'}
                    </span>
                    <button
                      onClick={() => handleReveal(user.id)}
                      disabled={revealing}
                      className="text-muted-foreground hover:text-white transition-colors flex-shrink-0"
                      title={revealedPasswords[user.id] ? "Skrýt heslo" : "Zobrazit heslo"}
                    >
                      {revealedPasswords[user.id] ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleClaim(user.id)}
                      disabled={claiming}
                      className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700 disabled:opacity-50"
                    >
                      Přiřadit
                    </button>
                  </td>
                </tr>
              ))}
              {unassigned.length === 0 && (
                <tr><td colSpan={4} className="px-6 py-4 text-center text-gray-500">Žádní volní uživatelé</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4 text-white">Moji podřízení</h2>
        <div className="glass-card glass-card-hover rounded-xl overflow-hidden border border-border">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-black/40">
              <tr>
                <th className="px-6 py-4 text-left text-xs text-muted-foreground uppercase tracking-wider">Email</th>
                <th className="px-6 py-4 text-left text-xs text-muted-foreground uppercase tracking-wider">Heslo</th>
                <th className="px-6 py-4 text-left text-xs text-muted-foreground uppercase tracking-wider">Moduly (Chat / Úkoly / Galerie)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {subs.map(user => (
                <tr key={user.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-white">{user.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-muted-foreground flex items-center space-x-3">
                    <span className="bg-black/50 px-2 py-1 rounded inline-block transition-all duration-300 w-[140px] overflow-x-auto whitespace-nowrap scrollbar-hide text-center">
                      {revealedPasswords[user.id] ? revealedPasswords[user.id] : '••••••••••••••••'}
                    </span>
                    <button
                      onClick={() => handleReveal(user.id)}
                      disabled={revealing}
                      className="text-muted-foreground hover:text-white transition-colors flex-shrink-0"
                      title={revealedPasswords[user.id] ? "Skrýt heslo" : "Zobrazit heslo"}
                    >
                      {revealedPasswords[user.id] ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap space-x-4">
                    <label className="inline-flex items-center">
                      <input type="checkbox" className="form-checkbox" checked={!!user.app_config?.modules?.chat} onChange={() => handleToggleModule(user.id, user.app_config, 'chat')} disabled={updatingConfig} />
                      <span className="ml-2">Chat</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input type="checkbox" className="form-checkbox" checked={!!user.app_config?.modules?.tasks} onChange={() => handleToggleModule(user.id, user.app_config, 'tasks')} disabled={updatingConfig} />
                      <span className="ml-2">Úkoly</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input type="checkbox" className="form-checkbox" checked={!!user.app_config?.modules?.gallery} onChange={() => handleToggleModule(user.id, user.app_config, 'gallery')} disabled={updatingConfig} />
                      <span className="ml-2">Galerie</span>
                    </label>
                  </td>
                </tr>
              ))}
              {subs.length === 0 && (
                <tr><td colSpan={4} className="px-6 py-4 text-center text-gray-500">Žádní podřízení uživatelé</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
