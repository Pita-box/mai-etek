"use client";

import { useMemo, useState, useTransition } from "react";
import { Heart, Plus, Search } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { createWish } from "@/actions/wishes";
import { EmptyState } from "@/components/shared/EmptyState";
import { useToast } from "@/components/shared/useToast";
import { fadeInUp } from "@/lib/motion";
import type { Wish, WishStatus, WishViewerRole } from "@/types/wish";
import { WishCard } from "./WishCard";
import { WishFilters } from "./WishFilters";
import { WishForm } from "./WishForm";

type WishesClientProps = {
  wishes: Wish[];
  role: WishViewerRole;
};

export function WishesClient({ wishes, role }: WishesClientProps) {
  const router = useRouter();
  const toast = useToast();
  const prefersReducedMotion = useReducedMotion();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<WishStatus | "all">("all");
  const [formKey, setFormKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredWishes = useMemo(() => {
    const query = search.trim().toLowerCase();

    return wishes.filter((wish) => {
      const matchesSearch = !query
        || wish.title.toLowerCase().includes(query)
        || (wish.description || "").toLowerCase().includes(query);
      const matchesStatus = status === "all" || wish.status === status;

      return matchesSearch && matchesStatus;
    });
  }, [search, status, wishes]);

  const createNewWish = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await createWish(formData);
      if (result?.error) {
        setError(result.error);
        toast.error("Přání se nepodařilo vytvořit.", result.error);
        return;
      }
      setFormKey((current) => current + 1);
      toast.success("Přání bylo vytvořeno.");
      router.refresh();
    });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 md:p-6">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-primary">Phase 3</p>
          <h1 className="mt-2 flex items-center gap-3 text-4xl font-bold text-white">
            <Heart className="h-9 w-9 text-primary" />
            Přání
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            {role === "sub"
              ? "Tvoje přání a ukázková média na jednom místě."
              : "Přání od SUB, jejich stav a soukromé DOM poznámky."}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-right">
          <p className="text-3xl font-bold text-white">{wishes.length}</p>
          <p className="text-xs font-semibold uppercase text-zinc-500">celkem</p>
        </div>
      </div>

      {role === "sub" ? (
        <section className="rounded-3xl border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl bg-primary/15 p-3 text-primary ring-1 ring-primary/20">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Nové přání</h2>
              <p className="text-sm text-zinc-500">Název, kontext a média.</p>
            </div>
          </div>

          {error ? (
            <div role="alert" className="mb-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          <WishForm key={formKey} submitLabel="Vytvořit přání" isSubmitting={isPending} onSubmit={createNewWish} />
        </section>
      ) : null}

      <WishFilters
        search={search}
        status={status}
        onSearchChange={setSearch}
        onStatusChange={setStatus}
      />

      <section className="space-y-4">
        {filteredWishes.length > 0 ? (
          filteredWishes.map((wish) => (
            <motion.div
              key={wish.id}
              initial={prefersReducedMotion ? false : "hidden"}
              animate="visible"
              variants={fadeInUp}
            >
              <WishCard wish={wish} role={role} />
            </motion.div>
          ))
        ) : (
          <EmptyState
            icon={search || status !== "all" ? Search : Heart}
            title={
              wishes.length === 0
                ? role === "sub"
                  ? "Zatím nejsou přidaná žádná přání."
                  : "SUB zatím nepřidal žádná přání."
                : "Žádné přání neodpovídá aktuálním filtrům."
            }
            description={
              wishes.length === 0
                ? role === "sub"
                  ? "Až odešleš první přání, zobrazí se v seznamu pod formulářem."
                  : "Nová přání od SUBa se zobrazí tady."
                : "Uprav hledání nebo filtr stavu."
            }
            actionLabel={role === "sub" && wishes.length === 0 ? "Přidat přání" : undefined}
            onAction={
              role === "sub" && wishes.length === 0
                ? () => document.querySelector<HTMLInputElement>('input[name="title"]')?.focus()
                : undefined
            }
          />
        )}
      </section>
    </div>
  );
}
