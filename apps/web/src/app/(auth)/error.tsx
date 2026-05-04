"use client";

import { ErrorState } from "@/components/shared/ErrorState";

export default function AuthError({
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
        title="Auth stránku se nepodařilo načíst"
        description="Zkus akci zopakovat, případně se vrať na přihlášení."
        onRetry={reset}
        returnHref="/login"
        returnLabel="Zpět na přihlášení"
      />
    </main>
  );
}

