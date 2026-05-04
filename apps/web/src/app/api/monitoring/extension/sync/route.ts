import { NextRequest } from "next/server"
import { monitoringJson, monitoringOptions } from "@/lib/monitoring/api-response"
import { MONITORING_HEARTBEAT_INTERVAL_SECONDS } from "@/lib/monitoring/constants"
import { hashMonitoringSecret } from "@/lib/monitoring/crypto"
import { uploadMonitoringFileToDrive } from "@/lib/google-drive/monitoring"
import { createAdminClient } from "@/utils/supabase/admin"

export const dynamic = "force-dynamic"

type MonitoringDeviceRow = {
  id: string
  dom_id: string
  sub_id: string
  name: string
  revoked_at: string | null
}

type SyncEventInput = {
  activityKind?: unknown
  elementHtml?: unknown
  elementHref?: unknown
  elementLabel?: unknown
  elementName?: unknown
  elementTagName?: unknown
  elementText?: unknown
  elementType?: unknown
  eventId?: unknown
  pageUrl?: unknown
  type?: unknown
  url?: unknown
  title?: unknown
  occurredAt?: unknown
  durationMs?: unknown
  incognito?: unknown
  mimeType?: unknown
  pageVisitEventId?: unknown
  quality?: unknown
  screenshotDataUrl?: unknown
  valueLength?: unknown
  valuePreview?: unknown
  valueRedacted?: unknown
}

type MonitoringEventRowInput = {
  device_id: string
  dom_id: string
  sub_id: string
  source_event_id: string
  occurred_at: string
  event_type: string
  metadata: Record<string, unknown>
}

function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) return null
  return authHeader.slice("Bearer ".length).trim() || null
}

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null
  const text = value.trim().replace(/\s+/g, " ").slice(0, maxLength)
  return text || null
}

function normalizeHtml(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null
  const text = value.trim().replace(/\s+/g, " ").slice(0, maxLength)
  return text || null
}

function normalizeUrl(value: unknown) {
  const url = normalizeText(value, 2048)
  if (!url) return null
  return url.startsWith("http://") || url.startsWith("https://") ? url : null
}

function normalizeDate(value: unknown) {
  if (typeof value !== "string") return new Date().toISOString()
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

function normalizeDuration(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  return Math.max(0, Math.floor(value))
}

function normalizeLength(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  return Math.max(0, Math.floor(value))
}

function normalizeQuality(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  return Math.min(100, Math.max(1, Math.floor(value)))
}

function parseScreenshotDataUrl(value: unknown) {
  if (typeof value !== "string") return null
  const match = value.match(/^data:(image\/jpeg);base64,([A-Za-z0-9+/=]+)$/)
  if (!match) return null

  return {
    body: Buffer.from(match[2], "base64"),
    mimeType: match[1],
  }
}

function getScreenshotFilename(date: Date) {
  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  const seconds = String(date.getSeconds()).padStart(2, "0")

  return `Screenshot_${day}-${month}-${year}_${hours}-${minutes}-${seconds}.jpg`
}

async function getRequestBody(request: NextRequest) {
  try {
    return (await request.json()) as {
      events?: unknown
      extensionVersion?: unknown
    }
  } catch {
    return {}
  }
}

async function hasExistingSourceEvent(
  supabase: ReturnType<typeof createAdminClient>,
  deviceId: string,
  sourceEventId: string,
) {
  const { data, error } = await supabase
    .from("monitoring_events")
    .select("id")
    .eq("device_id", deviceId)
    .eq("source_event_id", sourceEventId)
    .maybeSingle()

  if (error) {
    console.error("Monitoring duplicate event lookup failed:", error.message)
    return false
  }

  return Boolean(data)
}

export function OPTIONS() {
  return monitoringOptions()
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
    .select("id, dom_id, sub_id, name, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle()

  if (error) {
    console.error("Monitoring sync lookup failed:", error.message)
    return monitoringJson(
      { success: false, error: "Sync se nepodařilo ověřit." },
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
  const rawEvents = Array.isArray(body.events) ? body.events : []
  const rows: MonitoringEventRowInput[] = []

  try {
    for (const rawEvent of rawEvents) {
      const event = (rawEvent || {}) as SyncEventInput
      const sourceEventId = normalizeText(event.eventId, 120)

      if (!sourceEventId) {
        continue
      }

      const baseRow = {
        device_id: device.id,
        dom_id: device.dom_id,
        sub_id: device.sub_id,
        source_event_id: sourceEventId,
        occurred_at: normalizeDate(event.occurredAt),
      }

      if (event.type === "page_visit") {
        const url = normalizeUrl(event.url)
        if (!url) continue

        rows.push({
          ...baseRow,
          event_type: "page_visit",
          metadata: {
            duration_ms: normalizeDuration(event.durationMs),
            incognito: event.incognito === true,
            title: normalizeText(event.title, 300) || "Bez titulku",
            url,
          },
        })
        continue
      }

      if (event.type === "element_click") {
        const url = normalizeUrl(event.pageUrl)
        const elementHtml = normalizeHtml(event.elementHtml, 1600)
        if (!url || !elementHtml) continue

        rows.push({
          ...baseRow,
          event_type: "element_click",
          metadata: {
            element_href: normalizeText(event.elementHref, 500),
            element_html: elementHtml,
            element_tag_name: normalizeText(event.elementTagName, 80),
            element_text: normalizeText(event.elementText, 300),
            incognito: event.incognito === true,
            title: normalizeText(event.title, 300) || "Bez titulku",
            url,
          },
        })
        continue
      }

      if (event.type === "form_activity") {
        const url = normalizeUrl(event.pageUrl)
        const elementHtml = normalizeHtml(event.elementHtml, 1600)
        if (!url || !elementHtml) continue

        rows.push({
          ...baseRow,
          event_type: "form_activity",
          metadata: {
            activity_kind:
              event.activityKind === "change" ||
              event.activityKind === "blur" ||
              event.activityKind === "enter"
                ? event.activityKind
                : "change",
            element_html: elementHtml,
            element_label: normalizeText(event.elementLabel, 200),
            element_name: normalizeText(event.elementName, 200),
            element_tag_name: normalizeText(event.elementTagName, 80),
            element_type: normalizeText(event.elementType, 80),
            incognito: event.incognito === true,
            title: normalizeText(event.title, 300) || "Bez titulku",
            url,
            value_length: normalizeLength(event.valueLength),
            value_preview: normalizeText(event.valuePreview, 500),
            value_redacted: event.valueRedacted === true,
          },
        })
        continue
      }

      if (event.type === "page_screenshot") {
        const url = normalizeUrl(event.url)
        const screenshot = parseScreenshotDataUrl(event.screenshotDataUrl)
        const occurredAt = normalizeDate(event.occurredAt)
        if (!url || !screenshot || screenshot.body.byteLength > 1_500_000) {
          continue
        }

        if (await hasExistingSourceEvent(supabase, device.id, sourceEventId)) {
          continue
        }

        const uploaded = await uploadMonitoringFileToDrive({
          body: screenshot.body,
          date: new Date(occurredAt),
          filename: getScreenshotFilename(new Date(occurredAt)),
          mimeType: screenshot.mimeType,
        })

        rows.push({
          ...baseRow,
          event_type: "page_screenshot",
          metadata: {
            drive_file_id: uploaded.driveFileId,
            drive_folder_id: uploaded.folderId,
            drive_web_view_link: uploaded.driveWebViewLink,
            filename: uploaded.originalFilename,
            incognito: event.incognito === true,
            mime_type: uploaded.mimeType,
            page_visit_event_id: normalizeText(event.pageVisitEventId, 120),
            quality: normalizeQuality(event.quality),
            size_bytes: uploaded.sizeBytes,
            title: normalizeText(event.title, 300) || "Bez titulku",
            url,
          },
        })
      }
    }
  } catch (syncError) {
    console.error("Monitoring screenshot upload failed:", syncError)
    return monitoringJson(
      { success: false, error: "Snímek se nepodařilo uložit na Google Drive." },
      { status: 500 },
    )
  }

  if (rows.length > 0) {
    const { error: insertError } = await supabase
      .from("monitoring_events")
      .upsert(rows, {
        onConflict: "device_id,source_event_id",
      })

    if (insertError) {
      console.error("Monitoring sync insert failed:", insertError.message)
      return monitoringJson(
        { success: false, error: "Sync událostí se nepodařilo uložit." },
        { status: 500 },
      )
    }
  }

  const timestamp = new Date().toISOString()
  const extensionVersion = normalizeText(body.extensionVersion, 40)
  const { error: updateError } = await supabase
    .from("monitoring_devices")
    .update({
      extension_version: extensionVersion,
      last_error: null,
      last_heartbeat_at: timestamp,
      last_seen_at: timestamp,
      pending_items: 0,
      sync_status: "connected",
    })
    .eq("id", device.id)

  if (updateError) {
    console.error("Monitoring sync device update failed:", updateError.message)
  }

  return monitoringJson({
    success: true,
    active: true,
    acceptedCount: rows.length,
    deviceId: device.id,
    deviceName: device.name,
    heartbeatIntervalSeconds: MONITORING_HEARTBEAT_INTERVAL_SECONDS,
    revoked: false,
  })
}
