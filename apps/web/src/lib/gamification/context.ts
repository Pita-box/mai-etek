import "server-only";

import type { createClient } from "@/utils/supabase/server";
import type { GamificationViewerRole, UserStats } from "@/types/gamification";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type ProfileRow = {
  id: string;
  role: string | null;
  dom_id: string | null;
  full_name: string | null;
};

type UserStatsRow = {
  user_id: string;
  total_points: number | null;
  available_points: number | null;
  level: number | null;
  tasks_completed: number | null;
  tasks_failed: number | null;
  perfect_rating_count: number | null;
  current_streak: number | null;
  longest_streak: number | null;
  last_completed_on: string | null;
  discipline_points?: number | null;
};

export type GamificationContext = {
  userId: string;
  role: GamificationViewerRole;
  profile: ProfileRow;
  subject: {
    userId: string;
    name: string;
  };
};

export function normalizeGamificationName(
  value: string | null | undefined,
  fallback = "Uživatel",
) {
  const name = value?.trim();
  return name || fallback;
}

export function normalizeUserStats(
  row: UserStatsRow | null | undefined,
  userId: string,
): UserStats {
  return {
    userId,
    totalPoints: row?.total_points || 0,
    availablePoints: row?.available_points || 0,
    level: row?.level || 1,
    tasksCompleted: row?.tasks_completed || 0,
    tasksFailed: row?.tasks_failed || 0,
    perfectRatingCount: row?.perfect_rating_count || 0,
    currentStreak: row?.current_streak || 0,
    longestStreak: row?.longest_streak || 0,
    lastCompletedOn: row?.last_completed_on || null,
    disciplinePoints: row?.discipline_points || 0,
  };
}

export async function getGamificationContext(supabase: SupabaseServerClient) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { context: null, error: userError?.message || "Not authenticated" };
  }

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, dom_id, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profileData) {
    return {
      context: null,
      error: profileError?.message || "Profil nebyl nalezen.",
    };
  }

  const profile = profileData as ProfileRow;
  const role: GamificationViewerRole = profile.role === "dom" ? "dom" : "sub";

  if (role === "dom") {
    const { data: subProfiles, error: subError } = await supabase
      .from("profiles")
      .select("id, role, dom_id, full_name")
      .eq("dom_id", user.id)
      .eq("role", "sub")
      .order("full_name", { ascending: true })
      .limit(1);

    if (subError) {
      return { context: null, error: subError.message };
    }

    const subProfile = (subProfiles?.[0] as ProfileRow | undefined) ?? null;

    if (!subProfile) {
      return {
        context: null,
        error: "Není přiřazený žádný SUB účet.",
      };
    }

    return {
      context: {
        userId: user.id,
        role,
        profile,
        subject: {
          userId: subProfile.id,
          name: normalizeGamificationName(subProfile.full_name, "SUB"),
        },
      } satisfies GamificationContext,
      error: null,
    };
  }

  return {
    context: {
      userId: user.id,
      role,
      profile,
      subject: {
        userId: user.id,
        name: normalizeGamificationName(profile.full_name, "SUB"),
      },
    } satisfies GamificationContext,
    error: null,
  };
}
