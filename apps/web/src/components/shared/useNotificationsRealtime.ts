'use client';

import { useEffect, useRef, useState } from 'react';
import { getNotifications, NotificationItem } from '@/actions/notifications';
import { createClient } from '@/utils/supabase/client';

type UseNotificationsRealtimeResult = {
  notifications: NotificationItem[];
  unreadCount: number;
  isRealtimeSyncing: boolean;
  refreshNotifications: () => Promise<void>;
};

type NotificationSnapshot = {
  notifications: NotificationItem[];
  unreadCount: number;
};

export function useNotificationsRealtime(initialNotifications: NotificationItem[] = [], initialUnreadCount = 0): UseNotificationsRealtimeResult {
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [isRealtimeSyncing, setIsRealtimeSyncing] = useState(false);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);
  const isFetchingRef = useRef(false);
  const refreshNotificationsRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    isMountedRef.current = true;

    const supabase = createClient();

    const refreshNotifications = async () => {
      if (isFetchingRef.current || !isMountedRef.current) {
        return;
      }

      isFetchingRef.current = true;
      setIsRealtimeSyncing(true);

      try {
        const result = await getNotifications();
        if (result.error) {
          throw new Error(result.error);
        }

        if (isMountedRef.current) {
          const snapshot: NotificationSnapshot = {
            notifications: result.notifications || [],
            unreadCount: result.unreadCount || 0,
          };
          setNotifications(snapshot.notifications);
          setUnreadCount(snapshot.unreadCount);
        }
      } catch (error) {
        console.error('Realtime notifications refresh failed:', error);
      } finally {
        if (isMountedRef.current) {
          setIsRealtimeSyncing(false);
        }
        isFetchingRef.current = false;
      }
    };

    refreshNotificationsRef.current = refreshNotifications;

    const scheduleRefresh = () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      refreshTimeoutRef.current = setTimeout(() => {
        void refreshNotifications();
      }, 150);
    };

    const channel = supabase
      .channel('notifications-realtime-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, scheduleRefresh)
      .subscribe();

    pollingIntervalRef.current = setInterval(() => {
      void refreshNotifications();
    }, 3000);

    return () => {
      isMountedRef.current = false;
      refreshNotificationsRef.current = null;
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
    notifications,
    unreadCount,
    isRealtimeSyncing,
    refreshNotifications: async () => {
      await refreshNotificationsRef.current?.();
    },
  };
}
