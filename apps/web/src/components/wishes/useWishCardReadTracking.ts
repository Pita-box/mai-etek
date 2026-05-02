"use client";

import { RefObject, useEffect, useRef } from "react";
import { markEntityNotificationsRead } from "@/actions/notifications";

type UseWishCardReadTrackingOptions = {
  wishId: string;
  cardRef: RefObject<HTMLElement | null>;
  delayMs?: number;
};

export function useWishCardReadTracking({
  wishId,
  cardRef,
  delayMs = 1200,
}: UseWishCardReadTrackingOptions) {
  const hasMarkedRef = useRef(false);

  useEffect(() => {
    const element = cardRef.current;
    if (!element || !wishId || hasMarkedRef.current) return;

    let timeout: ReturnType<typeof setTimeout> | null = null;

    const clearPendingRead = () => {
      if (!timeout) return;
      clearTimeout(timeout);
      timeout = null;
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || entry.intersectionRatio < 0.35) {
          clearPendingRead();
          return;
        }

        if (timeout || hasMarkedRef.current) return;

        timeout = setTimeout(() => {
          hasMarkedRef.current = true;
          void markEntityNotificationsRead("wishes", "wish", wishId);
          observer.disconnect();
        }, delayMs);
      },
      {
        threshold: [0, 0.35, 0.7],
      },
    );

    observer.observe(element);

    return () => {
      clearPendingRead();
      observer.disconnect();
    };
  }, [cardRef, delayMs, wishId]);
}
