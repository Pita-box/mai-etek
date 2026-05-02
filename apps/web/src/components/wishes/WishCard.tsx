"use client";

import { useRef, useState, useTransition } from "react";
import {
  CalendarDays,
  Heart,
  Loader2,
  Pencil,
  Trash2,
  User,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { deleteWish, updateWish } from "@/actions/wishes";
import type { Wish, WishStatus, WishViewerRole } from "@/types/wish";
import { WishDomControls } from "./WishDomControls";
import { WishForm } from "./WishForm";
import { WishMediaStrip } from "./WishMediaStrip";
import { WishMediaUpload } from "./WishMediaUpload";
import { useWishCardReadTracking } from "./useWishCardReadTracking";

type WishCardProps = {
  wish: Wish;
  role: WishViewerRole;
};

const statusCopy: Record<WishStatus, string> = {
  new: "Nové",
  noted: "Vzato na vědomí",
  planned: "Naplánováno",
  fulfilled: "Splněno",
  declined: "Zamítnuto",
};

const statusClass: Record<WishStatus, string> = {
  new: "border-primary/30 bg-primary/10 text-primary",
  noted: "border-white/15 bg-white/10 text-zinc-200",
  planned: "border-amber-300/25 bg-amber-300/10 text-amber-200",
  fulfilled: "border-emerald-300/25 bg-emerald-300/10 text-emerald-200",
  declined: "border-rose-300/25 bg-rose-400/10 text-rose-200",
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function isEditableStatus(status: WishStatus) {
  return status === "new" || status === "noted";
}

export function WishCard({ wish, role }: WishCardProps) {
  const router = useRouter();
  const cardRef = useRef<HTMLElement | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const canEdit = role === "sub" && isEditableStatus(wish.status);

  useWishCardReadTracking({ wishId: wish.id, cardRef });

  const updateCurrentWish = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await updateWish(wish.id, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setIsEditing(false);
      router.refresh();
    });
  };

  const removeCurrentWish = () => {
    if (!window.confirm("Opravdu chceš smazat toto přání?")) return;

    setError(null);
    startTransition(async () => {
      const result = await deleteWish(wish.id);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <article
      ref={cardRef}
      className="rounded-3xl border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl transition hover:border-primary/25 hover:bg-white/[0.06]"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClass[wish.status]}`}
            >
              {statusCopy[wish.status]}
            </span>
          </div>

          <h2 className="break-words text-2xl font-bold text-white">
            {wish.title}
          </h2>

          <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatDate(wish.created_at)}
            </span>
            {role === "dom" ? (
              <span className="inline-flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                {wish.creator_name || "SUB"}
              </span>
            ) : null}
          </div>

          {wish.description ? (
            <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-300">
              {wish.description}
            </p>
          ) : (
            <p className="mt-4 text-sm text-zinc-500">Bez popisu.</p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
          {canEdit ? (
            <>
              <button
                type="button"
                onClick={() => setIsEditing((current) => !current)}
                disabled={isPending}
                className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Pencil className="h-4 w-4" />
                Upravit
              </button>
              <button
                type="button"
                onClick={removeCurrentWish}
                disabled={isPending}
                className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/20 focus:outline-none focus:ring-2 focus:ring-rose-300/60 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Smazat
              </button>
            </>
          ) : role === "sub" ? (
            <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-semibold text-zinc-500">
              <Heart className="h-4 w-4" />
              Uzamčeno
            </span>
          ) : null}
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
        >
          {error}
        </div>
      ) : null}

      {isEditing ? (
        <div className="mt-5 border-t border-white/10 pt-5">
          <WishForm
            initialValues={wish}
            submitLabel="Uložit přání"
            isSubmitting={isPending}
            onSubmit={updateCurrentWish}
          />
        </div>
      ) : null}

      <div className="mt-5 space-y-5">
        <WishMediaStrip
          media={wish.media}
          canDelete={canEdit || role === "dom"}
        />
        {canEdit ? <WishMediaUpload wishId={wish.id} /> : null}
        {role === "dom" ? (
          <WishDomControls key={`${wish.id}-${wish.status}`} wish={wish} />
        ) : null}
      </div>
    </article>
  );
}
