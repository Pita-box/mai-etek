"use client"

import { FormEvent, useState } from "react"
import { Loader2, Plus, X } from "lucide-react"
import { Punishment, PunishmentSeverity } from "@/types/punishment"

type PunishmentFormProps = {
  initialValues?: Pick<
    Punishment,
    "title" | "description" | "severity" | "categories"
  >
  existingCategories?: string[]
  submitLabel: string
  isSubmitting?: boolean
  onSubmit: (formData: FormData) => void | Promise<void>
}

const severityOptions = [1, 2, 3, 4, 5] satisfies PunishmentSeverity[]

function normalizeCategory(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 40).trim()
}

export function PunishmentForm({
  initialValues,
  existingCategories = [],
  submitLabel,
  isSubmitting = false,
  onSubmit,
}: PunishmentFormProps) {
  const [severity, setSeverity] = useState<PunishmentSeverity>(
    initialValues?.severity || 2,
  )
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    initialValues?.categories || [],
  )
  const [categoryInput, setCategoryInput] = useState("")

  const availableCategories = existingCategories.filter(
    (category) =>
      !selectedCategories.some(
        (selected) => selected.toLowerCase() === category.toLowerCase(),
      ),
  )

  const addCategory = (value: string) => {
    const category = normalizeCategory(value)
    if (
      !category ||
      selectedCategories.length >= 12 ||
      selectedCategories.some(
        (selected) => selected.toLowerCase() === category.toLowerCase(),
      )
    ) {
      setCategoryInput("")
      return
    }

    setSelectedCategories((currentCategories) => [
      ...currentCategories,
      category,
    ])
    setCategoryInput("")
  }

  const removeCategory = (category: string) => {
    setSelectedCategories((currentCategories) =>
      currentCategories.filter((item) => item !== category),
    )
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    formData.set("severity", severity.toString())
    await onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-300">
          Název
        </label>
        <input
          name="title"
          defaultValue={initialValues?.title || ""}
          required
          maxLength={255}
          className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder:text-zinc-600 focus:border-primary/60 focus:outline-none"
          placeholder="Název trestu"
          disabled={isSubmitting}
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-300">
          Popis
        </label>
        <textarea
          name="description"
          defaultValue={initialValues?.description || ""}
          maxLength={4000}
          rows={4}
          className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder:text-zinc-600 focus:border-primary/60 focus:outline-none"
          placeholder="Instrukce, rozsah, podmínky splnění..."
          disabled={isSubmitting}
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-300">
          Náročnost
        </label>
        <div className="grid grid-cols-5 gap-2">
          {severityOptions.map((value) => {
            const active = severity === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => setSeverity(value)}
                disabled={isSubmitting}
                className={`h-10 rounded-xl border text-sm font-bold transition ${
                  active
                    ? "border-primary/70 bg-primary text-white"
                    : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
                }`}>
                {value}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-300">
          Kategorie
        </label>
        <div className="flex gap-2">
          <input
            value={categoryInput}
            onChange={(event) => setCategoryInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                addCategory(categoryInput)
              }
            }}
            maxLength={40}
            className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder:text-zinc-600 focus:border-primary/60 focus:outline-none"
            placeholder="Přidat kategorii"
            disabled={isSubmitting || selectedCategories.length >= 12}
          />
          <button
            type="button"
            onClick={() => addCategory(categoryInput)}
            disabled={
              isSubmitting ||
              !categoryInput.trim() ||
              selectedCategories.length >= 12
            }
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-zinc-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Přidat kategorii">
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {selectedCategories.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedCategories.map((category) => (
              <span
                key={category}
                className="inline-flex max-w-full items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <input type="hidden" name="categories" value={category} />
                <span className="truncate">{category}</span>
                <button
                  type="button"
                  onClick={() => removeCategory(category)}
                  disabled={isSubmitting}
                  className="shrink-0 text-primary/80 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`Odebrat kategorii ${category}`}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        {availableCategories.length > 0 ? (
          <div className="mt-3">
            <p className="mb-2 text-xs font-semibold uppercase text-zinc-500">
              Vybrat z existujících
            </p>
            <div className="flex flex-wrap gap-2">
              {availableCategories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => addCategory(category)}
                  disabled={isSubmitting || selectedCategories.length >= 12}
                  className="max-w-full rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-zinc-300 transition hover:border-primary/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-50">
                  <span className="block truncate">{category}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {submitLabel}
      </button>
    </form>
  )
}
