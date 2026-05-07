"use client";

import { useEffect, useRef } from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

type GamificationDashboardAuthRetryProps = {
  error: string;
};

export function GamificationDashboardAuthRetry({
  error,
}: GamificationDashboardAuthRetryProps) {
  const router = useRouter();
  const didRefreshRef = useRef(false);

  useEffect(() => {
    if (didRefreshRef.current) return;
    if (sessionStorage.getItem("gamification-dashboard-auth-refresh")) return;

    didRefreshRef.current = true;
    sessionStorage.setItem("gamification-dashboard-auth-refresh", "1");
    router.refresh();
  }, [router]);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div
        role="status"
        className="rounded-3xl border border-white/10 bg-white/[0.045] p-6 text-zinc-100"
      >
        <div className="flex items-center gap-3">
          <RefreshCw className="h-5 w-5 animate-spin text-primary" />
          <p className="font-semibold">Obnovuji přihlášení...</p>
        </div>
        <p className="mt-3 text-sm text-zinc-400">
          Dashboard dostal starý auth stav. Zkouším načíst stránku znovu.
        </p>
        <p className="mt-2 text-xs text-zinc-500">{error}</p>
      </div>
    </div>
  );
}
