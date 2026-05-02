import { getAchievementsData } from "@/actions/gamification";
import { AchievementsClient } from "@/components/achievements/AchievementsClient";

export const dynamic = "force-dynamic";

export default async function AchievementsPage() {
  const result = await getAchievementsData();

  if (result.error || !result.data) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div
          role="alert"
          className="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-6 text-rose-100"
        >
          Nepodařilo se načíst achievements: {result.error}
        </div>
      </div>
    );
  }

  return <AchievementsClient data={result.data} />;
}
