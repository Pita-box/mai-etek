import {
  CalendarDays,
  Coins,
  Flame,
  History,
  ShieldAlert,
  Sparkles,
  Trophy,
} from "lucide-react";
import type { GamificationDashboardData } from "@/types/gamification";

type GamificationDashboardProps = {
  data: GamificationDashboardData;
};

function formatDate(value: string | null) {
  if (!value) return "Zatím nic";
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Trophy;
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-zinc-500">
            {label}
          </p>
          <p className="mt-3 text-3xl font-bold text-white">{value}</p>
        </div>
        <div className="rounded-2xl bg-primary/15 p-3 text-primary ring-1 ring-primary/20">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 text-sm text-zinc-400">{hint}</p>
    </div>
  );
}

export function GamificationDashboard({ data }: GamificationDashboardProps) {
  const { stats } = data;
  const progressValue = stats.totalPoints % 100;
  const pointsToNextLevel = 100 - progressValue;
  const achievementProgress =
    data.achievementsTotal > 0
      ? Math.round((data.achievementsUnlocked / data.achievementsTotal) * 100)
      : 0;

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-primary">
            Gamifikace
          </p>
          <h1 className="mt-2 flex items-center gap-3 text-4xl font-bold text-white">
            <Trophy className="h-9 w-9 text-primary" />
            Přehled
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            {data.role === "dom"
              ? `Statistiky SUB účtu: ${data.subject.name}.`
              : "Tvoje XP, level, série a poslední odměny za splněné úkoly."}
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/30 px-5 py-4 text-right">
          <p className="text-sm font-semibold text-zinc-400">Zobrazeno pro</p>
          <p className="mt-1 text-xl font-bold text-white">
            {data.subject.name}
          </p>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          icon={Coins}
          label="Celkem XP"
          value={stats.totalPoints}
          hint="Lifetime XP získané ze schválených úkolů."
        />
        <StatCard
          icon={Sparkles}
          label="Dostupné XP"
          value={stats.availablePoints}
          hint="Body, které lze utratit za Rewards."
        />
        <StatCard
          icon={Trophy}
          label="Level"
          value={stats.level}
          hint={`${pointsToNextLevel} XP do dalšího levelu.`}
        />
        <StatCard
          icon={Flame}
          label="Série"
          value={`${stats.currentStreak} d`}
          hint={`Nejdelší série: ${stats.longestStreak} d.`}
        />
        <StatCard
          icon={ShieldAlert}
          label="Kázeňský dluh"
          value={stats.disciplinePoints}
          hint="Dluh z penalizací, oddělený od dostupných XP."
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold text-primary">
                Progress levelu
              </p>
              <h2 className="mt-2 text-2xl font-bold text-white">
                Level {stats.level}
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                {progressValue}/100 XP v aktuálním levelu.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-right">
              <p className="text-2xl font-bold text-white">
                {pointsToNextLevel}
              </p>
              <p className="text-xs font-semibold uppercase text-zinc-500">
                XP chybí
              </p>
            </div>
          </div>

          <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progressValue}%` }}
            />
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
              <p className="text-2xl font-bold text-white">
                {stats.tasksCompleted}
              </p>
              <p className="text-xs font-semibold uppercase text-zinc-500">
                splněno
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
              <p className="text-2xl font-bold text-white">
                {stats.perfectRatingCount}
              </p>
              <p className="text-xs font-semibold uppercase text-zinc-500">
                perfektní
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
              <p className="text-2xl font-bold text-white">
                {formatDate(stats.lastCompletedOn)}
              </p>
              <p className="text-xs font-semibold uppercase text-zinc-500">
                poslední splnění
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-primary">
                Úspěchy
              </p>
              <h2 className="mt-2 text-2xl font-bold text-white">
                {data.achievementsUnlocked}/{data.achievementsTotal}
              </h2>
            </div>
            <div className="rounded-2xl bg-primary/15 p-3 text-primary ring-1 ring-primary/20">
              <CalendarDays className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${achievementProgress}%` }}
            />
          </div>
          <p className="mt-4 text-sm text-zinc-400">
            Odemčené milestone za úkoly, XP, série a perfektní hodnocení.
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-primary/15 p-3 text-primary ring-1 ring-primary/20">
            <History className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Poslední XP</h2>
            <p className="text-sm text-zinc-400">
              Ledger zůstává auditovatelný a XP se nepřičítají dvakrát.
            </p>
          </div>
        </div>

        <div className="mt-5 divide-y divide-white/10">
          {data.recentTransactions.length > 0 ? (
            data.recentTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {transaction.reason}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {formatDateTime(transaction.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {transaction.pointsDelta !== 0 ? (
                    <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
                      {transaction.pointsDelta > 0 ? "+" : ""}
                      {transaction.pointsDelta} XP
                    </span>
                  ) : null}
                  {transaction.availableDelta !== transaction.pointsDelta ? (
                    <span className="rounded-full border border-white/10 bg-black/35 px-3 py-1 text-sm font-semibold text-zinc-300">
                      {transaction.availableDelta > 0 ? "+" : ""}
                      {transaction.availableDelta} dostupné
                    </span>
                  ) : null}
                  {transaction.disciplineDelta !== 0 ? (
                    <span className="rounded-full border border-rose-400/25 bg-rose-500/10 px-3 py-1 text-sm font-bold text-rose-100">
                      +{transaction.disciplineDelta} dluh
                    </span>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-5 py-10 text-center text-sm text-zinc-400">
              Zatím tu nejsou žádné XP transakce. Objeví se po schválení
              úkolu.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
