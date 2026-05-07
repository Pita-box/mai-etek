"use client"

import type { LucideIcon } from "lucide-react"
import {
  AlertTriangle,
  Archive,
  Ban,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Coins,
  Flame,
  Loader2,
  Lock,
  OctagonAlert,
  Pencil,
  ShieldAlert,
  Sparkles,
  Star,
  Trash2,
  TrendingUp,
  Trophy,
  Undo2,
  XCircle,
} from "lucide-react"
import type { Achievement, AchievementItem } from "@/types/gamification"

type AchievementCardProps = {
  achievement: Achievement | AchievementItem
  role?: "dom" | "sub"
  mode?: "active" | "catalog" | "history" | "locked"
  isPending?: boolean
  assignReason?: string
  removeReason?: string
  alreadyAssigned?: boolean
  onAssignReasonChange?: (value: string) => void
  onRemoveReasonChange?: (value: string) => void
  onAssign?: () => void
  onRemove?: () => void
  onEdit?: () => void
  onDelete?: () => void
}

const iconByName: Record<string, LucideIcon> = {
  trophy: Trophy,
  "clipboard-check": ClipboardCheck,
  star: Star,
  coins: Coins,
  "trending-up": TrendingUp,
  flame: Flame,
  "calendar-days": CalendarDays,
  "check-circle": CheckCircle2,
  sparkles: Sparkles,
  "shield-alert": ShieldAlert,
  "alert-triangle": AlertTriangle,
  "octagon-alert": OctagonAlert,
  ban: Ban,
}

const conditionLabel: Record<string, string> = {
  points: "XP",
  level: "Level",
  streak: "Série",
  tasks_completed: "Úkoly",
  perfect_rating_count: "Perfektní hodnocení",
}

function isAchievementItem(
  achievement: Achievement | AchievementItem,
): achievement is AchievementItem {
  return "userAchievementId" in achievement
}

function formatDate(value: string | null | undefined) {
  if (!value) return null
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value))
}

export function AchievementCard({
  achievement,
  role = "sub",
  mode,
  isPending = false,
  assignReason = "",
  removeReason = "",
  alreadyAssigned = false,
  onAssignReasonChange,
  onRemoveReasonChange,
  onAssign,
  onRemove,
  onEdit,
  onDelete,
}: AchievementCardProps) {
  const item = isAchievementItem(achievement) ? achievement : null
  const actualMode =
    mode || (item?.removedAt ? "history" : item?.unlocked ? "active" : "locked")
  const isNegative = achievement.badgeType === "negative"
  const isRemoved = actualMode === "history"
  const isActive = actualMode === "active"
  const isCatalog = actualMode === "catalog"
  const Icon =
    iconByName[achievement.iconName] || (isNegative ? ShieldAlert : Trophy)
  const unlockedAt = formatDate(item?.unlockedAt)
  const removedAt = formatDate(item?.removedAt)
  const showProgress = item && !isNegative && actualMode !== "history"
  const statusIcon = isRemoved
    ? XCircle
    : isNegative
      ? ShieldAlert
      : isActive
        ? CheckCircle2
        : Lock
  const StatusIcon = statusIcon

  return (
    <article
      className={`rounded-3xl border p-5 backdrop-blur-xl transition ${
        isRemoved
          ? "border-white/10 bg-white/[0.035] opacity-90"
          : isNegative
            ? "border-rose-400/30 bg-rose-500/10"
            : isActive
              ? "border-primary/35 bg-primary/10"
              : "border-white/10 bg-white/[0.045] hover:border-primary/20"
      }`}>
      <div className="flex items-start justify-between gap-4">
        <div
          className={`rounded-2xl p-3 ring-1 ${
            isRemoved
              ? "bg-black/35 text-zinc-500 ring-white/10"
              : isNegative
                ? "bg-rose-500/15 text-rose-200 ring-rose-400/20"
                : isActive
                  ? "bg-primary/20 text-primary ring-primary/30"
                  : "bg-black/35 text-zinc-500 ring-white/10"
          }`}>
          <Icon className="h-5 w-5" />
        </div>

        <span
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${
            isRemoved
              ? "border-white/10 bg-black/35 text-zinc-400"
              : isNegative
                ? "border-rose-400/25 bg-rose-500/10 text-rose-100"
                : isActive
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-white/10 bg-black/35 text-zinc-400"
          }`}>
          <StatusIcon className="h-3.5 w-3.5" />
          {isRemoved
            ? "Odebráno"
            : isNegative
              ? "Kázeňský"
              : isActive
                ? "Aktivní"
                : isCatalog
                  ? achievement.isActive
                    ? "V katalogu"
                    : "Vypnuto"
                  : "Locked"}
        </span>
      </div>

      <div className="mt-5 min-w-0">
        <h3 className="break-words text-xl font-bold text-white">
          {achievement.title}
        </h3>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          {achievement.description || "Bez popisu."}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-zinc-300">
          {conditionLabel[achievement.conditionType]}:{" "}
          {achievement.conditionValue}
        </span>
        {achievement.xpReward > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-primary">
            <Coins className="h-3.5 w-3.5" />
            {achievement.xpReward} XP
          </span>
        ) : null}
        {achievement.xpPenalty > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/25 bg-rose-500/10 px-3 py-1 text-rose-100">
            <ShieldAlert className="h-3.5 w-3.5" />+{achievement.xpPenalty} dluh
          </span>
        ) : null}
      </div>

      {showProgress ? (
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold uppercase text-zinc-500">
            <span>Progress</span>
            <span>{item.progressText}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                item.unlocked ? "bg-primary" : "bg-zinc-500"
              }`}
              style={{ width: `${item.progressPercent}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="mt-4 space-y-2 text-xs leading-5 text-zinc-400">
        {unlockedAt ? <p>Získáno {unlockedAt}</p> : null}
        {item?.assignReason ? (
          <p>
            <span className="font-semibold text-zinc-300">Důvod:</span>{" "}
            {item.assignReason}
          </p>
        ) : null}
        {removedAt ? <p>Odebráno {removedAt}</p> : null}
        {item?.removeReason ? (
          <p>
            <span className="font-semibold text-zinc-300">Důvod odebrání:</span>{" "}
            {item.removeReason}
          </p>
        ) : null}
      </div>

      {role === "dom" && isCatalog ? (
        <div className="mt-5 space-y-3">
          <label className="block text-xs font-semibold uppercase text-zinc-500">
            Důvod přidělení
            <textarea
              value={assignReason}
              onChange={(event) => onAssignReasonChange?.(event.target.value)}
              disabled={isPending || alreadyAssigned || !achievement.isActive}
              className="mt-2 min-h-20 w-full rounded-2xl border border-white/10 bg-black/35 px-3 py-2 text-sm normal-case text-white placeholder:text-zinc-600 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
              placeholder="Proč SUB tento odznak dostává..."
            />
          </label>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onAssign}
              disabled={isPending || alreadyAssigned || !achievement.isActive}
              className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-50">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {alreadyAssigned ? "Už drží" : "Přidělit SUB"}
            </button>
            <button
              type="button"
              onClick={onEdit}
              disabled={isPending}
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-zinc-200 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-50">
              <Pencil className="h-4 w-4" />
              Upravit
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={isPending}
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-100 transition hover:bg-rose-500/20 focus:outline-none focus:ring-2 focus:ring-rose-300/60 disabled:cursor-not-allowed disabled:opacity-50">
              <Trash2 className="h-4 w-4" />
              Smazat
            </button>
          </div>
        </div>
      ) : null}

      {role === "dom" && isActive && item?.userAchievementId ? (
        <div className="mt-5 space-y-3 border-t border-white/10 pt-4">
          <label className="block text-xs font-semibold uppercase text-zinc-500">
            Důvod odebrání
            <textarea
              value={removeReason}
              onChange={(event) => onRemoveReasonChange?.(event.target.value)}
              disabled={isPending}
              className="mt-2 min-h-20 w-full rounded-2xl border border-white/10 bg-black/35 px-3 py-2 text-sm normal-case text-white placeholder:text-zinc-600 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
              placeholder="Proč SUB tento odznak ztrácí..."
            />
          </label>
          <button
            type="button"
            onClick={onRemove}
            disabled={isPending}
            className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-100 transition hover:bg-rose-500/20 focus:outline-none focus:ring-2 focus:ring-rose-300/60 disabled:cursor-not-allowed disabled:opacity-50">
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Undo2 className="h-4 w-4" />
            )}
            Odebrat odznak
          </button>
        </div>
      ) : null}

      {isRemoved ? (
        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-semibold text-zinc-400">
          <Archive className="h-3.5 w-3.5" />
          Historie držení
        </div>
      ) : null}
    </article>
  )
}
