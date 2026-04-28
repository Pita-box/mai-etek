'use client';

import { useEffect } from 'react';
import { recordTaskView } from '@/actions/tasks';

type UseTaskViewTrackingOptions = {
  taskId: string;
  enabled: boolean;
  delayMs?: number;
};

export function useTaskViewTracking({ taskId, enabled, delayMs = 1500 }: UseTaskViewTrackingOptions) {
  useEffect(() => {
    if (!enabled || !taskId) return;

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      if (cancelled) return;
      void recordTaskView(taskId);
    }, delayMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [delayMs, enabled, taskId]);
}
