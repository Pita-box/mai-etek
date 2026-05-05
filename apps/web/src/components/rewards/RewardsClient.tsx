"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Coins, Gift, Loader2, Plus } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { markPageNotificationsRead } from "@/actions/notifications";
import {
  claimReward,
  createReward,
  deleteReward,
  reviewRewardClaim,
  updateReward,
} from "@/actions/rewards";
import { EmptyState } from "@/components/shared/EmptyState";
import { useToast } from "@/components/shared/useToast";
import { fadeInUp } from "@/lib/motion";
import type {
  Reward,
  RewardClaim,
  RewardClaimStatus,
  RewardsData,
} from "@/types/gamification";
import { RewardCard } from "./RewardCard";
import { RewardClaimsPanel } from "./RewardClaimsPanel";
import { RewardForm } from "./RewardForm";

type RewardsClientProps = {
  data: RewardsData;
};

type RewardsTab = "rewards" | "claims" | "history";

function getInitialTab(data: RewardsData): RewardsTab {
  if (data.role === "dom" && data.claims.some((claim) => claim.status === "pending")) {
    return "claims";
  }

  return "rewards";
}

export function RewardsClient({ data }: RewardsClientProps) {
  const router = useRouter();
  const toast = useToast();
  const prefersReducedMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState<RewardsTab>(() =>
    getInitialTab(data),
  );
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    void markPageNotificationsRead("rewards");
  }, []);

  const pendingClaimsByRewardId = useMemo(() => {
    const claims = new Map<string, RewardClaim>();
    data.claims
      .filter((claim) => claim.status === "pending")
      .forEach((claim) => claims.set(claim.rewardId, claim));
    return claims;
  }, [data.claims]);

  const pendingClaims = data.claims.filter((claim) => claim.status === "pending");
  const historyClaims = data.claims.filter((claim) => claim.status !== "pending");

  const submitCreate = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await createReward(formData);
      if (result?.error) {
        setError(result.error);
        toast.error("Odměnu se nepodařilo vytvořit.", result.error);
        return;
      }
      setShowCreateForm(false);
      toast.success("Odměna byla vytvořena.");
      router.refresh();
    });
  };

  const submitUpdate = (rewardId: string, formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await updateReward(rewardId, formData);
      if (result?.error) {
        setError(result.error);
        toast.error("Odměnu se nepodařilo uložit.", result.error);
        return;
      }
      setEditingReward(null);
      toast.success("Odměna byla uložena.");
      router.refresh();
    });
  };

  const removeReward = (rewardId: string) => {
    if (!window.confirm("Opravdu chceš smazat tuto odměnu?")) return;

    setError(null);
    startTransition(async () => {
      const result = await deleteReward(rewardId);
      if (result?.error) {
        setError(result.error);
        toast.error("Odměnu se nepodařilo smazat.", result.error);
        return;
      }
      toast.success("Odměna byla smazána.");
      router.refresh();
    });
  };

  const claim = (rewardId: string) => {
    setError(null);
    startTransition(async () => {
      const result = await claimReward(rewardId);
      if (result?.error) {
        setError(result.error);
        toast.error("Žádost o odměnu se nepodařilo odeslat.", result.error);
        return;
      }
      setActiveTab("claims");
      toast.success("Žádost o odměnu byla odeslána.");
      router.refresh();
    });
  };

  const review = (
    claimId: string,
    nextStatus: Extract<RewardClaimStatus, "approved" | "rejected">,
    note?: string,
  ) => {
    setError(null);
    startTransition(async () => {
      const result = await reviewRewardClaim(claimId, nextStatus, note);
      if (result?.error) {
        setError(result.error);
        toast.error("Žádost se nepodařilo vyřídit.", result.error);
        return;
      }
      toast.success(
        nextStatus === "approved"
          ? "Žádost o odměnu byla schválena."
          : "Žádost o odměnu byla odmítnuta.",
      );
      router.refresh();
    });
  };

  const tabs: Array<{ key: RewardsTab; label: string; count: number }> =
    data.role === "dom"
      ? [
          { key: "rewards", label: "Odměny", count: data.rewards.length },
          { key: "claims", label: "Ke schválení", count: pendingClaims.length },
          { key: "history", label: "Historie", count: historyClaims.length },
        ]
      : [
          { key: "rewards", label: "Dostupné", count: data.rewards.length },
          { key: "claims", label: "Moje žádosti", count: pendingClaims.length },
          { key: "history", label: "Historie", count: historyClaims.length },
        ];

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-primary">
            Gamifikace
          </p>
          <h1 className="mt-2 flex items-center gap-3 text-4xl font-bold text-white">
            <Gift className="h-9 w-9 text-primary" />
            Odměny
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            {data.role === "dom"
              ? `Správa odměn a claimů pro ${data.subject.name}.`
              : "Utrať dostupné XP za odměny a sleduj stav žádostí."}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-3xl border border-white/10 bg-black/30 px-5 py-4 text-right">
            <p className="flex items-center justify-end gap-2 text-3xl font-bold text-white">
              {data.stats.availablePoints}
              <Coins className="h-6 w-6 text-primary" />
            </p>
            <p className="text-xs font-semibold uppercase text-zinc-500">
              dostupné XP
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-black/30 px-5 py-4 text-right">
            <p className="text-3xl font-bold text-white">
              {pendingClaims.length}
            </p>
            <p className="text-xs font-semibold uppercase text-zinc-500">
              čeká
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-primary/60 ${
                  active
                    ? "border-primary/60 bg-primary text-white"
                    : "border-white/10 bg-white/[0.045] text-zinc-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                {tab.label}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-white/20 text-white" : "bg-black/35 text-zinc-400"}`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          {isPending ? (
            <span className="inline-flex items-center gap-2 text-sm text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
              Ukládám
            </span>
          ) : null}
          {data.role === "dom" ? (
            <button
              type="button"
              onClick={() => {
                setEditingReward(null);
                setShowCreateForm((current) => !current);
              }}
              className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/60"
            >
              <Plus className="h-4 w-4" />
              Nová odměna
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
        >
          {error}
        </div>
      ) : null}

      {showCreateForm && data.role === "dom" ? (
        <RewardForm
          submitLabel="Vytvořit odměnu"
          isSubmitting={isPending}
          onSubmit={submitCreate}
          onCancel={() => setShowCreateForm(false)}
        />
      ) : null}

      {editingReward ? (
        <RewardForm
          initialValues={editingReward}
          submitLabel="Uložit změny"
          isSubmitting={isPending}
          onSubmit={(formData) => submitUpdate(editingReward.id, formData)}
          onCancel={() => setEditingReward(null)}
        />
      ) : null}

      {activeTab === "rewards" ? (
        data.rewards.length > 0 ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.rewards.map((reward) => (
              <motion.div
                key={reward.id}
                initial={prefersReducedMotion ? false : "hidden"}
                animate="visible"
                variants={fadeInUp}
              >
                <RewardCard
                  reward={reward}
                  role={data.role}
                  availablePoints={data.stats.availablePoints}
                  pendingClaim={pendingClaimsByRewardId.get(reward.id)}
                  isPending={isPending}
                  onClaim={() => claim(reward.id)}
                  onEdit={() => {
                    setShowCreateForm(false);
                    setEditingReward(reward);
                  }}
                  onDelete={() => removeReward(reward.id)}
                />
              </motion.div>
            ))}
          </section>
        ) : (
          <EmptyState
            icon={Gift}
            title={
              data.role === "dom"
                ? "Zatím nejsou vytvořené žádné odměny."
                : "Zatím nejsou dostupné žádné odměny."
            }
            description={
              data.role === "dom"
                ? "Vytvoř první odměnu, kterou může SUB získat za dostupné XP."
                : "Až DOM připraví odměny, zobrazí se tady."
            }
            actionLabel={data.role === "dom" ? "Vytvořit odměnu" : undefined}
            onAction={
              data.role === "dom" ? () => setShowCreateForm(true) : undefined
            }
          />
        )
      ) : null}

      {activeTab === "claims" ? (
        <RewardClaimsPanel
          claims={pendingClaims}
          role={data.role}
          isPending={isPending}
          onReview={review}
          emptyTitle={
            data.role === "dom"
              ? "Žádné odměny nečekají na schválení."
              : "Zatím nemáš žádné čekající žádosti."
          }
          emptyDescription={
            data.role === "dom"
              ? "Nové žádosti SUBa se zobrazí v této sekci."
              : "Po získání odměny se žádost přesune sem a bude čekat na schválení."
          }
        />
      ) : null}

      {activeTab === "history" ? (
        <RewardClaimsPanel
          claims={historyClaims}
          role={data.role}
          emptyTitle="Historie odměn je zatím prázdná."
          emptyDescription="Schválené a odmítnuté žádosti se zobrazí tady."
        />
      ) : null}
    </div>
  );
}
