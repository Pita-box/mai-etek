"use client";

import { FormEvent } from "react";
import { Gift, Loader2, Save, X } from "lucide-react";
import type { Reward } from "@/types/gamification";

type RewardFormProps = {
  initialValues?: Pick<
    Reward,
    "title" | "description" | "costPoints" | "isActive"
  >;
  submitLabel: string;
  isSubmitting?: boolean;
  onSubmit: (formData: FormData) => void | Promise<void>;
  onCancel?: () => void;
};

export function RewardForm({
  initialValues,
  submitLabel,
  isSubmitting = false,
  onSubmit,
  onCancel,
}: RewardFormProps) {
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit(new FormData(event.currentTarget));
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl"
    >
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-2xl bg-primary/15 p-3 text-primary ring-1 ring-primary/20">
          <Gift className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Odměna</h2>
          <p className="text-sm text-zinc-400">
            Cena se odečte z dostupných XP při claimu.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_160px]">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-zinc-300">
            Název
          </span>
          <input
            name="title"
            required
            maxLength={160}
            defaultValue={initialValues?.title || ""}
            disabled={isSubmitting}
            className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder:text-zinc-600 focus:border-primary/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            placeholder="Např. Volný večer"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-zinc-300">
            Cena XP
          </span>
          <input
            name="cost_points"
            type="number"
            min={1}
            required
            defaultValue={initialValues?.costPoints || 25}
            disabled={isSubmitting}
            className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder:text-zinc-600 focus:border-primary/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
      </div>

      <label className="mt-4 block">
        <span className="mb-2 block text-sm font-medium text-zinc-300">
          Popis
        </span>
        <textarea
          name="description"
          maxLength={1200}
          rows={3}
          defaultValue={initialValues?.description || ""}
          disabled={isSubmitting}
          className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder:text-zinc-600 focus:border-primary/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          placeholder="Co přesně SUB dostane a za jakých podmínek."
        />
      </label>

      <label className="mt-4 inline-flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold text-zinc-300">
        <input
          name="is_active"
          type="checkbox"
          defaultChecked={initialValues?.isActive ?? true}
          disabled={isSubmitting}
          className="h-4 w-4 accent-primary"
        />
        Aktivní odměna
      </label>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {submitLabel}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-zinc-200 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-4 w-4" />
            Zrušit
          </button>
        ) : null}
      </div>
    </form>
  );
}
