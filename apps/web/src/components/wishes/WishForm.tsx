"use client";

import { FormEvent } from "react";
import { Loader2, Send } from "lucide-react";
import type { Wish } from "@/types/wish";

type WishFormProps = {
  initialValues?: Pick<Wish, "title" | "description">;
  submitLabel: string;
  isSubmitting?: boolean;
  onSubmit: (formData: FormData) => void | Promise<void>;
};

export function WishForm({ initialValues, submitLabel, isSubmitting = false, onSubmit }: WishFormProps) {
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-300">Název</label>
        <input
          name="title"
          defaultValue={initialValues?.title || ""}
          required
          maxLength={255}
          disabled={isSubmitting}
          className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder:text-zinc-600 focus:border-primary/60 focus:outline-none"
          placeholder="Co si přeješ?"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-300">Popis</label>
        <textarea
          name="description"
          defaultValue={initialValues?.description || ""}
          maxLength={4000}
          rows={4}
          disabled={isSubmitting}
          className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder:text-zinc-600 focus:border-primary/60 focus:outline-none"
          placeholder="Detaily, představa, hranice, kontext..."
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {submitLabel}
      </button>
    </form>
  );
}
