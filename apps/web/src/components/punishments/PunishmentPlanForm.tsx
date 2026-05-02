'use client';

import { FormEvent } from 'react';
import { Calendar, Loader2 } from 'lucide-react';
import { PunishmentPlan } from '@/types/punishment';

type PunishmentPlanFormProps = {
  initialValues?: Pick<PunishmentPlan, 'title' | 'description' | 'event_at'>;
  submitLabel: string;
  isSubmitting?: boolean;
  onSubmit: (formData: FormData) => void | Promise<void>;
};

function formatDateTimeLocal(value?: string | null) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const pad = (part: number) => part.toString().padStart(2, '0');
  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    'T',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes()),
  ].join('');
}

export function PunishmentPlanForm({
  initialValues,
  submitLabel,
  isSubmitting = false,
  onSubmit,
}: PunishmentPlanFormProps) {
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit(new FormData(event.currentTarget));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-300">Název plánu</label>
        <input
          name="title"
          defaultValue={initialValues?.title || ''}
          required
          maxLength={255}
          className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder:text-zinc-600 focus:border-primary/60 focus:outline-none"
          placeholder="Např. Večer po kontrole"
          disabled={isSubmitting}
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-300">Popis</label>
        <textarea
          name="description"
          defaultValue={initialValues?.description || ''}
          maxLength={4000}
          rows={4}
          className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder:text-zinc-600 focus:border-primary/60 focus:outline-none"
          placeholder="Kdy a proč tenhle plán otevřít..."
          disabled={isSubmitting}
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-300">Čas akce</label>
        <div className="relative">
          <Calendar className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            name="event_at"
            type="datetime-local"
            defaultValue={formatDateTimeLocal(initialValues?.event_at)}
            className="w-full rounded-2xl border border-white/10 bg-black/40 py-3 pl-11 pr-4 text-white focus:border-primary/60 focus:outline-none"
            disabled={isSubmitting}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {submitLabel}
      </button>
    </form>
  );
}
