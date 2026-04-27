'use client';

import { useEffect, useRef, useState } from 'react';
import { getTasks } from '@/actions/tasks';
import { Task } from '@/types/task';
import { createClient } from '@/utils/supabase/client';

type UseTasksRealtimeResult = {
  tasks: Task[];
  isRealtimeSyncing: boolean;
  refreshTasks: () => Promise<void>;
};

export function useTasksRealtime(initialTasks: Task[]): UseTasksRealtimeResult {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [isRealtimeSyncing, setIsRealtimeSyncing] = useState(false);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);
  const isFetchingRef = useRef(false);
  const refreshTasksRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    isMountedRef.current = true;

    const supabase = createClient();

    const refreshTasks = async () => {
      if (isFetchingRef.current || !isMountedRef.current) {
        return;
      }

      isFetchingRef.current = true;
      setIsRealtimeSyncing(true);

      try {
        const nextTasks = await getTasks();
        if (isMountedRef.current) {
          setTasks(nextTasks);
        }
      } catch (error) {
        console.error('Realtime tasks refresh failed:', error);
      } finally {
        if (isMountedRef.current) {
          setIsRealtimeSyncing(false);
        }
        isFetchingRef.current = false;
      }
    };

    refreshTasksRef.current = refreshTasks;

    const scheduleRefresh = () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      refreshTimeoutRef.current = setTimeout(() => {
        void refreshTasks();
      }, 150);
    };

    const channel = supabase
      .channel('tasks-realtime-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_attempts' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_media' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_evidence' }, scheduleRefresh)
      .subscribe();

    pollingIntervalRef.current = setInterval(() => {
      void refreshTasks();
    }, 3000);

    return () => {
      isMountedRef.current = false;
      refreshTasksRef.current = null;
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, []);


  return {
    tasks,
    isRealtimeSyncing,
    refreshTasks: async () => {
      await refreshTasksRef.current?.();
    },
  };
}
