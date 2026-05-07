"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  CheckSquare,
  Gauge,
  Gift,
  Heart,
  Image as ImageIcon,
  Menu,
  MessageSquare,
  Settings,
  Shield,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useChatNotificationsStore } from "@/stores/chatNotificationsStore";
import type {
  DashboardPageIconKey,
  DashboardPageItem,
} from "@/types/page-access";
import { useNavigationBadges } from "./useNavigationBadges";

const iconByKey = {
  activity: Activity,
  "alert-triangle": AlertTriangle,
  "check-square": CheckSquare,
  gauge: Gauge,
  gift: Gift,
  heart: Heart,
  image: ImageIcon,
  "message-square": MessageSquare,
  settings: Settings,
  shield: Shield,
  trophy: Trophy,
} satisfies Record<DashboardPageIconKey, typeof Activity>;

function formatBadgeCount(count: number) {
  return count > 99 ? "99+" : String(count);
}

export default function Navigation({
  pages,
  userRole,
}: {
  pages: DashboardPageItem[];
  userRole?: string;
}) {
  const pathname = usePathname();
  const chatUnreadCount = useChatNotificationsStore(
    (state) => state.unreadCount,
  );
  const { counts: navigationBadgeCounts } = useNavigationBadges();
  const regularPages = pages.filter((page) => !page.systemOnly);
  const systemPages = userRole === "dom" ? pages.filter((page) => page.systemOnly) : [];

  const getBadgeCount = (key: string) => {
    if (key === "chat") return chatUnreadCount;
    if (key === "tasks") return navigationBadgeCounts.tasks;
    if (key === "wishes") return navigationBadgeCounts.wishes;
    if (key === "gallery") return navigationBadgeCounts.gallery;
    if (key === "rewards") return navigationBadgeCounts.rewards;
    if (key === "achievements") return navigationBadgeCounts.achievements;
    return 0;
  };

  const renderPageLink = (page: DashboardPageItem, system = false) => {
    const Icon = iconByKey[page.iconKey] || Activity;
    const isActive =
      pathname === page.href || pathname?.startsWith(`${page.href}/`);
    const badgeCount = getBadgeCount(page.key);
    const showBadge = badgeCount > 0;

    return (
      <Link
        key={page.href}
        href={page.href}
        prefetch={false}
        aria-label={
          showBadge
            ? `${page.label}, ${formatBadgeCount(badgeCount)} nové`
            : page.label
        }
        className={`group flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${
          system
            ? isActive
              ? "border-blue-800 bg-blue-900/50 font-bold text-blue-400"
              : "border-transparent text-muted hover:bg-blue-900/20 hover:text-blue-400"
            : isActive
              ? "border-primary/20 bg-primary/10 text-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.1)]"
              : "border-transparent text-gray-400 hover:bg-white/5 hover:text-white"
        }`}
      >
        <Icon
          className={`h-5 w-5 transition-colors ${
            system
              ? isActive
                ? "text-blue-400"
                : "text-muted group-hover:text-blue-400"
              : isActive
                ? "text-primary"
                : "group-hover:text-white"
          }`}
        />
        <span className="min-w-0 flex-1 font-medium">{page.label}</span>
        {showBadge ? (
          <span className="ml-auto inline-flex min-w-5 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary-foreground shadow-[0_0_14px_rgba(255,31,87,0.32)]">
            {formatBadgeCount(badgeCount)}
          </span>
        ) : null}
      </Link>
    );
  };

  const renderNavLinks = () => (
    <div className="flex w-full flex-col space-y-1">
      {regularPages.map((page) => renderPageLink(page))}

      {systemPages.length > 0 ? (
        <>
          <div className="pb-2 pt-8">
            <div className="h-px w-full bg-border" />
          </div>
          {systemPages.map((page) => renderPageLink(page, true))}
        </>
      ) : null}
    </div>
  );

  return (
    <>
      <div className="glass-card sticky top-0 z-50 flex w-full items-center justify-between border-b border-border p-4 md:hidden">
        <div className="flex items-center space-x-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary shadow-[0_0_10px_rgba(255,31,87,0.5)]">
            <span className="text-sm font-black text-primary-foreground">
              D<span>s</span>
            </span>
          </div>
          <span className="text-lg font-black tracking-tight">Maietek</span>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-foreground">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="glass-card w-64 border-r-border p-0"
          >
            <div className="flex h-full flex-col bg-background/80 p-6">
              <div className="mb-8 flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary shadow-[0_0_10px_rgba(255,31,87,0.5)]">
                  <span className="text-sm font-black text-primary-foreground">
                    D<span>s</span>
                  </span>
                </div>
                <span className="text-xl font-black tracking-tight">
                  Maietek
                </span>
              </div>
              {renderNavLinks()}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <aside className="glass-card hidden h-screen w-64 shrink-0 flex-col border-r border-border md:flex">
        <div className="p-6">
          <div className="mb-8 flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary shadow-[0_0_15px_rgba(255,31,87,0.5)]">
              <span className="font-black text-primary-foreground">
                D<span>s</span>
              </span>
            </div>
            <span className="text-2xl font-black tracking-tight">Maietek</span>
          </div>
          {renderNavLinks()}
        </div>
      </aside>
    </>
  );
}
