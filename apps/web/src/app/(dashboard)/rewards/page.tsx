import { getRewardsData } from "@/actions/rewards";
import { RewardsClient } from "@/components/rewards/RewardsClient";

export const dynamic = "force-dynamic";

export default async function RewardsPage() {
  const result = await getRewardsData();

  if (result.error || !result.data) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div
          role="alert"
          className="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-6 text-rose-100"
        >
          Nepodařilo se načíst odměny: {result.error}
        </div>
      </div>
    );
  }

  return <RewardsClient data={result.data} />;
}
