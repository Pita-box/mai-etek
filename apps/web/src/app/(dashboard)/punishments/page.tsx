import { getPunishments } from "@/actions/punishments";
import { PunishmentsClient } from "@/components/punishments/PunishmentsClient";

export const dynamic = "force-dynamic";

export default async function PunishmentsPage() {
  const result = await getPunishments();

  if (result.error) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="rounded-3xl border border-red-400/20 bg-red-500/10 p-6 text-red-100">
          Nepodařilo se načíst tresty: {result.error}
        </div>
      </div>
    );
  }

  if (result.role !== "dom") {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-zinc-300">
          Knihovna trestů je dostupná pouze pro DOM.
        </div>
      </div>
    );
  }

  return (
    <PunishmentsClient
      templates={result.templates}
      plans={result.plans}
    />
  );
}
