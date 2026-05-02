"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import {
  getGamificationContext,
  normalizeUserStats,
} from "@/lib/gamification/context";
import type {
  Achievement,
  AchievementBadgeType,
  AchievementConditionType,
  AchievementItem,
  AchievementsData,
  GamificationDashboardData,
  XpTransaction,
} from "@/types/gamification";

type XpTransactionRow = {
  id: string;
  user_id: string;
  source_type: string;
  source_id: string | null;
  points_delta: number | null;
  available_delta: number | null;
  discipline_delta?: number | null;
  reason: string | null;
  created_at: string;
};

type AchievementRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  condition_type: string | null;
  condition_value: number | null;
  icon_name: string | null;
  sort_order: number | null;
  created_by?: string | null;
  badge_type?: string | null;
  xp_reward?: number | null;
  xp_penalty?: number | null;
  is_active?: boolean | null;
  deleted_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type UserAchievementRow = {
  id: string;
  achievement_id: string;
  unlocked_at: string;
  assigned_by?: string | null;
  assign_reason?: string | null;
  removed_at?: string | null;
  removed_by?: string | null;
  remove_reason?: string | null;
};

function normalizeTransaction(row: XpTransactionRow): XpTransaction {
  return {
    id: row.id,
    userId: row.user_id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    pointsDelta: row.points_delta || 0,
    availableDelta: row.available_delta || 0,
    disciplineDelta: row.discipline_delta || 0,
    reason: row.reason || "Gamification aktivita",
    createdAt: row.created_at,
  };
}

function normalizeAchievementCondition(
  value: string | null,
): AchievementConditionType {
  if (
    value === "points" ||
    value === "level" ||
    value === "streak" ||
    value === "tasks_completed" ||
    value === "perfect_rating_count"
  ) {
    return value;
  }

  return "tasks_completed";
}

function normalizeBadgeType(value: string | null | undefined): AchievementBadgeType {
  return value === "negative" ? "negative" : "positive";
}

function getAchievementProgressValue(
  conditionType: AchievementConditionType,
  stats: ReturnType<typeof normalizeUserStats>,
) {
  if (conditionType === "points") return stats.totalPoints;
  if (conditionType === "level") return stats.level;
  if (conditionType === "streak") return stats.longestStreak;
  if (conditionType === "perfect_rating_count")
    return stats.perfectRatingCount;
  return stats.tasksCompleted;
}

function getAchievementProgressText(
  conditionType: AchievementConditionType,
  value: number,
  target: number,
) {
  if (conditionType === "level") return `Level ${value}/${target}`;
  if (conditionType === "streak") return `${value}/${target} dnů`;
  if (conditionType === "points") return `${value}/${target} XP`;
  if (conditionType === "perfect_rating_count")
    return `${value}/${target} perfektní`;
  return `${value}/${target} úkolů`;
}

function normalizeAchievement(row: AchievementRow): Achievement {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    conditionType: normalizeAchievementCondition(row.condition_type),
    conditionValue: row.condition_value || 1,
    iconName: row.icon_name || "trophy",
    sortOrder: row.sort_order || 0,
    createdBy: row.created_by || null,
    badgeType: normalizeBadgeType(row.badge_type),
    xpReward: row.xp_reward || 0,
    xpPenalty: row.xp_penalty || 0,
    isActive: row.is_active !== false,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function normalizeAchievementItem(
  row: AchievementRow,
  stats: ReturnType<typeof normalizeUserStats>,
  holding?: UserAchievementRow | null,
): AchievementItem {
  const achievement = normalizeAchievement(row);
  const target = achievement.conditionValue || 1;
  const unlocked = Boolean(holding && !holding.removed_at);
  const removed = Boolean(holding?.removed_at);
  const progressValue =
    unlocked || removed
      ? target
      : getAchievementProgressValue(achievement.conditionType, stats);
  const cappedValue = Math.min(progressValue, target);

  return {
    ...achievement,
    userAchievementId: holding?.id || null,
    unlocked,
    unlockedAt: holding?.unlocked_at || null,
    assignedBy: holding?.assigned_by || null,
    assignReason: holding?.assign_reason || null,
    removedAt: holding?.removed_at || null,
    removedBy: holding?.removed_by || null,
    removeReason: holding?.remove_reason || null,
    progressValue: cappedValue,
    progressTarget: target,
    progressPercent: Math.round((cappedValue / target) * 100),
    progressText: getAchievementProgressText(
      achievement.conditionType,
      cappedValue,
      target,
    ),
  };
}

function normalizeText(value: FormDataEntryValue | null, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength).trim();
}

function normalizeMultilineText(
  value: FormDataEntryValue | null,
  maxLength: number,
) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function parseNonNegativeInteger(value: FormDataEntryValue | null) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function parsePositiveInteger(value: FormDataEntryValue | null, fallback = 1) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function slugify(value: string) {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

  return slug || "odznak";
}

function getAchievementInput(formData: FormData) {
  const title = normalizeText(formData.get("title"), 160);
  const description = normalizeMultilineText(formData.get("description"), 1200);
  const badgeType = normalizeBadgeType(String(formData.get("badge_type") || ""));
  const conditionType = normalizeAchievementCondition(
    String(formData.get("condition_type") || ""),
  );
  const conditionValue = parsePositiveInteger(formData.get("condition_value"));
  const iconName =
    normalizeText(formData.get("icon_name"), 60) ||
    (badgeType === "negative" ? "shield-alert" : "trophy");
  const xpReward =
    badgeType === "positive"
      ? parseNonNegativeInteger(formData.get("xp_reward"))
      : 0;
  const xpPenalty =
    badgeType === "negative"
      ? parseNonNegativeInteger(formData.get("xp_penalty"))
      : 0;

  if (!title) {
    return { error: "Název odznaku je povinný." };
  }

  return {
    data: {
      title,
      description: description || "Bez popisu.",
      badge_type: badgeType,
      condition_type: conditionType,
      condition_value: conditionValue,
      icon_name: iconName,
      sort_order: parseNonNegativeInteger(formData.get("sort_order")),
      xp_reward: xpReward,
      xp_penalty: xpPenalty,
      is_active: formData.get("is_active") === "on",
    },
  };
}

function revalidateGamificationPaths() {
  revalidatePath("/achievements");
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
}

export async function getGamificationDashboard(): Promise<
  | { data: GamificationDashboardData; error?: never }
  | { data?: never; error: string }
> {
  const supabase = await createClient();
  const { context, error: contextError } =
    await getGamificationContext(supabase);

  if (contextError || !context) {
    return { error: contextError || "Nepodařilo se načíst uživatele." };
  }

  const [statsResult, transactionsResult, achievementsResult, unlockedResult] =
    await Promise.all([
      supabase
        .from("user_stats")
        .select("*")
        .eq("user_id", context.subject.userId)
        .maybeSingle(),
      supabase
        .from("xp_transactions")
        .select("*")
        .eq("user_id", context.subject.userId)
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("achievements")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("badge_type", "positive")
        .is("deleted_at", null),
      supabase
        .from("user_achievements")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.subject.userId)
        .is("removed_at", null),
    ]);

  if (statsResult.error) {
    return { error: statsResult.error.message };
  }

  if (transactionsResult.error) {
    return { error: transactionsResult.error.message };
  }

  return {
    data: {
      role: context.role,
      subject: context.subject,
      stats: normalizeUserStats(statsResult.data, context.subject.userId),
      recentTransactions: (
        (transactionsResult.data || []) as XpTransactionRow[]
      ).map(normalizeTransaction),
      achievementsUnlocked: unlockedResult.count || 0,
      achievementsTotal: achievementsResult.count || 0,
    },
  };
}

export async function getAchievementsData(): Promise<
  | { data: AchievementsData; error?: never }
  | { data?: never; error: string }
> {
  const supabase = await createClient();
  const { context, error: contextError } =
    await getGamificationContext(supabase);

  if (contextError || !context) {
    return { error: contextError || "Nepodařilo se načíst uživatele." };
  }

  const achievementsQuery = supabase
    .from("achievements")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (context.role === "dom") {
    achievementsQuery.or(`created_by.eq.${context.userId},created_by.is.null`);
  } else if (context.profile.dom_id) {
    achievementsQuery.or(
      `created_by.eq.${context.profile.dom_id},created_by.is.null`,
    );
  } else {
    achievementsQuery.is("created_by", null);
  }

  const [statsResult, achievementsResult, userAchievementsResult, debtResult] =
    await Promise.all([
      supabase
        .from("user_stats")
        .select("*")
        .eq("user_id", context.subject.userId)
        .maybeSingle(),
      achievementsQuery,
      supabase
        .from("user_achievements")
        .select(
          "id, achievement_id, unlocked_at, assigned_by, assign_reason, removed_at, removed_by, remove_reason",
        )
        .eq("user_id", context.subject.userId)
        .order("unlocked_at", { ascending: false }),
      supabase
        .from("xp_transactions")
        .select("*")
        .eq("user_id", context.subject.userId)
        .neq("discipline_delta", 0)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  if (statsResult.error) return { error: statsResult.error.message };
  if (achievementsResult.error) return { error: achievementsResult.error.message };
  if (userAchievementsResult.error)
    return { error: userAchievementsResult.error.message };
  if (debtResult.error) return { error: debtResult.error.message };

  const stats = normalizeUserStats(statsResult.data, context.subject.userId);
  const achievementRows = (achievementsResult.data || []) as AchievementRow[];
  const userAchievementRows = (userAchievementsResult.data ||
    []) as UserAchievementRow[];
  const achievementById = new Map(
    achievementRows.map((achievement) => [achievement.id, achievement]),
  );
  const activeHoldingByAchievementId = new Map(
    userAchievementRows
      .filter((item) => !item.removed_at)
      .map((item) => [item.achievement_id, item]),
  );

  const catalogRows = achievementRows.filter((achievement) => !achievement.deleted_at);
  const catalog = catalogRows.map(normalizeAchievement);
  const catalogItems = catalogRows
    .filter((achievement) => {
      const badgeType = normalizeBadgeType(achievement.badge_type);
      return context.role === "dom" || badgeType === "positive";
    })
    .map((achievement) =>
      normalizeAchievementItem(
        achievement,
        stats,
        activeHoldingByAchievementId.get(achievement.id),
      ),
    );

  const activeAchievements = userAchievementRows
    .filter((holding) => !holding.removed_at)
    .map((holding) => {
      const achievement = achievementById.get(holding.achievement_id);
      return achievement
        ? normalizeAchievementItem(achievement, stats, holding)
        : null;
    })
    .filter((achievement): achievement is AchievementItem => Boolean(achievement));

  const lostAchievements = userAchievementRows
    .filter((holding) => holding.removed_at)
    .map((holding) => {
      const achievement = achievementById.get(holding.achievement_id);
      return achievement
        ? normalizeAchievementItem(achievement, stats, holding)
        : null;
    })
    .filter((achievement): achievement is AchievementItem => Boolean(achievement));

  const activeNegativeItems = activeAchievements.filter(
    (achievement) =>
      achievement.badgeType === "negative" &&
      !catalogItems.some((item) => item.id === achievement.id),
  );

  const achievements = [...catalogItems, ...activeNegativeItems];

  return {
    data: {
      role: context.role,
      subject: context.subject,
      stats,
      achievements,
      catalog,
      activeAchievements,
      lostAchievements,
      disciplineTransactions: ((debtResult.data || []) as XpTransactionRow[]).map(
        normalizeTransaction,
      ),
      unlockedCount: activeAchievements.length,
      activePositiveCount: activeAchievements.filter(
        (achievement) => achievement.badgeType === "positive",
      ).length,
      activeNegativeCount: activeAchievements.filter(
        (achievement) => achievement.badgeType === "negative",
      ).length,
      lostCount: lostAchievements.length,
    },
  };
}

export async function createAchievementDefinition(formData: FormData) {
  const supabase = await createClient();
  const { context, error: contextError } =
    await getGamificationContext(supabase);

  if (contextError || !context) {
    return { error: contextError || "Nepodařilo se načíst uživatele." };
  }

  if (context.role !== "dom") {
    return { error: "Odznaky může spravovat pouze DOM." };
  }

  const input = getAchievementInput(formData);
  if (input.error || !input.data) return { error: input.error };

  const { error } = await supabase.from("achievements").insert({
    ...input.data,
    slug: `${slugify(input.data.title)}-${crypto.randomUUID().slice(0, 8)}`,
    created_by: context.userId,
  });

  if (error) {
    console.error("Error creating achievement:", error);
    return { error: error.message };
  }

  revalidateGamificationPaths();
  return { success: true };
}

export async function updateAchievementDefinition(
  achievementId: string,
  formData: FormData,
) {
  const supabase = await createClient();
  const { context, error: contextError } =
    await getGamificationContext(supabase);

  if (contextError || !context) {
    return { error: contextError || "Nepodařilo se načíst uživatele." };
  }

  if (context.role !== "dom") {
    return { error: "Odznaky může spravovat pouze DOM." };
  }

  const input = getAchievementInput(formData);
  if (input.error || !input.data) return { error: input.error };

  const { error } = await supabase
    .from("achievements")
    .update(input.data)
    .eq("id", achievementId)
    .eq("created_by", context.userId);

  if (error) {
    console.error("Error updating achievement:", error);
    return { error: error.message };
  }

  revalidateGamificationPaths();
  return { success: true };
}

export async function deleteAchievementDefinition(achievementId: string) {
  const supabase = await createClient();
  const { context, error: contextError } =
    await getGamificationContext(supabase);

  if (contextError || !context) {
    return { error: contextError || "Nepodařilo se načíst uživatele." };
  }

  if (context.role !== "dom") {
    return { error: "Odznaky může spravovat pouze DOM." };
  }

  const { error } = await supabase
    .from("achievements")
    .update({
      deleted_at: new Date().toISOString(),
      is_active: false,
    })
    .eq("id", achievementId)
    .eq("created_by", context.userId);

  if (error) {
    console.error("Error deleting achievement:", error);
    return { error: error.message };
  }

  revalidateGamificationPaths();
  return { success: true };
}

export async function assignAchievementToSub(
  achievementId: string,
  reason: string,
) {
  const supabase = await createClient();
  const { context, error: contextError } =
    await getGamificationContext(supabase);

  if (contextError || !context) {
    return { error: contextError || "Nepodařilo se načíst uživatele." };
  }

  if (context.role !== "dom") {
    return { error: "Odznaky může přidělovat pouze DOM." };
  }

  const { data, error } = await supabase.rpc("assign_user_badge", {
    target_user_id: context.subject.userId,
    achievement_uuid: achievementId,
    reason,
  });

  if (error) {
    console.error("Error assigning achievement:", error);
    return { error: error.message };
  }

  revalidateGamificationPaths();
  return { success: true, data };
}

export async function removeAchievementFromSub(
  userAchievementId: string,
  reason: string,
) {
  const supabase = await createClient();
  const { context, error: contextError } =
    await getGamificationContext(supabase);

  if (contextError || !context) {
    return { error: contextError || "Nepodařilo se načíst uživatele." };
  }

  if (context.role !== "dom") {
    return { error: "Odznaky může odebírat pouze DOM." };
  }

  const { data, error } = await supabase.rpc("remove_user_badge", {
    user_achievement_uuid: userAchievementId,
    reason,
  });

  if (error) {
    console.error("Error removing achievement:", error);
    return { error: error.message };
  }

  revalidateGamificationPaths();
  return { success: true, data };
}

export async function applyManualDiscipline(points: number, reason: string) {
  const supabase = await createClient();
  const { context, error: contextError } =
    await getGamificationContext(supabase);

  if (contextError || !context) {
    return { error: contextError || "Nepodařilo se načíst uživatele." };
  }

  if (context.role !== "dom") {
    return { error: "Kázeňský dluh může přidat pouze DOM." };
  }

  const { data, error } = await supabase.rpc("apply_manual_discipline", {
    target_user_id: context.subject.userId,
    points,
    reason,
    source_type: "manual_discipline",
    source_id: null,
  });

  if (error) {
    console.error("Error applying discipline:", error);
    return { error: error.message };
  }

  revalidateGamificationPaths();
  return { success: true, data };
}
