import { getMonitoringData } from "@/actions/monitoring"
import { MonitoringClient } from "@/components/monitoring/MonitoringClient"

export const dynamic = "force-dynamic"

export default async function MonitoringPage() {
  const result = await getMonitoringData()

  if (result.error || !result.data) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div
          role="alert"
          className="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-6 text-rose-100"
        >
          Nepodařilo se načíst Monitoring: {result.error}
        </div>
      </div>
    )
  }

  return <MonitoringClient data={result.data} />
}
