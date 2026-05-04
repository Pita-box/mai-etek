"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  Eye,
  EyeOff,
  Gauge,
  Gift,
  Heart,
  Image as ImageIcon,
  Loader2,
  LockKeyhole,
  MessageSquare,
  Settings,
  Trophy,
} from "lucide-react";
import {
  useClaimUser,
  useRevealPassword,
  useSuperAdminUsers,
  useUpdateAppConfig,
} from "@/hooks/useSuperAdmin";
import {
  isPageEnabledForSub,
  setPageAccessEnabled,
} from "@/lib/page-access/config";
import { DashboardPageSkeleton } from "@/components/shared/DashboardSkeletons";
import type {
  DashboardPageIconKey,
  DashboardPageItem,
  PageAccessAppConfig,
} from "@/types/page-access";

type SuperAdminClientProps = {
  pages: DashboardPageItem[];
};

type SuperAdminUser = {
  id: string;
  email?: string | null;
  role: "unassigned" | "sub" | "dom";
  app_config?: PageAccessAppConfig | null;
};

const iconByKey: Record<DashboardPageIconKey, LucideIcon> = {
  activity: Activity,
  "alert-triangle": AlertTriangle,
  "check-square": CheckSquare,
  gauge: Gauge,
  gift: Gift,
  heart: Heart,
  image: ImageIcon,
  "message-square": MessageSquare,
  settings: Settings,
  shield: LockKeyhole,
  trophy: Trophy,
};

export function SuperAdminClient({ pages }: SuperAdminClientProps) {
  const { users, loading, error, refetch } = useSuperAdminUsers();
  const { claim, loading: claiming } = useClaimUser();
  const { updateConfig, loading: updatingConfig } = useUpdateAppConfig();
  const { reveal, loading: revealing } = useRevealPassword();
  const [revealedPasswords, setRevealedPasswords] = useState<
    Record<string, string>
  >({});
  const [updatingPage, setUpdatingPage] = useState<string | null>(null);

  const handleClaim = async (id: string) => {
    await claim(id);
    void refetch();
  };

  const handleReveal = async (id: string) => {
    if (revealedPasswords[id]) {
      const updated = { ...revealedPasswords };
      delete updated[id];
      setRevealedPasswords(updated);
      return;
    }

    try {
      const password = await reveal(id);
      setRevealedPasswords((prev) => ({ ...prev, [id]: password }));
    } catch (caughtError) {
      alert(caughtError instanceof Error ? caughtError.message : "Chyba");
    }
  };

  const handleTogglePageAccess = async (
    user: SuperAdminUser,
    page: DashboardPageItem,
  ) => {
    const currentEnabled = isPageEnabledForSub(user.app_config, page);
    const nextConfig = setPageAccessEnabled(
      user.app_config,
      page.key,
      !currentEnabled,
    );

    setUpdatingPage(`${user.id}:${page.key}`);
    try {
      await updateConfig(user.id, nextConfig);
      await refetch();
    } finally {
      setUpdatingPage(null);
    }
  };

  if (loading) return <DashboardPageSkeleton />;

  if (error) {
    return (
      <div role="alert" className="p-8 text-red-500">
        Chyba: {error}
      </div>
    );
  }

  const typedUsers = users as SuperAdminUser[];
  const unassigned = typedUsers.filter((user) => user.role === "unassigned");
  const subs = typedUsers.filter((user) => user.role === "sub");

  return (
    <div className="space-y-8 p-8">
      <div>
        <p className="text-xs font-semibold uppercase text-primary">
          Administrace
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-white">
          SuperAdmin Dashboard
        </h1>
      </div>

      <section>
        <h2 className="mb-4 text-xl font-bold text-white">
          Čekající na přiřazení
        </h2>
        <div className="glass-card glass-card-hover overflow-hidden rounded-xl border border-border">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-black/40">
              <tr>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  Email
                </th>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  Heslo
                </th>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  Akce
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {unassigned.map((user) => (
                <tr
                  key={user.id}
                  className="transition-colors hover:bg-white/5"
                >
                  <td className="whitespace-nowrap px-6 py-4 text-white">
                    {user.email}
                  </td>
                  <td className="flex items-center space-x-3 whitespace-nowrap px-6 py-4 text-muted-foreground">
                    <span className="scrollbar-hide inline-block w-[140px] overflow-x-auto whitespace-nowrap rounded bg-black/50 px-2 py-1 text-center transition-all duration-300">
                      {revealedPasswords[user.id]
                        ? revealedPasswords[user.id]
                        : "••••••••••••••••"}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleReveal(user.id)}
                      disabled={revealing}
                      className="flex-shrink-0 cursor-pointer text-muted-foreground transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      title={
                        revealedPasswords[user.id]
                          ? "Skrýt heslo"
                          : "Zobrazit heslo"
                      }
                    >
                      {revealedPasswords[user.id] ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <button
                      type="button"
                      onClick={() => handleClaim(user.id)}
                      disabled={claiming}
                      className="cursor-pointer rounded bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Přiřadit
                    </button>
                  </td>
                </tr>
              ))}
              {unassigned.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    Žádní volní uživatelé
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold text-white">Moji podřízení</h2>
        <div className="glass-card glass-card-hover overflow-hidden rounded-xl border border-border">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-black/40">
              <tr>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  Email
                </th>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  Heslo
                </th>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  Přístup ke stránkám
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {subs.map((user) => (
                <tr
                  key={user.id}
                  className="align-top transition-colors hover:bg-white/5"
                >
                  <td className="whitespace-nowrap px-6 py-4 text-white">
                    {user.email}
                  </td>
                  <td className="flex items-center space-x-3 whitespace-nowrap px-6 py-4 text-muted-foreground">
                    <span className="scrollbar-hide inline-block w-[140px] overflow-x-auto whitespace-nowrap rounded bg-black/50 px-2 py-1 text-center transition-all duration-300">
                      {revealedPasswords[user.id]
                        ? revealedPasswords[user.id]
                        : "••••••••••••••••"}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleReveal(user.id)}
                      disabled={revealing}
                      className="flex-shrink-0 cursor-pointer text-muted-foreground transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      title={
                        revealedPasswords[user.id]
                          ? "Skrýt heslo"
                          : "Zobrazit heslo"
                      }
                    >
                      {revealedPasswords[user.id] ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <p className="mb-3 max-w-3xl text-xs leading-5 text-muted-foreground">
                      Nové dashboard stránky se sem přidají automaticky. Pokud
                      není stránka ručně vypnutá, je pro SUB povolená.
                    </p>
                    <div className="flex max-w-4xl flex-wrap gap-2">
                      {pages.map((page) => {
                        const enabled = isPageEnabledForSub(
                          user.app_config,
                          page,
                        );
                        const Icon = iconByKey[page.iconKey] || Activity;
                        const pending = updatingPage === `${user.id}:${page.key}`;

                        return (
                          <button
                            key={page.key}
                            type="button"
                            onClick={() => handleTogglePageAccess(user, page)}
                            disabled={updatingConfig || pending}
                            aria-label={`${page.label}: ${
                              enabled ? "povoleno" : "nepovoleno"
                            } pro SUB`}
                            className={`inline-flex min-w-0 cursor-pointer items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-50 ${
                              enabled
                                ? "border-primary/50 bg-primary text-white hover:bg-primary/90"
                                : "border-rose-400/25 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
                            }`}
                          >
                            {pending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : enabled ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0" />
                            ) : (
                              <LockKeyhole className="h-4 w-4 shrink-0" />
                            )}
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="min-w-0 truncate">
                              {page.label}
                            </span>
                            <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px] uppercase">
                              {enabled ? "Povoleno" : "Nepovoleno"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              ))}
              {subs.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    Žádní podřízení uživatelé
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
