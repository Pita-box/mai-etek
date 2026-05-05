"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Gift,
  Loader2,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import type { RewardClaim, RewardClaimStatus } from "@/types/gamification";

type RewardClaimsPanelProps = {
  claims: RewardClaim[];
  role: "dom" | "sub";
  isPending?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onReview?: (
    claimId: string,
    nextStatus: Extract<RewardClaimStatus, "approved" | "rejected">,
    note?: string,
  ) => void;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusView(status: RewardClaimStatus) {
  if (status === "approved") {
    return {
      icon: CheckCircle2,
      label: "Schváleno",
      className: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
    };
  }

  if (status === "rejected") {
    return {
      icon: RotateCcw,
      label: "Odmítnuto, XP vráceny",
      className: "border-rose-400/20 bg-rose-500/10 text-rose-100",
    };
  }

  return {
    icon: Clock3,
    label: "Čeká",
    className: "border-primary/30 bg-primary/10 text-primary",
  };
}

export function RewardClaimsPanel({
  claims,
  role,
  isPending = false,
  emptyTitle = "Zatím tu nejsou žádné claimy odměn.",
  emptyDescription = "Žádosti o odměny se zobrazí v této sekci.",
  onReview,
}: RewardClaimsPanelProps) {
  const [notes, setNotes] = useState<Record<string, string>>({});

  if (claims.length === 0) {
    return (
      <EmptyState
        icon={Gift}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <div className="divide-y divide-white/10 rounded-3xl border border-white/10 bg-white/[0.045] p-2 backdrop-blur-xl">
      {claims.map((claim) => {
        const status = statusView(claim.status);
        const StatusIcon = status.icon;
        const canReview = role === "dom" && claim.status === "pending";

        return (
          <div key={claim.id} className="p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${status.className}`}
                  >
                    <StatusIcon className="h-3.5 w-3.5" />
                    {status.label}
                  </span>
                  <span className="rounded-full border border-white/10 bg-black/35 px-3 py-1 text-xs font-semibold text-zinc-300">
                    {claim.costPoints} XP
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white">
                  {claim.rewardTitle}
                </h3>
                <p className="mt-1 text-sm text-zinc-400">
                  {claim.rewardDescription || "Bez popisu."}
                </p>
                <p className="mt-3 text-xs text-zinc-500">
                  Zažádáno {formatDate(claim.requestedAt)}
                  {claim.reviewedAt ? `, vyřízeno ${formatDate(claim.reviewedAt)}` : ""}
                </p>
                {claim.reviewNote ? (
                  <p className="mt-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-300">
                    {claim.reviewNote}
                  </p>
                ) : null}
              </div>

              {canReview ? (
                <div className="w-full shrink-0 space-y-3 lg:w-80">
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase text-zinc-500">
                      Poznámka
                    </span>
                    <textarea
                      value={notes[claim.id] || ""}
                      onChange={(event) =>
                        setNotes((current) => ({
                          ...current,
                          [claim.id]: event.target.value,
                        }))
                      }
                      rows={2}
                      maxLength={500}
                      disabled={isPending}
                      className="w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-primary/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                      placeholder="Volitelné"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onReview?.(claim.id, "approved", notes[claim.id])
                      }
                      disabled={isPending}
                      className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-100 transition hover:bg-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-300/60 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      Schválit
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onReview?.(claim.id, "rejected", notes[claim.id])
                      }
                      disabled={isPending}
                      className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-100 transition hover:bg-rose-500/20 focus:outline-none focus:ring-2 focus:ring-rose-300/60 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" />
                      Odmítnout
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
