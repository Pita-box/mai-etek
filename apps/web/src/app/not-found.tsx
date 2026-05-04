import { ErrorState } from "@/components/shared/ErrorState";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-background p-6">
      <ErrorState
        title="Stránka neexistuje"
        description="Tahle adresa v aplikaci není dostupná."
        returnLabel="Přejít na dashboard"
      />
    </main>
  );
}

