import { SuperAdminClient } from "@/components/superadmin/SuperAdminClient";
import { getConfigurableDashboardPages } from "@/lib/page-access/dashboard-pages";

export default function SuperAdminPage() {
  return <SuperAdminClient pages={getConfigurableDashboardPages()} />;
}
