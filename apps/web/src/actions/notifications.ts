"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

type NotificationRow = {
  id: string;
  user_id: string;
  actor_id: string | null;
  task_id: string | null;
  page_key: NotificationPageKey | null;
  entity_type: NotificationEntityType | null;
  entity_id: string | null;
  title: string;
  body: string;
  type: string;
  read_at: string | null;
  created_at: string;
};

type NotificationProfile = {
  id: string;
  full_name: string | null;
};

export type NotificationItem = {
  id: string;
  taskId: string | null;
  pageKey: NotificationPageKey | null;
  entityType: NotificationEntityType | null;
  entityId: string | null;
  title: string;
  body: string;
  type: string;
  readAt: string | null;
  createdAt: string;
  actorName: string | null;
};

export type NotificationPageKey =
  | "tasks"
  | "wishes"
  | "gallery"
  | "rewards"
  | "achievements";
export type NotificationEntityType =
  | "task"
  | "wish"
  | "gallery_media"
  | "reward_claim"
  | "achievement";
export type NavigationBadgeCounts = Record<NotificationPageKey, number>;

type CreateActivityNotificationInput = {
  recipientId?: string | null;
  pageKey: NotificationPageKey;
  entityType: NotificationEntityType;
  entityId: string;
  title: string;
  body: string;
  type: string;
  metadata?: Record<string, unknown>;
  dedupeKey?: string | null;
  taskId?: string | null;
};

const navigationBadgePageKeys: NotificationPageKey[] = [
  "tasks",
  "wishes",
  "gallery",
  "rewards",
  "achievements",
];

function revalidateNotificationPaths() {
  revalidatePath("/");
  revalidatePath("/tasks");
  revalidatePath("/wishes");
  revalidatePath("/gallery");
  revalidatePath("/rewards");
  revalidatePath("/achievements");
}

function normalizeNotificationActorName(fullName: string | null | undefined) {
  return typeof fullName === "string" && fullName.trim()
    ? fullName.trim()
    : null;
}

async function getNotificationProfiles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  actorIds: string[],
) {
  const profilesById = new Map<string, NotificationProfile>();

  if (actorIds.length === 0) {
    return profilesById;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", actorIds);

  if (error) {
    console.error("Error fetching notification actors:", error);
    return profilesById;
  }

  (data as NotificationProfile[] | null)?.forEach((profile) => {
    profilesById.set(profile.id, profile);
  });

  return profilesById;
}

async function enrichNotifications(
  supabase: Awaited<ReturnType<typeof createClient>>,
  notifications: NotificationRow[],
): Promise<NotificationItem[]> {
  const actorIds = Array.from(
    new Set(
      notifications
        .map((notification) => notification.actor_id)
        .filter((actorId): actorId is string => Boolean(actorId)),
    ),
  );

  const profilesById = await getNotificationProfiles(supabase, actorIds);

  return notifications.map((notification) => ({
    id: notification.id,
    taskId: notification.task_id,
    pageKey: notification.page_key,
    entityType: notification.entity_type,
    entityId: notification.entity_id,
    title: notification.title,
    body: notification.body,
    type: notification.type,
    readAt: notification.read_at,
    createdAt: notification.created_at,
    actorName: normalizeNotificationActorName(
      notification.actor_id
        ? profilesById.get(notification.actor_id)?.full_name
        : null,
    ),
  }));
}

export async function getNotifications(limit = 20) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return {
      error: "Not authenticated",
      notifications: [] as NotificationItem[],
      unreadCount: 0,
    };
  }

  const safeLimit = Math.max(1, Math.min(limit, 100));
  const { data, error } = await supabase
    .from("notifications")
    .select(
      "id, user_id, actor_id, task_id, page_key, entity_type, entity_id, title, body, type, read_at, created_at",
    )
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    console.error("Error fetching notifications:", error);
    return {
      error: error.message,
      notifications: [] as NotificationItem[],
      unreadCount: 0,
    };
  }

  const notifications = (data || []) as NotificationRow[];
  return {
    notifications: await enrichNotifications(supabase, notifications),
    unreadCount: notifications.filter((notification) => !notification.read_at)
      .length,
  };
}

export async function getNavigationBadgeCounts() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const emptyCounts: NavigationBadgeCounts = {
    tasks: 0,
    wishes: 0,
    gallery: 0,
    rewards: 0,
    achievements: 0,
  };

  if (!session) {
    return {
      error: "Not authenticated",
      counts: emptyCounts,
    };
  }

  const { data, error } = await supabase
    .from("notifications")
    .select("page_key")
    .eq("user_id", session.user.id)
    .is("read_at", null)
    .in("page_key", navigationBadgePageKeys);

  if (error) {
    console.error("Error fetching navigation badge counts:", error);
    return { error: error.message, counts: emptyCounts };
  }

  const counts = { ...emptyCounts };

  for (const notification of (data || []) as Array<{
    page_key: string | null;
  }>) {
    if (
      notification.page_key === "tasks" ||
      notification.page_key === "wishes" ||
      notification.page_key === "gallery" ||
      notification.page_key === "rewards" ||
      notification.page_key === "achievements"
    ) {
      counts[notification.page_key] += 1;
    }
  }

  return { counts };
}

export async function createActivityNotification(
  input: CreateActivityNotificationInput,
) {
  if (!input.recipientId) {
    return { success: true, skipped: true };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_activity_notification", {
    p_user_id: input.recipientId,
    p_page_key: input.pageKey,
    p_entity_type: input.entityType,
    p_entity_id: input.entityId,
    p_title: input.title,
    p_body: input.body,
    p_type: input.type,
    p_metadata: input.metadata || {},
    p_dedupe_key: input.dedupeKey || null,
    p_task_id: input.taskId || null,
  });

  if (error) {
    console.error("Error creating activity notification:", error);
    return { error: error.message };
  }

  revalidateNotificationPaths();
  return { success: true, notificationId: data as string | null };
}

export async function markNotificationRead(notificationId: string) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", session.user.id)
    .is("read_at", null);

  if (error) {
    console.error("Error marking notification as read:", error);
    return { error: error.message };
  }

  revalidateNotificationPaths();
  return { success: true };
}

export async function markEntityNotificationsRead(
  pageKey: NotificationPageKey,
  entityType: NotificationEntityType,
  entityId: string,
) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", session.user.id)
    .eq("page_key", pageKey)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .is("read_at", null);

  if (error) {
    console.error("Error marking entity notifications as read:", error);
    return { error: error.message };
  }

  revalidateNotificationPaths();
  return { success: true };
}

export async function markPageNotificationsRead(pageKey: NotificationPageKey) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", session.user.id)
    .eq("page_key", pageKey)
    .is("read_at", null);

  if (error) {
    console.error("Error marking page notifications as read:", error);
    return { error: error.message };
  }

  revalidateNotificationPaths();
  return { success: true };
}

export async function markAllNotificationsRead() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", session.user.id)
    .is("read_at", null);

  if (error) {
    console.error("Error marking all notifications as read:", error);
    return { error: error.message };
  }

  revalidateNotificationPaths();
  return { success: true };
}
