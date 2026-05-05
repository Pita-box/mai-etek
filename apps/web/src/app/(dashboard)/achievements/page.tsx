import { getAchievementsData } from "@/actions/gamification";
import { AchievementsClient } from "@/components/achievements/AchievementsClient";
import { EmptyState } from "@/components/shared/EmptyState";
import { AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AchievementsPage() {
  const result = await getAchievementsData();

  if (result.error || !result.data) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <EmptyState
          variant="danger"
          icon={AlertTriangle}
          title="Úspěchy se nepodařilo načíst."
          description={result.error || "Zkus stránku načíst znovu."}
        />
      </div>
    );
  }

  return <AchievementsClient data={result.data} />;
}
