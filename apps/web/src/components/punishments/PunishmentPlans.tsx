'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, Edit3, Eye, Loader2, Trash2, X } from 'lucide-react';
import {
  createPunishmentPlan,
  deletePunishmentPlan,
  updatePunishmentPlan,
} from '@/actions/punishments';
import { PunishmentPlan } from '@/types/punishment';
import { PunishmentPlanForm } from './PunishmentPlanForm';

type PunishmentPlansProps = {
  plans: PunishmentPlan[];
  onOpenPlan?: (plan: PunishmentPlan) => void;
};

function formatEventDate(value: string | null) {
  if (!value) return 'Bez pevného času';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Bez pevného času';

  return new Intl.DateTimeFormat('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getDoneCount(plan: PunishmentPlan) {
  return plan.items.filter((item) => item.is_done).length;
}

export function PunishmentPlans({ plans, onOpenPlan }: PunishmentPlansProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const runMutation = (mutation: () => Promise<{ error?: string } | undefined>) => {
    setError(null);
    startTransition(async () => {
      const result = await mutation();
      if (result?.error) {
        setError(result.error);
        return;
      }

      setEditingId(null);
      router.refresh();
    });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
        <h2 className="text-lg font-bold text-white">Nový plán</h2>
        <p className="mt-1 text-sm text-zinc-400">Připrav kolekci trestů pro konkrétní situaci.</p>
        <div className="mt-5">
          <PunishmentPlanForm
            submitLabel="Vytvořit plán"
            isSubmitting={isPending}
            onSubmit={(formData) => runMutation(() => createPunishmentPlan(formData))}
          />
        </div>
        {error ? (
          <div
            role="alert"
            className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100"
          >
            {error}
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        {plans.length > 0 ? (
          plans.map((plan) => {
            const isEditing = editingId === plan.id;
            const doneCount = getDoneCount(plan);

            return (
              <div key={plan.id} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                {isEditing ? (
                  <div>
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h3 className="font-bold text-white">Upravit plán</h3>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-full border border-white/10 bg-white/5 p-2 text-zinc-300 transition hover:bg-white/10"
                        aria-label="Zavřít úpravu"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <PunishmentPlanForm
                      initialValues={plan}
                      submitLabel="Uložit plán"
                      isSubmitting={isPending}
                      onSubmit={(formData) => runMutation(() => updatePunishmentPlan(plan.id, formData))}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-white">{plan.title}</h3>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-zinc-300">
                          {doneCount}/{plan.items.length} hotovo
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-zinc-400">
                        {plan.description || 'Bez detailního popisu.'}
                      </p>
                      <p className="mt-3 inline-flex items-center gap-2 text-sm text-zinc-500">
                        <CalendarClock className="h-4 w-4 text-primary" />
                        {formatEventDate(plan.event_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
                      <button
                        type="button"
                        onClick={() => onOpenPlan?.(plan)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary/20"
                      >
                        <Eye className="h-4 w-4" />
                        Otevřít
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(plan.id)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
                      >
                        <Edit3 className="h-4 w-4" />
                        Upravit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm('Opravdu smazat tento plán?')) {
                            runMutation(() => deletePunishmentPlan(plan.id));
                          }
                        }}
                        disabled={isPending}
                        className="inline-flex items-center gap-2 rounded-2xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/20 disabled:opacity-50"
                      >
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        Smazat
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center text-zinc-400">
            Zatím nemáš žádný plán trestů.
          </div>
        )}
      </section>
    </div>
  );
}
