"use client";

import type { ComponentType, FormEvent } from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Archive,
  Award,
  Coins,
  History,
  LayoutGrid,
  Loader2,
  Plus,
  ShieldAlert,
  Trophy,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { markPageNotificationsRead } from "@/actions/notifications";
import {
  applyManualDiscipline,
  assignAchievementToSub,
  createAchievementDefinition,
  deleteAchievementDefinition,
  removeAchievementFromSub,
  updateAchievementDefinition,
} from "@/actions/gamification";
import type { Achievement, AchievementsData } from "@/types/gamification";
import { AchievementCard } from "./AchievementCard";
import { AchievementForm } from "./AchievementForm";

type AchievementsClientProps = {
  data: AchievementsData;
};

type AchievementsTab = "active" | "catalog" | "history" | "discipline";

type StatTileProps = {
  label: string;
  value: number | string;
  icon: ComponentType<{ className?: string }>;
  tone?: "default" | "danger";
};

function StatTile({ label, value, icon: Icon, tone = "default" }: StatTileProps) {
  return (
    <div
      className={`rounded-3xl border px-5 py-4 text-right ${
        tone === "danger"
          ? "border-rose-400/20 bg-rose-500/10"
          : "border-white/10 bg-black/30"
      }`}
    >
      <p className="flex items-center justify-end gap-2 text-3xl font-bold text-white">
        {value}
        <Icon className={tone === "danger" ? "h-6 w-6 text-rose-200" : "h-6 w-6 text-primary"} />
      </p>
      <p className="text-xs font-semibold uppercase text-zinc-500">{label}</p>
    </div>
  );
}

function getInitialTab(data: AchievementsData): AchievementsTab {
  if (data.role === "dom" && data.activeNegativeCount > 0) return "active";
  return "active";
}

export function AchievementsClient({ data }: AchievementsClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AchievementsTab>(() =>
    getInitialTab(data),
  );
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingAchievement, setEditingAchievement] =
    useState<Achievement | null>(null);
  const [assignReasons, setAssignReasons] = useState<Record<string, string>>({});
  const [removeReasons, setRemoveReasons] = useState<Record<string, string>>({});
  const [disciplinePoints, setDisciplinePoints] = useState("");
  const [disciplineReason, setDisciplineReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    void markPageNotificationsRead("achievements");
  }, []);

  const activeByAchievementId = useMemo(() => {
    const map = new Map<string, string>();
    data.activeAchievements.forEach((achievement) => {
      if (achievement.userAchievementId) {
        map.set(achievement.id, achievement.userAchievementId);
      }
    });
    return map;
  }, [data.activeAchievements]);

  const tabs: Array<{ key: AchievementsTab; label: string; count: number }> =
    data.role === "dom"
      ? [
          { key: "active", label: "Aktivní", count: data.activeAchievements.length },
          { key: "catalog", label: "Katalog", count: data.catalog.length },
          { key: "history", label: "Historie", count: data.lostCount },
          {
            key: "discipline",
            label: "Kázeň",
            count: data.stats.disciplinePoints,
          },
        ]
      : [
          { key: "active", label: "Aktivní", count: data.activeAchievements.length },
          { key: "history", label: "Ztracené", count: data.lostCount },
          {
            key: "discipline",
            label: "Kázeň",
            count: data.stats.disciplinePoints,
          },
        ];

  const submitCreate = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await createAchievementDefinition(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setShowCreateForm(false);
      router.refresh();
    });
  };

  const submitUpdate = (achievementId: string, formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await updateAchievementDefinition(achievementId, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setEditingAchievement(null);
      router.refresh();
    });
  };

  const deleteDefinition = (achievementId: string) => {
    if (!window.confirm("Opravdu chceš tento odznak smazat z katalogu?")) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await deleteAchievementDefinition(achievementId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  const assignBadge = (achievementId: string) => {
    const reason = assignReasons[achievementId]?.trim() || "";
    if (!reason) {
      setError("Přidělení odznaku vyžaduje důvod.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await assignAchievementToSub(achievementId, reason);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setAssignReasons((current) => ({ ...current, [achievementId]: "" }));
      router.refresh();
    });
  };

  const removeBadge = (userAchievementId: string) => {
    const reason = removeReasons[userAchievementId]?.trim() || "";
    if (!reason) {
      setError("Odebrání odznaku vyžaduje důvod.");
      return;
    }

    if (!window.confirm("Opravdu chceš SUBovi odebrat tento odznak?")) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await removeAchievementFromSub(userAchievementId, reason);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setRemoveReasons((current) => ({ ...current, [userAchievementId]: "" }));
      router.refresh();
    });
  };

  const submitDiscipline = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const points = Number.parseInt(disciplinePoints, 10);
    const reason = disciplineReason.trim();

    if (!Number.isFinite(points) || points <= 0) {
      setError("Body dluhu musí být kladné číslo.");
      return;
    }

    if (!reason) {
      setError("Ruční kázeňská penalizace vyžaduje důvod.");
      return;
    }

    if (points > 100 && !window.confirm(`Opravdu přidat ${points} bodů dluhu?`)) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await applyManualDiscipline(points, reason);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setDisciplinePoints("");
      setDisciplineReason("");
      router.refresh();
    });
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-primary">
            Gamifikace
          </p>
          <h1 className="mt-2 flex items-center gap-3 text-4xl font-bold text-white">
            <Trophy className="h-9 w-9 text-primary" />
            Úspěchy
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            {data.role === "dom"
              ? `Správa odznaků, kázně a historie pro SUB: ${data.subject.name}.`
              : "Aktuální odznaky, ztracené odznaky a kázeňský dluh."}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <StatTile label="celkem XP" value={data.stats.totalPoints} icon={Coins} />
          <StatTile
            label="dostupné XP"
            value={data.stats.availablePoints}
            icon={Coins}
          />
          <StatTile
            label="dluh"
            value={data.stats.disciplinePoints}
            icon={ShieldAlert}
            tone="danger"
          />
          <StatTile label="aktivní" value={data.activeAchievements.length} icon={Award} />
          <StatTile label="ztracené" value={data.lostCount} icon={Archive} />
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => {
            const active = activeTab === tab.key;
            const Icon =
              tab.key === "catalog"
                ? LayoutGrid
                : tab.key === "history"
                  ? History
                  : tab.key === "discipline"
                    ? ShieldAlert
                    : Award;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-primary/60 ${
                  active
                    ? "border-primary/60 bg-primary text-white"
                    : "border-white/10 bg-white/[0.045] text-zinc-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    active ? "bg-white/20 text-white" : "bg-black/35 text-zinc-400"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          {isPending ? (
            <span className="inline-flex items-center gap-2 text-sm text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
              Ukládám
            </span>
          ) : null}
          {data.role === "dom" && activeTab === "catalog" ? (
            <button
              type="button"
              onClick={() => {
                setEditingAchievement(null);
                setShowCreateForm((current) => !current);
              }}
              className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/60"
            >
              <Plus className="h-4 w-4" />
              Nový odznak
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
        >
          {error}
        </div>
      ) : null}

      {showCreateForm && data.role === "dom" && activeTab === "catalog" ? (
        <AchievementForm
          submitLabel="Vytvořit odznak"
          isSubmitting={isPending}
          onSubmit={submitCreate}
          onCancel={() => setShowCreateForm(false)}
        />
      ) : null}

      {editingAchievement && data.role === "dom" ? (
        <AchievementForm
          initialValues={editingAchievement}
          submitLabel="Uložit odznak"
          isSubmitting={isPending}
          onSubmit={(formData) => submitUpdate(editingAchievement.id, formData)}
          onCancel={() => setEditingAchievement(null)}
        />
      ) : null}

      {activeTab === "active" ? (
        data.activeAchievements.length > 0 ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.activeAchievements.map((achievement) => (
              <AchievementCard
                key={achievement.userAchievementId || achievement.id}
                achievement={achievement}
                role={data.role}
                mode="active"
                isPending={isPending}
                removeReason={
                  achievement.userAchievementId
                    ? removeReasons[achievement.userAchievementId] || ""
                    : ""
                }
                onRemoveReasonChange={(value) => {
                  if (!achievement.userAchievementId) return;
                  setRemoveReasons((current) => ({
                    ...current,
                    [achievement.userAchievementId as string]: value,
                  }));
                }}
                onRemove={() => {
                  if (achievement.userAchievementId) {
                    removeBadge(achievement.userAchievementId);
                  }
                }}
              />
            ))}
          </section>
        ) : (
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] px-5 py-10 text-center text-sm text-zinc-400">
            {data.role === "dom"
              ? "SUB zatím nedrží žádný odznak."
              : "Zatím nemáš žádný aktivní odznak."}
          </div>
        )
      ) : null}

      {activeTab === "catalog" && data.role === "dom" ? (
        data.catalog.length > 0 ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.catalog.map((achievement) => (
              <AchievementCard
                key={achievement.id}
                achievement={achievement}
                role="dom"
                mode="catalog"
                isPending={isPending}
                alreadyAssigned={activeByAchievementId.has(achievement.id)}
                assignReason={assignReasons[achievement.id] || ""}
                onAssignReasonChange={(value) =>
                  setAssignReasons((current) => ({
                    ...current,
                    [achievement.id]: value,
                  }))
                }
                onAssign={() => assignBadge(achievement.id)}
                onEdit={() => {
                  setShowCreateForm(false);
                  setEditingAchievement(achievement);
                }}
                onDelete={() => deleteDefinition(achievement.id)}
              />
            ))}
          </section>
        ) : (
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] px-5 py-10 text-center text-sm text-zinc-400">
            Katalog je zatím prázdný. Vytvoř první odznak.
          </div>
        )
      ) : null}

      {activeTab === "history" ? (
        data.lostAchievements.length > 0 ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.lostAchievements.map((achievement) => (
              <AchievementCard
                key={achievement.userAchievementId || achievement.id}
                achievement={achievement}
                role={data.role}
                mode="history"
              />
            ))}
          </section>
        ) : (
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] px-5 py-10 text-center text-sm text-zinc-400">
            Zatím žádné odebrané odznaky.
          </div>
        )
      ) : null}

      {activeTab === "discipline" ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="space-y-3">
            {data.disciplineTransactions.length > 0 ? (
              data.disciplineTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="rounded-3xl border border-white/10 bg-white/[0.045] px-5 py-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-bold text-white">
                        {transaction.reason}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {new Intl.DateTimeFormat("cs-CZ", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(transaction.createdAt))}
                      </p>
                    </div>
                    <span className="inline-flex w-fit items-center gap-2 rounded-full border border-rose-400/25 bg-rose-500/10 px-3 py-1 text-sm font-bold text-rose-100">
                      <ShieldAlert className="h-4 w-4" />
                      +{transaction.disciplineDelta}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] px-5 py-10 text-center text-sm text-zinc-400">
                Zatím žádný kázeňský dluh v ledgeru.
              </div>
            )}
          </section>

          {data.role === "dom" ? (
            <form
              onSubmit={submitDiscipline}
              className="h-fit rounded-3xl border border-rose-400/20 bg-rose-500/10 p-5"
            >
              <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                <ShieldAlert className="h-5 w-5 text-rose-200" />
                Přidat dluh
              </h2>
              <p className="mt-2 text-sm leading-6 text-rose-100/80">
                Přidá se k discipline_points. Dostupné XP se tím nesníží pod nulu.
              </p>

              <label className="mt-4 block text-sm font-semibold text-rose-100">
                Body dluhu
                <input
                  value={disciplinePoints}
                  onChange={(event) => setDisciplinePoints(event.target.value)}
                  type="number"
                  min={1}
                  className="mt-2 w-full rounded-2xl border border-rose-300/20 bg-black/35 px-4 py-3 text-white focus:border-rose-200/50 focus:outline-none focus:ring-2 focus:ring-rose-200/20"
                />
              </label>

              <label className="mt-4 block text-sm font-semibold text-rose-100">
                Důvod
                <textarea
                  value={disciplineReason}
                  onChange={(event) => setDisciplineReason(event.target.value)}
                  className="mt-2 min-h-24 w-full rounded-2xl border border-rose-300/20 bg-black/35 px-4 py-3 text-white placeholder:text-rose-100/30 focus:border-rose-200/50 focus:outline-none focus:ring-2 focus:ring-rose-200/20"
                  placeholder="Proč se dluh přidává..."
                />
              </label>

              <button
                type="submit"
                disabled={isPending}
                className="mt-4 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Přidat kázeňský dluh
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
