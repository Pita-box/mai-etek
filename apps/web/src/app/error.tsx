"use client";

import { ErrorState } from "@/components/shared/ErrorState";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error(error);

  return (
    <main className="min-h-screen bg-background p-6">
      <ErrorState
        title="Něco se pokazilo"
        description="Aplikace narazila na neočekávanou chybu."
        onRetry={reset}
      />
    </main>
  );
}

