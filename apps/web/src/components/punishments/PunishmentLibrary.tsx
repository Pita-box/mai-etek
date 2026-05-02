"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Edit3, Loader2, Search, Tag, Trash2, X } from "lucide-react"
import {
  createPunishmentTemplate,
  deletePunishmentTemplate,
  incrementPunishmentTemplateUsage,
  updatePunishmentTemplate,
} from "@/actions/punishments"
import { Punishment } from "@/types/punishment"
import { PunishmentForm } from "./PunishmentForm"

type PunishmentLibraryProps = {
  templates: Punishment[]
}

export function PunishmentLibrary({ templates }: PunishmentLibraryProps) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [severityFilter, setSeverityFilter] = useState<"all" | string>("all")
  const [categoryFilter, setCategoryFilter] = useState<"all" | string>("all")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const categories = useMemo(() => {
    const categoryCounts = new Map<string, number>()

    for (const template of templates) {
      for (const category of template.categories) {
        categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1)
      }
    }

    return Array.from(categoryCounts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "cs"))
      .map(([category]) => category)
  }, [templates])

  const filteredTemplates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return templates.filter((template) => {
      const matchesQuery =
        !normalizedQuery ||
        template.title.toLowerCase().includes(normalizedQuery) ||
        (template.description || "").toLowerCase().includes(normalizedQuery)
      const matchesSeverity =
        severityFilter === "all" ||
        template.severity.toString() === severityFilter
      const matchesCategory =
        categoryFilter === "all" || template.categories.includes(categoryFilter)

      return matchesQuery && matchesSeverity && matchesCategory
    })
  }, [categoryFilter, query, severityFilter, templates])

  const runMutation = (
    mutation: () => Promise<{ error?: string } | undefined>,
  ) => {
    setError(null)
    startTransition(async () => {
      const result = await mutation()
      if (result?.error) {
        setError(result.error)
        return
      }
      setEditingId(null)
      router.refresh()
    })
  }

  const incrementUsage = (templateId: string) => {
    runMutation(() => incrementPunishmentTemplateUsage(templateId))
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
        <h2 className="text-lg font-bold text-white">Nová šablona</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Připrav trest, který půjde později rychle přiřadit.
        </p>
        <div className="mt-5">
          <PunishmentForm
            existingCategories={categories}
            submitLabel="Vytvořit šablonu"
            isSubmitting={isPending}
            onSubmit={(formData) =>
              runMutation(() => createPunishmentTemplate(formData))
            }
          />
        </div>
        {error ? (
          <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_12rem]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/40 py-3 pl-11 pr-4 text-white placeholder:text-zinc-600 focus:border-primary/60 focus:outline-none"
                placeholder="Filtrovat podle názvu nebo popisu"
              />
            </label>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white focus:border-primary/60 focus:outline-none">
              <option value="all">Všechny kategorie</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <select
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value)}
              className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white focus:border-primary/60 focus:outline-none">
              <option value="all">Všechny Náročnosti</option>
              <option value="5">Náročnost 5</option>
              <option value="4">Náročnost 4</option>
              <option value="3">Náročnost 3</option>
              <option value="2">Náročnost 2</option>
              <option value="1">Náročnost 1</option>
            </select>
          </div>
          <p className="mt-3 text-sm text-zinc-500">
            Zobrazeno {filteredTemplates.length} z {templates.length} šablon.
          </p>
        </div>

        {filteredTemplates.length > 0 ? (
          filteredTemplates.map((template) => {
            const isEditing = editingId === template.id

            return (
              <div
                key={template.id}
                role={isEditing ? undefined : "button"}
                tabIndex={isEditing ? undefined : 0}
                onClick={
                  isEditing ? undefined : () => incrementUsage(template.id)
                }
                onKeyDown={
                  isEditing
                    ? undefined
                    : (event) => {
                        if (event.target !== event.currentTarget) return
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          incrementUsage(template.id)
                        }
                      }
                }
                className={`rounded-3xl border border-white/10 bg-white/[0.04] p-5 ${
                  isEditing
                    ? ""
                    : "cursor-pointer transition hover:border-primary/30 hover:bg-white/[0.06]"
                }`}>
                {isEditing ? (
                  <div>
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h3 className="font-bold text-white">Upravit šablonu</h3>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-full border border-white/10 bg-white/5 p-2 text-zinc-300 transition hover:bg-white/10"
                        aria-label="Zavřít úpravu">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <PunishmentForm
                      initialValues={template}
                      existingCategories={categories}
                      submitLabel="Uložit šablonu"
                      isSubmitting={isPending}
                      onSubmit={(formData) =>
                        runMutation(() =>
                          updatePunishmentTemplate(template.id, formData),
                        )
                      }
                    />
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-white">
                          {template.title}
                        </h3>
                        <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                          Náročnost {template.severity}/5
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-zinc-400">
                        {template.description || "Bez detailního popisu."}
                      </p>
                      {template.categories.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {template.categories.map((category) => (
                            <button
                              key={category}
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                setCategoryFilter(category)
                              }}
                              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-xs font-semibold text-zinc-300 transition hover:border-primary/40 hover:text-white">
                              <Tag className="h-3 w-3 shrink-0 text-primary" />
                              <span className="truncate">{category}</span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-start gap-4 md:items-end">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            setEditingId(template.id)
                          }}
                          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/10">
                          <Edit3 className="h-4 w-4" />
                          Upravit
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            if (
                              window.confirm("Opravdu smazat tuto šablonu?")
                            ) {
                              runMutation(() =>
                                deletePunishmentTemplate(template.id),
                              )
                            }
                          }}
                          disabled={isPending}
                          className="inline-flex items-center gap-2 rounded-2xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/20 disabled:opacity-50">
                          {isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          Smazat
                        </button>
                      </div>
                      <div className="text-left md:text-right">
                        <p className="text-5xl font-black leading-none text-white">
                          {template.usage_count}
                        </p>
                        <p className="mt-1 text-xs font-semibold uppercase text-zinc-500">
                          využito
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        ) : (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center text-zinc-400">
            {templates.length === 0
              ? "Knihovna je zatím prázdná."
              : "Žádná šablona neodpovídá filtru."}
          </div>
        )}
      </section>
    </div>
  )
}
