"use server"

import { revalidatePath } from "next/cache"
import {
  generatePairingCode,
  hashMonitoringSecret,
  normalizePairingCode,
} from "@/lib/monitoring/crypto"
import {
  MONITORING_ACTIVE_WINDOW_MINUTES,
  MONITORING_DEFAULT_DEVICE_NAME,
  MONITORING_HEARTBEAT_INTERVAL_SECONDS,
  MONITORING_PAIRING_CODE_TTL_MINUTES,
} from "@/lib/monitoring/constants"
import { createClient } from "@/utils/supabase/server"
import type {
  MonitoringData,
  MonitoringDevice,
  MonitoringFormActivity,
  MonitoringPairingCode,
  MonitoringScreenshot,
  MonitoringSubAccount,
  MonitoringSyncStatus,
  MonitoringVisitedPage,
} from "@/types/monitoring"
import { deleteMonitoringDriveFile } from "@/lib/google-drive/monitoring"

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

type ProfileRow = {
  id: string
  role: string | null
  dom_id: string | null
  full_name: string | null
}

type PairingCodeRow = {
  id: string
  sub_id: string
  display_code: string | null
  expires_at: string
  used_at: string | null
  revoked_at: string | null
  created_at: string
}

type DeviceRow = {
  id: string
  sub_id: string
  name: string | null
  paired_at: string
  last_heartbeat_at: string | null
  last_seen_at: string | null
  extension_version: string | null
  sync_status: string | null
  pending_items: number | null
  last_error: string | null
  revoked_at: string | null
}

type MonitoringEventRow = {
  id: string
  device_id: string | null
  sub_id: string
  event_type: string
  occurred_at: string
  metadata: Record<string, unknown> | null
}

type MonitoringContext = {
  userId: string
  profile: ProfileRow
}

const MONITORING_EVENT_LOAD_CHUNK_SIZE = 1000

function revalidateMonitoring() {
  revalidatePath("/monitoring")
}

function normalizeName(value: string | null | undefined, fallback: string) {
  const name = value?.trim()
  return name || fallback
}

function normalizeDeviceName(value: FormDataEntryValue | string | null) {
  if (typeof value !== "string") return ""
  return value.trim().replace(/\s+/g, " ").slice(0, 80).trim()
}

function normalizeSyncStatus(value: string | null): MonitoringSyncStatus {
  if (
    value === "pending" ||
    value === "error" ||
    value === "revoked" ||
    value === "connected"
  ) {
    return value
  }

  return "connected"
}

function isDeviceActive(lastHeartbeatAt: string | null) {
  if (!lastHeartbeatAt) return false
  const lastHeartbeat = new Date(lastHeartbeatAt).getTime()
  if (!Number.isFinite(lastHeartbeat)) return false

  return Date.now() - lastHeartbeat <= MONITORING_ACTIVE_WINDOW_MINUTES * 60_000
}

async function getMonitoringContext(supabase: SupabaseServerClient) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { context: null, error: userError?.message || "Not authenticated" }
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, dom_id, full_name")
    .eq("id", user.id)
    .maybeSingle()

  if (error || !data) {
    return { context: null, error: error?.message || "Profil nebyl nalezen." }
  }

  const profile = data as ProfileRow
  if (profile.role !== "dom") {
    return { context: null, error: "Monitoring může spravovat pouze DOM." }
  }

  return {
    context: {
      userId: user.id,
      profile,
    } satisfies MonitoringContext,
    error: null,
  }
}

async function getSubAccounts(
  supabase: SupabaseServerClient,
  domId: string,
): Promise<MonitoringSubAccount[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("dom_id", domId)
    .eq("role", "sub")
    .order("full_name", { ascending: true })

  if (error) {
    console.error("Error loading monitoring SUB accounts:", error)
    return []
  }

  return ((data || []) as Array<{ id: string; full_name: string | null }>).map(
    (profile, index) => ({
      id: profile.id,
      name: normalizeName(profile.full_name, `SUB ${index + 1}`),
    }),
  )
}

function normalizePairingCodeRow(row: PairingCodeRow): MonitoringPairingCode {
  return {
    id: row.id,
    subId: row.sub_id,
    displayCode: row.display_code,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  }
}

function normalizeDeviceRow(
  row: DeviceRow,
  subNamesById: Map<string, string>,
): MonitoringDevice {
  return {
    id: row.id,
    subId: row.sub_id,
    subName: subNamesById.get(row.sub_id) || "SUB",
    name: normalizeName(row.name, MONITORING_DEFAULT_DEVICE_NAME),
    isActive: !row.revoked_at && isDeviceActive(row.last_heartbeat_at),
    pairedAt: row.paired_at,
    lastHeartbeatAt: row.last_heartbeat_at,
    lastSeenAt: row.last_seen_at,
    extensionVersion: row.extension_version,
    syncStatus: row.revoked_at ? "revoked" : normalizeSyncStatus(row.sync_status),
    pendingItems: row.pending_items || 0,
    lastError: row.last_error,
    revokedAt: row.revoked_at,
  }
}

function getMetadataText(
  metadata: Record<string, unknown> | null,
  key: string,
  fallback: string,
) {
  const value = metadata?.[key]
  return typeof value === "string" && value.trim() ? value.trim() : fallback
}

function getMetadataNumber(
  metadata: Record<string, unknown> | null,
  key: string,
) {
  const value = metadata?.[key]
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function getMetadataBoolean(
  metadata: Record<string, unknown> | null,
  key: string,
) {
  return metadata?.[key] === true
}

function normalizeVisitedPageRow(
  row: MonitoringEventRow,
  subNamesById: Map<string, string>,
  deviceNamesById: Map<string, string>,
): MonitoringVisitedPage | null {
  if (row.event_type !== "page_visit" && row.event_type !== "element_click") {
    return null
  }

  const url = getMetadataText(row.metadata, "url", "")
  if (!url) return null
  const eventType =
    row.event_type === "element_click" ? "element_click" : "page_visit"

  return {
    id: row.id,
    eventType,
    deviceId: row.device_id,
    deviceName: row.device_id
      ? deviceNamesById.get(row.device_id) || MONITORING_DEFAULT_DEVICE_NAME
      : MONITORING_DEFAULT_DEVICE_NAME,
    subId: row.sub_id,
    subName: subNamesById.get(row.sub_id) || "SUB",
    url,
    title: getMetadataText(row.metadata, "title", "Bez titulku"),
    occurredAt: row.occurred_at,
    durationMs: getMetadataNumber(row.metadata, "duration_ms"),
    incognito: getMetadataBoolean(row.metadata, "incognito"),
    elementHtml: getMetadataText(row.metadata, "element_html", "") || null,
    elementHref: getMetadataText(row.metadata, "element_href", "") || null,
    elementTagName: getMetadataText(row.metadata, "element_tag_name", "") || null,
    elementText: getMetadataText(row.metadata, "element_text", "") || null,
  }
}

function normalizeFormActivityRow(
  row: MonitoringEventRow,
  subNamesById: Map<string, string>,
  deviceNamesById: Map<string, string>,
): MonitoringFormActivity | null {
  if (row.event_type !== "form_activity") return null

  const url = getMetadataText(row.metadata, "url", "")
  if (!url) return null
  const activityKind = getMetadataText(row.metadata, "activity_kind", "change")

  return {
    activityKind:
      activityKind === "blur" || activityKind === "enter"
        ? activityKind
        : "change",
    deviceId: row.device_id,
    deviceName: row.device_id
      ? deviceNamesById.get(row.device_id) || MONITORING_DEFAULT_DEVICE_NAME
      : MONITORING_DEFAULT_DEVICE_NAME,
    elementHtml: getMetadataText(row.metadata, "element_html", "") || null,
    elementLabel: getMetadataText(row.metadata, "element_label", "") || null,
    elementName: getMetadataText(row.metadata, "element_name", "") || null,
    elementTagName:
      getMetadataText(row.metadata, "element_tag_name", "") || null,
    elementType: getMetadataText(row.metadata, "element_type", "") || null,
    id: row.id,
    incognito: getMetadataBoolean(row.metadata, "incognito"),
    occurredAt: row.occurred_at,
    subId: row.sub_id,
    subName: subNamesById.get(row.sub_id) || "SUB",
    title: getMetadataText(row.metadata, "title", "Bez titulku"),
    url,
    valueLength: getMetadataNumber(row.metadata, "value_length"),
    valuePreview: getMetadataText(row.metadata, "value_preview", "") || null,
    valueRedacted: getMetadataBoolean(row.metadata, "value_redacted"),
  }
}

function normalizeScreenshotRow(
  row: MonitoringEventRow,
  subNamesById: Map<string, string>,
  deviceNamesById: Map<string, string>,
): MonitoringScreenshot | null {
  if (row.event_type !== "page_screenshot") return null

  const driveFileId = getMetadataText(row.metadata, "drive_file_id", "")
  const url = getMetadataText(row.metadata, "url", "")
  if (!driveFileId || !url) return null

  return {
    deviceId: row.device_id,
    deviceName: row.device_id
      ? deviceNamesById.get(row.device_id) || MONITORING_DEFAULT_DEVICE_NAME
      : MONITORING_DEFAULT_DEVICE_NAME,
    driveFileId,
    filename:
      getMetadataText(row.metadata, "filename", "") || "monitoring-screenshot.jpg",
    id: row.id,
    imageUrl: `/api/monitoring/media/${driveFileId}`,
    incognito: getMetadataBoolean(row.metadata, "incognito"),
    mimeType: getMetadataText(row.metadata, "mime_type", "image/jpeg"),
    occurredAt: row.occurred_at,
    quality: getMetadataNumber(row.metadata, "quality"),
    sizeBytes: getMetadataNumber(row.metadata, "size_bytes"),
    subId: row.sub_id,
    subName: subNamesById.get(row.sub_id) || "SUB",
    thumbnailUrl: `/api/monitoring/media/${driveFileId}?variant=thumb`,
    title: getMetadataText(row.metadata, "title", "Bez titulku"),
    url,
  }
}

async function getMonitoringEvents(
  supabase: SupabaseServerClient,
  domId: string,
) {
  const events: MonitoringEventRow[] = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from("monitoring_events")
      .select("id, device_id, sub_id, event_type, occurred_at, metadata")
      .eq("dom_id", domId)
      .in("event_type", [
        "page_visit",
        "element_click",
        "form_activity",
        "page_screenshot",
      ])
      .order("occurred_at", { ascending: false })
      .range(from, from + MONITORING_EVENT_LOAD_CHUNK_SIZE - 1)

    if (error) return { data: events, error }

    const chunk = (data || []) as MonitoringEventRow[]
    events.push(...chunk)

    if (chunk.length < MONITORING_EVENT_LOAD_CHUNK_SIZE) {
      return { data: events, error: null }
    }

    from += MONITORING_EVENT_LOAD_CHUNK_SIZE
  }
}

export async function getMonitoringData(): Promise<
  { data: MonitoringData; error?: never } | { data?: never; error: string }
> {
  const supabase = await createClient()
  const { context, error: contextError } = await getMonitoringContext(supabase)

  if (contextError || !context) {
    return { error: contextError || "Nepodařilo se načíst monitoring." }
  }

  const subAccounts = await getSubAccounts(supabase, context.userId)
  const subNamesById = new Map(subAccounts.map((sub) => [sub.id, sub.name]))

  const [pairingCodesResult, devicesResult, eventsResult] = await Promise.all([
    supabase
      .from("monitoring_pairing_codes")
      .select(
        "id, sub_id, display_code, expires_at, used_at, revoked_at, created_at",
      )
      .eq("dom_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("monitoring_devices")
      .select(
        "id, sub_id, name, paired_at, last_heartbeat_at, last_seen_at, extension_version, sync_status, pending_items, last_error, revoked_at",
      )
      .eq("dom_id", context.userId)
      .order("created_at", { ascending: false }),
    getMonitoringEvents(supabase, context.userId),
  ])

  if (pairingCodesResult.error) {
    return { error: pairingCodesResult.error.message }
  }

  if (devicesResult.error) {
    return { error: devicesResult.error.message }
  }

  if (eventsResult.error) {
    return { error: eventsResult.error.message }
  }

  const devices = ((devicesResult.data || []) as DeviceRow[]).map((device) =>
    normalizeDeviceRow(device, subNamesById),
  )
  const deviceNamesById = new Map(
    devices.map((device) => [device.id, device.name]),
  )
  const visitedPages = (eventsResult.data || [])
    .map((event) =>
      normalizeVisitedPageRow(event, subNamesById, deviceNamesById),
    )
    .filter((event): event is MonitoringVisitedPage => Boolean(event))
  const formActivities = (eventsResult.data || [])
    .map((event) =>
      normalizeFormActivityRow(event, subNamesById, deviceNamesById),
    )
    .filter((event): event is MonitoringFormActivity => Boolean(event))
  const screenshots = (eventsResult.data || [])
    .map((event) =>
      normalizeScreenshotRow(event, subNamesById, deviceNamesById),
    )
    .filter((event): event is MonitoringScreenshot => Boolean(event))

  return {
    data: {
      activeWindowMinutes: MONITORING_ACTIVE_WINDOW_MINUTES,
      heartbeatIntervalMinutes: MONITORING_HEARTBEAT_INTERVAL_SECONDS / 60,
      subAccounts,
      pairingCodes: ((pairingCodesResult.data || []) as PairingCodeRow[]).map(
        normalizePairingCodeRow,
      ),
      devices,
      formActivities,
      screenshots,
      visitedPages,
    },
  }
}

export async function createMonitoringPairingCode(formData: FormData) {
  const supabase = await createClient()
  const { context, error: contextError } = await getMonitoringContext(supabase)

  if (contextError || !context) {
    return { error: contextError || "Monitoring může spravovat pouze DOM." }
  }

  const subId = String(formData.get("sub_id") || "")
  if (!subId) {
    return { error: "Vyber SUB účet pro párovací kód." }
  }

  const { data: subProfile, error: subError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", subId)
    .eq("dom_id", context.userId)
    .eq("role", "sub")
    .maybeSingle()

  if (subError || !subProfile) {
    return { error: subError?.message || "Vybraný SUB účet nebyl nalezen." }
  }

  const code = generatePairingCode()
  const codeHash = hashMonitoringSecret(normalizePairingCode(code))
  const expiresAt = new Date(
    Date.now() + MONITORING_PAIRING_CODE_TTL_MINUTES * 60_000,
  ).toISOString()

  const { error: revokeError } = await supabase
    .from("monitoring_pairing_codes")
    .update({ revoked_at: new Date().toISOString() })
    .eq("dom_id", context.userId)
    .is("used_at", null)
    .is("revoked_at", null)

  if (revokeError) {
    console.error("Error revoking previous monitoring pairing code:", revokeError)
    return { error: "Předchozí párovací kód se nepodařilo zneplatnit." }
  }

  const { error } = await supabase.from("monitoring_pairing_codes").insert({
    dom_id: context.userId,
    sub_id: subId,
    code_hash: codeHash,
    display_code: code,
    expires_at: expiresAt,
  })

  if (error) {
    console.error("Error creating monitoring pairing code:", error)
    return { error: "Párovací kód se nepodařilo vytvořit." }
  }

  revalidateMonitoring()
  return { success: true, code, expiresAt }
}

export async function renameMonitoringDevice(formData: FormData) {
  const supabase = await createClient()
  const { context, error: contextError } = await getMonitoringContext(supabase)

  if (contextError || !context) {
    return { error: contextError || "Monitoring může spravovat pouze DOM." }
  }

  const deviceId = String(formData.get("device_id") || "")
  const name = normalizeDeviceName(formData.get("name"))

  if (!deviceId) return { error: "Zařízení nebylo nalezeno." }
  if (!name) return { error: "Název zařízení je povinný." }

  const { error } = await supabase
    .from("monitoring_devices")
    .update({ name })
    .eq("id", deviceId)
    .eq("dom_id", context.userId)

  if (error) {
    console.error("Error renaming monitoring device:", error)
    return { error: "Zařízení se nepodařilo přejmenovat." }
  }

  revalidateMonitoring()
  return { success: true }
}

export async function revokeMonitoringDevice(formData: FormData) {
  const supabase = await createClient()
  const { context, error: contextError } = await getMonitoringContext(supabase)

  if (contextError || !context) {
    return { error: contextError || "Monitoring může spravovat pouze DOM." }
  }

  const deviceId = String(formData.get("device_id") || "")
  if (!deviceId) return { error: "Zařízení nebylo nalezeno." }

  const { error } = await supabase
    .from("monitoring_devices")
    .update({
      revoked_at: new Date().toISOString(),
      sync_status: "revoked",
    })
    .eq("id", deviceId)
    .eq("dom_id", context.userId)
    .is("revoked_at", null)

  if (error) {
    console.error("Error revoking monitoring device:", error)
    return { error: "Extension se nepodařilo zneplatnit." }
  }

  revalidateMonitoring()
  return { success: true }
}

export async function deleteMonitoringDevice(formData: FormData) {
  const supabase = await createClient()
  const { context, error: contextError } = await getMonitoringContext(supabase)

  if (contextError || !context) {
    return { error: contextError || "Monitoring může spravovat pouze DOM." }
  }

  const deviceId = String(formData.get("device_id") || "")
  if (!deviceId) return { error: "Zařízení nebylo nalezeno." }

  const { error } = await supabase
    .from("monitoring_devices")
    .delete()
    .eq("id", deviceId)
    .eq("dom_id", context.userId)
    .not("revoked_at", "is", null)

  if (error) {
    console.error("Error deleting monitoring device:", error)
    return { error: "Zneplatněnou instalaci se nepodařilo odebrat." }
  }

  revalidateMonitoring()
  return { success: true }
}

export async function deleteMonitoringEvent(formData: FormData) {
  const supabase = await createClient()
  const { context, error: contextError } = await getMonitoringContext(supabase)

  if (contextError || !context) {
    return { error: contextError || "Monitoring může spravovat pouze DOM." }
  }

  const eventId = String(formData.get("event_id") || "")
  if (!eventId) return { error: "Monitoring položka nebyla nalezena." }

  const { data: eventData } = await supabase
    .from("monitoring_events")
    .select("event_type, metadata")
    .eq("id", eventId)
    .eq("dom_id", context.userId)
    .maybeSingle()
  const eventRow = eventData as {
    event_type: string
    metadata: Record<string, unknown> | null
  } | null
  const driveFileId =
    eventRow?.event_type === "page_screenshot"
      ? getMetadataText(eventRow.metadata, "drive_file_id", "")
      : ""

  const { error } = await supabase
    .from("monitoring_events")
    .delete()
    .eq("id", eventId)
    .eq("dom_id", context.userId)

  if (error) {
    console.error("Error deleting monitoring event:", error)
    return { error: "Monitoring položku se nepodařilo smazat." }
  }

  if (driveFileId) {
    await deleteMonitoringDriveFile(driveFileId).catch((driveError) => {
      console.error("Error deleting monitoring Drive file:", driveError)
    })
  }

  revalidateMonitoring()
  return { success: true }
}
