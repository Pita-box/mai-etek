"use client";

import { ErrorState } from "@/components/shared/ErrorState";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error(error);

  return (
    <ErrorState
      title="Stránku se nepodařilo načíst"
      description="Zkus obnovit obsah. Pokud chyba zůstane, bude potřeba zkontrolovat server nebo připojení."
      onRetry={reset}
    />
  );
}

