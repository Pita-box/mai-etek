import { NextRequest } from "next/server"
import { hashMonitoringSecret } from "@/lib/monitoring/crypto"
import { MONITORING_HEARTBEAT_INTERVAL_SECONDS } from "@/lib/monitoring/constants"
import { monitoringJson, monitoringOptions } from "@/lib/monitoring/api-response"
import { createAdminClient } from "@/utils/supabase/admin"

export const dynamic = "force-dynamic"

type HeartbeatBody = {
  extensionVersion?: unknown
  syncStatus?: unknown
  pendingItems?: unknown
  lastError?: unknown
}

type MonitoringDeviceRow = {
  id: string
  name: string
  revoked_at: string | null
}

export function OPTIONS() {
  return monitoringOptions()
}

function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) return null
  return authHeader.slice("Bearer ".length).trim() || null
}

function normalizeSyncStatus(value: unknown) {
  if (value === "pending" || value === "error" || value === "connected") {
    return value
  }

  return "connected"
}

function normalizePendingItems(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}

function normalizeNullableText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null
  const text = value.trim().slice(0, maxLength)
  return text || null
}

async function getRequestBody(request: NextRequest): Promise<HeartbeatBody> {
  try {
    return (await request.json()) as HeartbeatBody
  } catch {
    return {}
  }
}

export async function POST(request: NextRequest) {
  const token = getBearerToken(request)

  if (!token) {
    return monitoringJson(
      { success: false, revoked: true, error: "Extension není spárovaná." },
      { status: 401 },
    )
  }

  const supabase = createAdminClient()
  const tokenHash = hashMonitoringSecret(token)
  const { data, error } = await supabase
    .from("monitoring_devices")
    .select("id, name, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle()

  if (error) {
    console.error("Monitoring heartbeat lookup failed:", error.message)
    return monitoringJson(
      { success: false, error: "Heartbeat se nepodařilo ověřit." },
      { status: 500 },
    )
  }

  const device = data as MonitoringDeviceRow | null
  if (!device || device.revoked_at) {
    return monitoringJson(
      { success: false, revoked: true, error: "Extension byla zneplatněna." },
      { status: 401 },
    )
  }

  const body = await getRequestBody(request)
  const timestamp = new Date().toISOString()
  const syncStatus = normalizeSyncStatus(body.syncStatus)
  const pendingItems = normalizePendingItems(body.pendingItems)
  const lastError = normalizeNullableText(body.lastError, 500)
  const extensionVersion = normalizeNullableText(body.extensionVersion, 40)

  const { error: updateError } = await supabase
    .from("monitoring_devices")
    .update({
      last_heartbeat_at: timestamp,
      last_seen_at: timestamp,
      extension_version: extensionVersion,
      sync_status: syncStatus,
      pending_items: pendingItems,
      last_error: lastError,
    })
    .eq("id", device.id)

  if (updateError) {
    console.error("Monitoring heartbeat update failed:", updateError.message)
    return monitoringJson(
      { success: false, error: "Heartbeat se nepodařilo uložit." },
      { status: 500 },
    )
  }

  return monitoringJson({
    success: true,
    active: true,
    revoked: false,
    deviceId: device.id,
    deviceName: device.name,
    heartbeatIntervalSeconds: MONITORING_HEARTBEAT_INTERVAL_SECONDS,
  })
}
