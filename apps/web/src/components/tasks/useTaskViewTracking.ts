"use client";

import { useEffect } from "react";
import { markEntityNotificationsRead } from "@/actions/notifications";
import { recordTaskView } from "@/actions/tasks";

type UseTaskViewTrackingOptions = {
  taskId: string;
  enabled: boolean;
  trackViewCount?: boolean;
  delayMs?: number;
};

export function useTaskViewTracking({
  taskId,
  enabled,
  trackViewCount = false,
  delayMs = 1500,
}: UseTaskViewTrackingOptions) {
  useEffect(() => {
    if (!enabled || !taskId) return;

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      if (cancelled) return;
      void markEntityNotificationsRead("tasks", "task", taskId);
      if (trackViewCount) {
        void recordTaskView(taskId);
      }
    }, delayMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [delayMs, enabled, taskId, trackViewCount]);
}
