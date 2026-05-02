"use server"

import { revalidatePath } from "next/cache"
import { createActivityNotification } from "@/actions/notifications"
import {
  getGamificationContext,
  normalizeUserStats,
} from "@/lib/gamification/context"
import { createClient } from "@/utils/supabase/server"
import type {
  Reward,
  RewardClaim,
  RewardClaimStatus,
  RewardsData,
} from "@/types/gamification"

type RewardRow = {
  id: string
  title: string
  description: string | null
  cost_points: number | null
  is_active: boolean | null
  created_at: string
  updated_at: string
}

type RewardClaimRow = {
  id: string
  reward_id: string
  user_id: string
  reward_title: string
  reward_description: string | null
  cost_points: number | null
  status: string | null
  requested_at: string
  reviewed_at: string | null
  review_note: string | null
}

type ReviewRewardClaimResult = {
  claim_id?: string
  user_id?: string
  status?: RewardClaimStatus
  reward_title?: string
  cost_points?: number
}

function normalizeReward(row: RewardRow): Reward {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    costPoints: row.cost_points || 0,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function normalizeRewardClaimStatus(value: string | null): RewardClaimStatus {
  if (value === "approved" || value === "rejected" || value === "cancelled") {
    return value
  }

  return "pending"
}

function normalizeRewardClaim(row: RewardClaimRow): RewardClaim {
  return {
    id: row.id,
    rewardId: row.reward_id,
    userId: row.user_id,
    rewardTitle: row.reward_title,
    rewardDescription: row.reward_description,
    costPoints: row.cost_points || 0,
    status: normalizeRewardClaimStatus(row.status),
    requestedAt: row.requested_at,
    reviewedAt: row.reviewed_at,
    reviewNote: row.review_note,
  }
}

function normalizeText(value: FormDataEntryValue | null, maxLength: number) {
  if (typeof value !== "string") return ""
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength).trim()
}

function normalizeMultilineText(
  value: FormDataEntryValue | null,
  maxLength: number,
) {
  if (typeof value !== "string") return ""
  return value.trim().slice(0, maxLength)
}

function getRewardInput(formData: FormData) {
  const title = normalizeText(formData.get("title"), 160)
  const description = normalizeMultilineText(formData.get("description"), 1200)
  const costPoints = Number.parseInt(String(formData.get("cost_points")), 10)

  if (!title) {
    return { error: "Název odměny je povinný." }
  }

  if (!Number.isFinite(costPoints) || costPoints <= 0) {
    return { error: "Cena odměny musí být kladné číslo XP." }
  }

  return {
    data: {
      title,
      description: description || null,
      cost_points: costPoints,
      is_active: formData.get("is_active") === "on",
    },
  }
}

function revalidateRewardsPaths() {
  revalidatePath("/rewards")
  revalidatePath("/dashboard")
  revalidatePath("/achievements")
}

export async function getRewardsData(): Promise<
  { data: RewardsData; error?: never } | { data?: never; error: string }
> {
  const supabase = await createClient()
  const { context, error: contextError } =
    await getGamificationContext(supabase)

  if (contextError || !context) {
    return { error: contextError || "Nepodařilo se načíst uživatele." }
  }

  const rewardQuery = supabase
    .from("rewards")
    .select(
      "id, title, description, cost_points, is_active, created_at, updated_at",
    )
    .is("deleted_at", null)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false })

  const [statsResult, rewardsResult, claimsResult] = await Promise.all([
    supabase
      .from("user_stats")
      .select("*")
      .eq("user_id", context.subject.userId)
      .maybeSingle(),
    context.role === "dom"
      ? rewardQuery.eq("created_by", context.userId)
      : rewardQuery
          .eq("is_active", true)
          .eq("created_by", context.profile.dom_id),
    supabase
      .from("reward_claims")
      .select("*")
      .eq("user_id", context.subject.userId)
      .order("created_at", { ascending: false }),
  ])

  if (statsResult.error) return { error: statsResult.error.message }
  if (rewardsResult.error) return { error: rewardsResult.error.message }
  if (claimsResult.error) return { error: claimsResult.error.message }

  return {
    data: {
      role: context.role,
      subject: context.subject,
      stats: normalizeUserStats(statsResult.data, context.subject.userId),
      rewards: ((rewardsResult.data || []) as RewardRow[]).map(normalizeReward),
      claims: ((claimsResult.data || []) as RewardClaimRow[]).map(
        normalizeRewardClaim,
      ),
    },
  }
}

export async function createReward(formData: FormData) {
  const supabase = await createClient()
  const { context, error: contextError } =
    await getGamificationContext(supabase)

  if (contextError || !context) {
    return { error: contextError || "Nepodařilo se načíst uživatele." }
  }

  if (context.role !== "dom") {
    return { error: "Odměny může spravovat pouze DOM." }
  }

  const input = getRewardInput(formData)
  if (input.error || !input.data) return { error: input.error }

  const { error } = await supabase.from("rewards").insert({
    ...input.data,
    created_by: context.userId,
  })

  if (error) {
    console.error("Error creating reward:", error)
    return { error: error.message }
  }

  revalidateRewardsPaths()
  return { success: true }
}

export async function updateReward(rewardId: string, formData: FormData) {
  const supabase = await createClient()
  const { context, error: contextError } =
    await getGamificationContext(supabase)

  if (contextError || !context) {
    return { error: contextError || "Nepodařilo se načíst uživatele." }
  }

  if (context.role !== "dom") {
    return { error: "Odměny může spravovat pouze DOM." }
  }

  const input = getRewardInput(formData)
  if (input.error || !input.data) return { error: input.error }

  const { error } = await supabase
    .from("rewards")
    .update(input.data)
    .eq("id", rewardId)
    .is("deleted_at", null)

  if (error) {
    console.error("Error updating reward:", error)
    return { error: error.message }
  }

  revalidateRewardsPaths()
  return { success: true }
}

export async function deleteReward(rewardId: string) {
  const supabase = await createClient()
  const { context, error: contextError } =
    await getGamificationContext(supabase)

  if (contextError || !context) {
    return { error: contextError || "Nepodařilo se načíst uživatele." }
  }

  if (context.role !== "dom") {
    return { error: "Odměny může spravovat pouze DOM." }
  }

  const { error } = await supabase
    .from("rewards")
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq("id", rewardId)

  if (error) {
    console.error("Error deleting reward:", error)
    return { error: error.message }
  }

  revalidateRewardsPaths()
  return { success: true }
}

export async function claimReward(rewardId: string) {
  const supabase = await createClient()
  const { context, error: contextError } =
    await getGamificationContext(supabase)

  if (contextError || !context) {
    return { error: contextError || "Nepodařilo se načíst uživatele." }
  }

  if (context.role !== "sub") {
    return { error: "Odměnu může dostat pouze SUB." }
  }

  const { data: reward } = await supabase
    .from("rewards")
    .select("title, cost_points")
    .eq("id", rewardId)
    .maybeSingle()

  const { data: claimId, error } = await supabase.rpc("claim_reward", {
    reward_uuid: rewardId,
  })

  if (error) {
    console.error("Error claiming reward:", error)
    return { error: error.message }
  }

  const claimIdString = String(claimId || "")

  if (!claimIdString) {
    return { error: "Claim odměny se nepodařilo vytvořit." }
  }

  await createActivityNotification({
    recipientId: context.profile.dom_id,
    pageKey: "rewards",
    entityType: "reward_claim",
    entityId: claimIdString,
    title: "Nový claim odměny",
    body: `${context.subject.name} žádá o odměnu: ${reward?.title || "Odměna"} (${reward?.cost_points || 0} XP)`,
    type: "reward_claimed",
    dedupeKey: `reward_claimed:${claimIdString}`,
  })

  revalidateRewardsPaths()
  return { success: true, claimId: claimIdString }
}

export async function reviewRewardClaim(
  claimId: string,
  nextStatus: Extract<RewardClaimStatus, "approved" | "rejected">,
  note?: string,
) {
  const supabase = await createClient()
  const { context, error: contextError } =
    await getGamificationContext(supabase)

  if (contextError || !context) {
    return { error: contextError || "Nepodařilo se načíst uživatele." }
  }

  if (context.role !== "dom") {
    return { error: "Claimy může schvalovat pouze DOM." }
  }

  const { data, error } = await supabase.rpc("review_reward_claim", {
    claim_uuid: claimId,
    next_status: nextStatus,
    note: note || null,
  })

  if (error) {
    console.error("Error reviewing reward claim:", error)
    return { error: error.message }
  }

  const payload = (data || {}) as ReviewRewardClaimResult
  const approved = nextStatus === "approved"

  await createActivityNotification({
    recipientId: payload.user_id,
    pageKey: "rewards",
    entityType: "reward_claim",
    entityId: claimId,
    title: approved ? "Odměna schválena" : "Odměna odmítnuta",
    body: approved
      ? `DOM schválil odměnu: ${payload.reward_title || "Odměna"}`
      : `DOM odmítl odměnu: ${payload.reward_title || "Odměna"}. XP byly vráceny.`,
    type: approved ? "reward_approved" : "reward_rejected",
    dedupeKey: `reward_reviewed:${claimId}:${nextStatus}`,
  })

  revalidateRewardsPaths()
  return { success: true }
}
