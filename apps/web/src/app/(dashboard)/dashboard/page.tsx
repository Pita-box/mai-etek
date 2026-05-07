import { getGamificationDashboard } from "@/actions/gamification";
import { GamificationDashboard } from "@/components/gamification/GamificationDashboard";
import { GamificationDashboardAuthRetry } from "@/components/gamification/GamificationDashboardAuthRetry";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const result = await getGamificationDashboard();

  if (result.error || !result.data) {
    if (result.error === "Auth session missing!") {
      return <GamificationDashboardAuthRetry error={result.error} />;
    }

    return (
      <div className="mx-auto max-w-5xl p-6">
        <div
          role="alert"
          className="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-6 text-rose-100"
        >
          Nepodařilo se načíst gamification dashboard: {result.error}
        </div>
      </div>
    );
  }

  return <GamificationDashboard data={result.data} />;
}
