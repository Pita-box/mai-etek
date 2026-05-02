'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Search } from 'lucide-react';
import { addPunishmentToPlan } from '@/actions/punishments';
import { Punishment, PunishmentPlan } from '@/types/punishment';

type AddPunishmentToPlanProps = {
  plan: PunishmentPlan;
  templates: Punishment[];
};

export function AddPunishmentToPlan({ plan, templates }: AddPunishmentToPlanProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | string>('all');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const usedTemplateIds = useMemo(
    () => new Set(plan.items.map((item) => item.template_id).filter(Boolean)),
    [plan.items]
  );

  const categories = useMemo(() => {
    const categoryCounts = new Map<string, number>();

    for (const template of templates) {
      for (const category of template.categories) {
        categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
      }
    }

    return Array.from(categoryCounts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'cs'))
      .map(([category]) => category);
  }, [templates]);

  const availableTemplates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return templates.filter((template) => {
      if (usedTemplateIds.has(template.id)) return false;

      const matchesQuery = !normalizedQuery
        || template.title.toLowerCase().includes(normalizedQuery)
        || (template.description || '').toLowerCase().includes(normalizedQuery);
      const matchesCategory = categoryFilter === 'all' || template.categories.includes(categoryFilter);

      return matchesQuery && matchesCategory;
    });
  }, [categoryFilter, query, templates, usedTemplateIds]);

  const addTemplate = (templateId: string) => {
    setError(null);
    startTransition(async () => {
      const result = await addPunishmentToPlan(plan.id, templateId);
      if (result?.error) {
        setError(result.error);
        return;
      }

      setQuery('');
      router.refresh();
    });
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="flex flex-col gap-3 md:flex-row">
        <label className="relative block min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/40 py-3 pl-11 pr-4 text-white placeholder:text-zinc-600 focus:border-primary/60 focus:outline-none"
            placeholder="Najít trest v knihovně"
          />
        </label>
        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white focus:border-primary/60 focus:outline-none md:w-56"
        >
          <option value="all">Všechny kategorie</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-3 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100"
        >
          {error}
        </div>
      ) : null}

      <div className="mt-4 grid gap-2">
        {availableTemplates.length > 0 ? (
          availableTemplates.slice(0, 6).map((template) => (
            <div
              key={template.id}
              className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-bold text-white">{template.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-zinc-500">
                  {template.description || 'Bez detailního popisu.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => addTemplate(template.id)}
                disabled={isPending}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Přidat
              </button>
            </div>
          ))
        ) : (
          <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center text-sm text-zinc-500">
            Žádný další trest neodpovídá výběru.
          </p>
        )}
      </div>
    </section>
  );
}
