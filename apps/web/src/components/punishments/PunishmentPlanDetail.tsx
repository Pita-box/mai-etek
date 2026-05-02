"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, Loader2, Trash2, X } from "lucide-react"
import {
  removePunishmentPlanItem,
  setPunishmentPlanItemDone,
} from "@/actions/punishments"
import { Punishment, PunishmentPlan } from "@/types/punishment"
import { AddPunishmentToPlan } from "./AddPunishmentToPlan"

type PunishmentPlanDetailProps = {
  plan: PunishmentPlan
  templates: Punishment[]
  onClose: () => void
}

function formatEventDate(value: string | null) {
  if (!value) return "Bez pevného času"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Bez pevného času"

  return new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

export function PunishmentPlanDetail({
  plan,
  templates,
  onClose,
}: PunishmentPlanDetailProps) {
  const router = useRouter()
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const doneCount = plan.items.filter((item) => item.is_done).length

  const toggleExpanded = (itemId: string) => {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  const setItemDone = (itemId: string, nextDone: boolean) => {
    setError(null)
    startTransition(async () => {
      const result = await setPunishmentPlanItemDone(itemId, nextDone)
      if (result?.error) {
        setError(result.error)
        return
      }

      router.refresh()
    })
  }

  const removeItem = (itemId: string) => {
    setError(null)
    startTransition(async () => {
      const result = await removePunishmentPlanItem(itemId)
      if (result?.error) {
        setError(result.error)
        return
      }

      router.refresh()
    })
  }

  return (
    <section className="rounded-3xl border border-primary/20 bg-white/[0.05] p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-primary">
            Detail plánu
          </p>
          <h2 className="mt-1 text-2xl font-black text-white">{plan.title}</h2>
          <p className="mt-2 text-sm text-zinc-400">
            {plan.description || "Bez detailního popisu."}
          </p>
          <p className="mt-3 text-sm text-zinc-500">
            {formatEventDate(plan.event_at)}
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-right">
            <p className="text-2xl font-black text-white">
              {doneCount}/{plan.items.length}
            </p>
            <p className="text-xs font-semibold uppercase text-zinc-500">
              hotovo
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 p-2 text-zinc-300 transition hover:bg-white/10"
            aria-label="Zavřít detail plánu">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      <div className="mt-5">
        <AddPunishmentToPlan plan={plan} templates={templates} />
      </div>

      <div className="mt-5 space-y-3">
        {plan.items.length > 0 ? (
          plan.items.map((item) => {
            const expanded = expandedIds.has(item.id)

            return (
              <div
                key={item.id}
                className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <label className="flex min-w-0 cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={item.is_done}
                      onChange={(event) =>
                        setItemDone(item.id, event.target.checked)
                      }
                      disabled={isPending}
                      className="mt-1 h-4 w-4 rounded border-white/20 bg-black text-primary focus:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <span className="min-w-0">
                      <span
                        className={`block font-bold ${item.is_done ? "text-zinc-500 line-through" : "text-white"}`}>
                        {item.title_snapshot}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-2">
                        <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                          Náročnost {item.severity_snapshot}/5
                        </span>
                        {item.categories_snapshot.map((category) => (
                          <span
                            key={category}
                            className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-semibold text-zinc-300">
                            {category}
                          </span>
                        ))}
                      </span>
                    </span>
                  </label>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(item.id)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
                      aria-expanded={expanded}>
                      Detail
                      <ChevronDown
                        className={`h-4 w-4 transition ${expanded ? "rotate-180" : ""}`}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      disabled={isPending}
                      className="inline-flex items-center gap-2 rounded-2xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50">
                      {isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Odebrat
                    </button>
                  </div>
                </div>

                {expanded ? (
                  <p className="mt-4 whitespace-pre-wrap border-t border-white/10 pt-4 text-sm text-zinc-400">
                    {item.description_snapshot || "Bez detailního popisu."}
                  </p>
                ) : null}
              </div>
            )
          })
        ) : (
          <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-center text-zinc-400">
            V tomhle plánu zatím nejsou žádné tresty.
          </div>
        )}
      </div>

      {isPending ? (
        <div className="mt-4 inline-flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Ukládám změnu...
        </div>
      ) : null}
    </section>
  )
}
