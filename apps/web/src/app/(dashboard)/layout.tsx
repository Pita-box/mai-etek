import type { ReactNode } from "react";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { getDashboardPages } from "@/lib/page-access/dashboard-pages";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <DashboardShell pages={getDashboardPages()}>{children}</DashboardShell>;
}
