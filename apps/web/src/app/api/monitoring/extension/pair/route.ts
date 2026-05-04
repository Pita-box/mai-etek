import { NextRequest } from "next/server"
import {
  generateDeviceToken,
  hashMonitoringSecret,
  normalizePairingCode,
} from "@/lib/monitoring/crypto"
import {
  MONITORING_DEFAULT_DEVICE_NAME,
  MONITORING_HEARTBEAT_INTERVAL_SECONDS,
} from "@/lib/monitoring/constants"
import { monitoringJson, monitoringOptions } from "@/lib/monitoring/api-response"
import { createAdminClient } from "@/utils/supabase/admin"

export const dynamic = "force-dynamic"

type PairingCodeRow = {
  id: string
  dom_id: string
  sub_id: string
}

function getJsonError(message: string, status = 400) {
  return monitoringJson({ success: false, error: message }, { status })
}

export function OPTIONS() {
  return monitoringOptions()
}

async function getRequestBody(request: NextRequest) {
  try {
    return (await request.json()) as {
      code?: unknown
      extensionVersion?: unknown
    }
  } catch {
    return {}
  }
}

function normalizeExtensionVersion(value: unknown) {
  if (typeof value !== "string") return null
  const version = value.trim().slice(0, 40)
  return version || null
}

async function getNextDeviceName(
  supabase: ReturnType<typeof createAdminClient>,
  domId: string,
  subId: string,
) {
  const { count } = await supabase
    .from("monitoring_devices")
    .select("id", { count: "exact", head: true })
    .eq("dom_id", domId)
    .eq("sub_id", subId)

  const nextNumber = (count || 0) + 1
  return nextNumber <= 1
    ? MONITORING_DEFAULT_DEVICE_NAME
    : `Zařízení ${nextNumber}`
}

export async function POST(request: NextRequest) {
  const body = await getRequestBody(request)
  const code =
    typeof body.code === "string" ? normalizePairingCode(body.code) : ""

  if (!code) {
    return getJsonError("Zadej párovací kód.")
  }

  const supabase = createAdminClient()
  const codeHash = hashMonitoringSecret(code)
  const now = new Date().toISOString()

  const { data: pairingCode, error: codeError } = await supabase
    .from("monitoring_pairing_codes")
    .select("id, dom_id, sub_id")
    .eq("code_hash", codeHash)
    .is("used_at", null)
    .is("revoked_at", null)
    .gt("expires_at", now)
    .maybeSingle()

  if (codeError) {
    console.error("Monitoring pairing lookup failed:", codeError.message)
    return getJsonError("Párování se nepodařilo ověřit.", 500)
  }

  const pairing = pairingCode as PairingCodeRow | null
  if (!pairing) {
    return getJsonError("Párovací kód je neplatný nebo vypršel.", 401)
  }

  const token = generateDeviceToken()
  const tokenHash = hashMonitoringSecret(token)
  const deviceName = await getNextDeviceName(
    supabase,
    pairing.dom_id,
    pairing.sub_id,
  )
  const timestamp = new Date().toISOString()
  const extensionVersion = normalizeExtensionVersion(body.extensionVersion)

  const { data: reservedCode, error: reserveError } = await supabase
    .from("monitoring_pairing_codes")
    .update({ used_at: timestamp })
    .eq("id", pairing.id)
    .is("used_at", null)
    .select("id")
    .maybeSingle()

  if (reserveError) {
    console.error("Monitoring pairing code reservation failed:", reserveError.message)
    return getJsonError("Párovací kód se nepodařilo uzavřít.", 500)
  }

  if (!reservedCode) {
    return getJsonError("Párovací kód už byl použit.", 401)
  }

  const { data: device, error: deviceError } = await supabase
    .from("monitoring_devices")
    .insert({
      dom_id: pairing.dom_id,
      sub_id: pairing.sub_id,
      name: deviceName,
      token_hash: tokenHash,
      paired_at: timestamp,
      last_heartbeat_at: timestamp,
      last_seen_at: timestamp,
      extension_version: extensionVersion,
      sync_status: "connected",
    })
    .select("id, name")
    .single()

  if (deviceError || !device) {
    console.error(
      "Monitoring device creation failed:",
      deviceError?.message || "Unknown error",
    )
    await supabase
      .from("monitoring_pairing_codes")
      .update({ used_at: null })
      .eq("id", pairing.id)
    return getJsonError("Zařízení se nepodařilo spárovat.", 500)
  }

  const { error: updateCodeError } = await supabase
    .from("monitoring_pairing_codes")
    .update({
      used_device_id: device.id,
    })
    .eq("id", pairing.id)

  if (updateCodeError) {
    console.error("Monitoring pairing code update failed:", updateCodeError.message)
  }

  return monitoringJson({
    success: true,
    deviceToken: token,
    deviceId: device.id,
    deviceName: device.name,
    heartbeatIntervalSeconds: MONITORING_HEARTBEAT_INTERVAL_SECONDS,
  })
}
