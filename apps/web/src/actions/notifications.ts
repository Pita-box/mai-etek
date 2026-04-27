"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

type NotificationRow = {
  id: string;
  user_id: string;
  actor_id: string | null;
  task_id: string | null;
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
  title: string;
  body: string;
  type: string;
  readAt: string | null;
  createdAt: string;
  actorName: string | null;
};

function revalidateNotificationPaths() {
  revalidatePath("/");
  revalidatePath("/tasks");
}

function normalizeNotificationActorName(fullName: string | null | undefined) {
  return typeof fullName === "string" && fullName.trim() ? fullName.trim() : null;
}

async function getNotificationProfiles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  actorIds: string[]
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
  notifications: NotificationRow[]
): Promise<NotificationItem[]> {
  const actorIds = Array.from(
    new Set(
      notifications
        .map((notification) => notification.actor_id)
        .filter((actorId): actorId is string => Boolean(actorId))
    )
  );

  const profilesById = await getNotificationProfiles(supabase, actorIds);

  return notifications.map((notification) => ({
    id: notification.id,
    taskId: notification.task_id,
    title: notification.title,
    body: notification.body,
    type: notification.type,
    readAt: notification.read_at,
    createdAt: notification.created_at,
    actorName: normalizeNotificationActorName(
      notification.actor_id ? profilesById.get(notification.actor_id)?.full_name : null
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
    .select("id, user_id, actor_id, task_id, title, body, type, read_at, created_at")
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
    unreadCount: notifications.filter((notification) => !notification.read_at).length,
  };
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
