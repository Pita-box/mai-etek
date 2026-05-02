"use client";

import { AlertTriangle, CheckCircle2, Loader2, Save, X } from "lucide-react";
import type { Achievement } from "@/types/gamification";

type AchievementFormProps = {
  initialValues?: Achievement | null;
  submitLabel: string;
  isSubmitting?: boolean;
  onSubmit: (formData: FormData) => void;
  onCancel: () => void;
};

const conditionOptions = [
  { value: "tasks_completed", label: "Dokončené úkoly" },
  { value: "points", label: "Celkové XP" },
  { value: "level", label: "Level" },
  { value: "streak", label: "Nejdelší série" },
  { value: "perfect_rating_count", label: "Perfektní hodnocení" },
];

const iconOptions = [
  { value: "trophy", label: "Trofej" },
  { value: "star", label: "Hvězda" },
  { value: "coins", label: "XP mince" },
  { value: "clipboard-check", label: "Úkoly" },
  { value: "flame", label: "Série" },
  { value: "shield-alert", label: "Kázeň" },
  { value: "alert-triangle", label: "Varování" },
  { value: "ban", label: "Zákaz" },
];

export function AchievementForm({
  initialValues,
  submitLabel,
  isSubmitting = false,
  onSubmit,
  onCancel,
}: AchievementFormProps) {
  const defaultBadgeType = initialValues?.badgeType || "positive";

  return (
    <form
      action={onSubmit}
      className="rounded-3xl border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="block text-sm font-semibold text-zinc-300">
          Název
          <input
            name="title"
            required
            maxLength={160}
            defaultValue={initialValues?.title || ""}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white placeholder:text-zinc-600 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Např. Bezchybný týden"
          />
        </label>

        <label className="block text-sm font-semibold text-zinc-300">
          Ikona
          <select
            name="icon_name"
            defaultValue={initialValues?.iconName || "trophy"}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {iconOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="lg:col-span-2">
          <legend className="text-sm font-semibold text-zinc-300">Typ</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-zinc-200 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/10">
              <input
                type="radio"
                name="badge_type"
                value="positive"
                defaultChecked={defaultBadgeType === "positive"}
                className="h-4 w-4 accent-primary"
              />
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Pozitivní odznak
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-zinc-200 has-[:checked]:border-rose-400/50 has-[:checked]:bg-rose-500/10">
              <input
                type="radio"
                name="badge_type"
                value="negative"
                defaultChecked={defaultBadgeType === "negative"}
                className="h-4 w-4 accent-primary"
              />
              <AlertTriangle className="h-4 w-4 text-rose-200" />
              Kázeňský odznak
            </label>
          </div>
        </fieldset>

        <label className="block text-sm font-semibold text-zinc-300">
          Podmínka
          <select
            name="condition_type"
            defaultValue={initialValues?.conditionType || "tasks_completed"}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {conditionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-semibold text-zinc-300">
          Hodnota podmínky
          <input
            name="condition_value"
            type="number"
            min={1}
            defaultValue={initialValues?.conditionValue || 1}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </label>

        <label className="block text-sm font-semibold text-zinc-300">
          XP odměna
          <input
            name="xp_reward"
            type="number"
            min={0}
            defaultValue={initialValues?.xpReward || 0}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </label>

        <label className="block text-sm font-semibold text-zinc-300">
          XP penalizace
          <input
            name="xp_penalty"
            type="number"
            min={0}
            defaultValue={initialValues?.xpPenalty || 0}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </label>

        <label className="block text-sm font-semibold text-zinc-300 lg:col-span-2">
          Popis
          <textarea
            name="description"
            maxLength={1200}
            defaultValue={initialValues?.description || ""}
            className="mt-2 min-h-24 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white placeholder:text-zinc-600 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Co tento odznak znamená..."
          />
        </label>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="inline-flex cursor-pointer items-center gap-3 text-sm font-semibold text-zinc-300">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={initialValues?.isActive ?? true}
            className="h-4 w-4 accent-primary"
          />
          Aktivní v katalogu
        </label>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-zinc-200 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-4 w-4" />
            Zavřít
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
