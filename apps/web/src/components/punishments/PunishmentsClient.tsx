'use client';

import { useState } from 'react';
import { AlertTriangle, CalendarCheck, Library } from 'lucide-react';
import { Punishment, PunishmentPlan } from '@/types/punishment';
import { PunishmentLibrary } from './PunishmentLibrary';
import { PunishmentPlanDetail } from './PunishmentPlanDetail';
import { PunishmentPlans } from './PunishmentPlans';

type PunishmentsClientProps = {
  templates: Punishment[];
  plans: PunishmentPlan[];
};

type PunishmentTab = 'library' | 'plans';

export function PunishmentsClient({ templates, plans }: PunishmentsClientProps) {
  const [activeTab, setActiveTab] = useState<PunishmentTab>('library');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) || null;

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">DOM/SUB workflow</p>
          <h1 className="mt-2 flex items-center gap-3 text-4xl font-black tracking-tight text-white">
            <AlertTriangle className="h-9 w-9 text-primary" />
            Knihovna trestů
          </h1>
          <p className="mt-1 text-zinc-400">
            Uložené návrhy trestů, aby DOM nemusel pokaždé začínat od nuly.
          </p>
        </div>
      </div>

      <div className="inline-flex rounded-2xl border border-white/10 bg-white/[0.04] p-1">
        <button
          type="button"
          onClick={() => setActiveTab('library')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
            activeTab === 'library'
              ? 'bg-primary text-white'
              : 'text-zinc-400 hover:bg-white/10 hover:text-white'
          }`}
        >
          <Library className="h-4 w-4" />
          Knihovna
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('plans')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
            activeTab === 'plans'
              ? 'bg-primary text-white'
              : 'text-zinc-400 hover:bg-white/10 hover:text-white'
          }`}
        >
          <CalendarCheck className="h-4 w-4" />
          Plány
          <span className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-xs">
            {plans.length}
          </span>
        </button>
      </div>

      {activeTab === 'library' ? (
        <PunishmentLibrary templates={templates} />
      ) : (
        <div className="space-y-6">
          <PunishmentPlans plans={plans} onOpenPlan={(plan) => setSelectedPlanId(plan.id)} />
          {selectedPlan ? (
            <PunishmentPlanDetail
              plan={selectedPlan}
              templates={templates}
              onClose={() => setSelectedPlanId(null)}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
