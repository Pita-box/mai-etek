"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { ChatPresenceProvider } from "@/components/chat/ChatPresenceProvider";
import LockScreen from "@/components/LockScreen";
import Header from "@/components/shared/Header";
import Navigation from "@/components/shared/Navigation";
import { PageAccessDenied } from "@/components/shared/PageAccessDenied";
import {
  getVisibleDashboardPages,
  isPageEnabledForSub,
  resolveDashboardPageForPath,
} from "@/lib/page-access/config";
import type { DashboardPageItem, PageAccessAppConfig } from "@/types/page-access";

type DashboardProfile = {
  id: string;
  role: string | null;
  app_config: PageAccessAppConfig | null;
};

type DashboardShellProps = {
  children: ReactNode;
  pages: DashboardPageItem[];
};

export function DashboardShell({ children, pages }: DashboardShellProps) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<DashboardProfile | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, role, app_config")
        .eq("id", session.user.id)
        .single();

      setProfile((profileData as DashboardProfile | null) || null);
      setLoading(false);
    };

    void checkUser();
  }, [router]);

  const visiblePages = useMemo(() => {
    return getVisibleDashboardPages(pages, profile?.role, profile?.app_config);
  }, [pages, profile?.app_config, profile?.role]);

  const currentPage = useMemo(() => {
    return resolveDashboardPageForPath(pages, pathname);
  }, [pages, pathname]);

  const canAccessCurrentPage =
    !currentPage ||
    profile?.role === "dom" ||
    isPageEnabledForSub(profile?.app_config, currentPage);
  const fallbackHref = visiblePages[0]?.href || "/dashboard";

  if (loading) {
    return (
      <div className="center items-center p-4 text-white content-center">
        Načítám...
      </div>
    );
  }

  if (profile?.role === "unassigned") {
    return <LockScreen />;
  }

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background md:h-screen md:flex-row">
      <ChatPresenceProvider />
      <Navigation pages={visiblePages} userRole={profile?.role || undefined} />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Header />
        <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {canAccessCurrentPage ? (
            children
          ) : (
            <PageAccessDenied returnHref={fallbackHref} />
          )}
        </main>
      </div>
    </div>
  );
}
