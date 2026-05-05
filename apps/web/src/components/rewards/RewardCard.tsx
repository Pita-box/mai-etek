"use client"

import { Coins, Gift, Loader2, Pencil, Trash2 } from "lucide-react"
import type { Reward, RewardClaim } from "@/types/gamification"

type RewardCardProps = {
  reward: Reward
  role: "dom" | "sub"
  availablePoints: number
  pendingClaim?: RewardClaim | null
  isPending?: boolean
  onClaim?: () => void
  onEdit?: () => void
  onDelete?: () => void
}

export function RewardCard({
  reward,
  role,
  availablePoints,
  pendingClaim,
  isPending = false,
  onClaim,
  onEdit,
  onDelete,
}: RewardCardProps) {
  const missingPoints = Math.max(0, reward.costPoints - availablePoints)
  const canClaim =
    role === "sub" && reward.isActive && !pendingClaim && missingPoints === 0
  const claimLabel = pendingClaim
    ? "Čeká se na schválení"
    : missingPoints > 0
      ? `Chybí ${missingPoints} XP`
      : "Získat odměnu"

  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl transition hover:border-primary/25 hover:bg-white/[0.06]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              <Coins className="h-3.5 w-3.5" />
              {reward.costPoints} XP
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                reward.isActive
                  ? "border-primary/25 bg-primary/10 text-primary"
                  : "border-white/10 bg-white/5 text-zinc-400"
              }`}>
              {reward.isActive ? "Aktivní" : "Vypnuto"}
            </span>
          </div>
          <h3 className="truncate text-xl font-bold text-white">
            {reward.title}
          </h3>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-zinc-400">
            {reward.description || "Bez popisu."}
          </p>
        </div>
        <div className="rounded-2xl bg-primary/15 p-3 text-primary ring-1 ring-primary/20">
          <Gift className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        {role === "sub" ? (
          <button
            type="button"
            onClick={onClaim}
            disabled={!canClaim || isPending}
            className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-50">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {claimLabel}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onEdit}
              disabled={isPending}
              className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-zinc-200 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-50">
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
          </>
        )}
      </div>
    </article>
  )
}
