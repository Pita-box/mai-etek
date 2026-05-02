"use client";

import { useEffect, useRef, useState } from "react";
import {
  getNavigationBadgeCounts,
  type NavigationBadgeCounts,
} from "@/actions/notifications";
import { createClient } from "@/utils/supabase/client";

type UseNavigationBadgesResult = {
  counts: NavigationBadgeCounts;
  refreshBadges: () => Promise<void>;
};

const emptyCounts: NavigationBadgeCounts = {
  tasks: 0,
  wishes: 0,
  gallery: 0,
  rewards: 0,
  achievements: 0,
};

export function useNavigationBadges(): UseNavigationBadgesResult {
  const [counts, setCounts] = useState<NavigationBadgeCounts>(emptyCounts);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const isMountedRef = useRef(true);
  const isFetchingRef = useRef(false);
  const refreshBadgesRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    isMountedRef.current = true;

    const supabase = createClient();

    const refreshBadges = async () => {
      if (isFetchingRef.current || !isMountedRef.current) {
        return;
      }

      isFetchingRef.current = true;

      try {
        const result = await getNavigationBadgeCounts();
        if (result.error) {
          throw new Error(result.error);
        }

        if (isMountedRef.current) {
          setCounts(result.counts || emptyCounts);
        }
      } catch (error) {
        console.error("Navigation badge refresh failed:", error);
      } finally {
        isFetchingRef.current = false;
      }
    };

    refreshBadgesRef.current = refreshBadges;
    void refreshBadges();

    const scheduleRefresh = () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      refreshTimeoutRef.current = setTimeout(() => {
        void refreshBadges();
      }, 150);
    };

    const channel = supabase
      .channel("navigation-badges-realtime-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        scheduleRefresh,
      )
      .subscribe();

    pollingIntervalRef.current = setInterval(() => {
      void refreshBadges();
    }, 3000);

    return () => {
      isMountedRef.current = false;
      refreshBadgesRef.current = null;

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
    counts,
    refreshBadges: async () => {
      await refreshBadgesRef.current?.();
    },
  };
}
