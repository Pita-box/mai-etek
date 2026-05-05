import { getWishes } from "@/actions/wishes";
import { EmptyState } from "@/components/shared/EmptyState";
import { WishesClient } from "@/components/wishes/WishesClient";
import { AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function WishesPage() {
  const result = await getWishes();

  if (result.error) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <EmptyState
          variant="danger"
          icon={AlertTriangle}
          title="Přání se nepodařilo načíst."
          description={result.error}
        />
      </div>
    );
  }

  return <WishesClient wishes={result.wishes} role={result.role} />;
}
