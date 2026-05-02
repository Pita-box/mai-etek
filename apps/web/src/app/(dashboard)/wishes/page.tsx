import { getWishes } from "@/actions/wishes";
import { WishesClient } from "@/components/wishes/WishesClient";

export const dynamic = "force-dynamic";

export default async function WishesPage() {
  const result = await getWishes();

  if (result.error) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="rounded-3xl border border-red-400/20 bg-red-500/10 p-6 text-red-100">
          Nepodařilo se načíst přání: {result.error}
        </div>
      </div>
    );
  }

  return <WishesClient wishes={result.wishes} role={result.role} />;
}
