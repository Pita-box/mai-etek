import { getRewardsData } from "@/actions/rewards";
import { RewardsClient } from "@/components/rewards/RewardsClient";
import { EmptyState } from "@/components/shared/EmptyState";
import { AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RewardsPage() {
  const result = await getRewardsData();

  if (result.error || !result.data) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <EmptyState
          variant="danger"
          icon={AlertTriangle}
          title="Odměny se nepodařilo načíst."
          description={result.error || "Zkus stránku načíst znovu."}
        />
      </div>
    );
  }

  return <RewardsClient data={result.data} />;
}
