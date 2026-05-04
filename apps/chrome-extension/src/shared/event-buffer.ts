import { updateSession } from "./auth-storage"
import type { MonitoringEvent } from "./types"

const EVENT_BUFFER_KEY = "mmm_monitoring_event_buffer"
const LAST_CAPTURE_KEY = "mmm_monitoring_last_capture"
const MAX_BUFFER_EVENTS = 1000
const MAX_BUFFER_BYTES = 8_000_000
const MAX_SYNC_EVENTS = 100
const MAX_SYNC_BYTES = 2_500_000

export type LastMonitoringCapture = {
  at: string
  label: string
  status: "captured" | "queued" | "sync-error" | "synced"
}

export async function getQueuedEvents() {
  const result = await chrome.storage.local.get(EVENT_BUFFER_KEY)
  return (result[EVENT_BUFFER_KEY] as MonitoringEvent[] | undefined) || []
}

export async function getQueuedEventBatch() {
  const events = await getQueuedEvents()
  const batch: MonitoringEvent[] = []
  let bytes = 2

  for (const event of events) {
    if (batch.length >= MAX_SYNC_EVENTS) break

    const eventBytes = getEventByteSize(event)
    if (batch.length > 0 && bytes + eventBytes > MAX_SYNC_BYTES) break

    batch.push(event)
    bytes += eventBytes
  }

  return batch
}

export async function getLastCapture() {
  const result = await chrome.storage.local.get(LAST_CAPTURE_KEY)
  return (result[LAST_CAPTURE_KEY] as LastMonitoringCapture | undefined) || null
}

export async function saveLastCapture(capture: LastMonitoringCapture) {
  await chrome.storage.local.set({ [LAST_CAPTURE_KEY]: capture })
}

export async function clearMonitoringEventBuffer() {
  await chrome.storage.local.remove([EVENT_BUFFER_KEY, LAST_CAPTURE_KEY])
}

export async function queueMonitoringEvent(event: MonitoringEvent) {
  const events = await getQueuedEvents()
  const nextEvents = trimEventBuffer([
    ...events.filter((queuedEvent) => queuedEvent.eventId !== event.eventId),
    event,
  ])

  await chrome.storage.local.set({ [EVENT_BUFFER_KEY]: nextEvents })
  await saveLastCapture({
    at: new Date().toISOString(),
    label: getEventLabel(event),
    status: "queued",
  })
  await updateSession((session) => ({
    ...session,
    pendingItems: nextEvents.length,
    syncStatus: nextEvents.length > 0 ? "pending" : session.syncStatus,
  }))
}

function isSameEvent(
  firstEvent: MonitoringEvent,
  secondEvent: MonitoringEvent,
) {
  return JSON.stringify(firstEvent) === JSON.stringify(secondEvent)
}

export async function removeQueuedEvents(syncedEvents: MonitoringEvent[]) {
  const syncedEventsById = new Map(
    syncedEvents.map((event) => [event.eventId, event]),
  )
  const events = await getQueuedEvents()
  const nextEvents = events.filter((event) => {
    const syncedEvent = syncedEventsById.get(event.eventId)
    return !syncedEvent || !isSameEvent(event, syncedEvent)
  })

  await chrome.storage.local.set({ [EVENT_BUFFER_KEY]: nextEvents })
  if (syncedEvents.length > 0) {
    await saveLastCapture({
      at: new Date().toISOString(),
      label: getEventLabel(syncedEvents[0]),
      status: "synced",
    })
  }
  await updateSession((session) => ({
    ...session,
    pendingItems: nextEvents.length,
    syncStatus: nextEvents.length > 0 ? "pending" : "connected",
  }))

  return nextEvents.length
}

function getEventByteSize(event: MonitoringEvent) {
  return JSON.stringify(event).length
}

function getEventsByteSize(events: MonitoringEvent[]) {
  return events.reduce((size, event) => size + getEventByteSize(event), 2)
}

function trimEventBuffer(events: MonitoringEvent[]) {
  const nextEvents = events.slice(-MAX_BUFFER_EVENTS)

  while (
    nextEvents.length > 1 &&
    getEventsByteSize(nextEvents) > MAX_BUFFER_BYTES
  ) {
    nextEvents.shift()
  }

  return nextEvents
}

function getEventLabel(event: MonitoringEvent) {
  if (event.type === "element_click") {
    return event.elementText || event.elementHtml.slice(0, 80)
  }

  if (event.type === "form_activity") {
    return event.elementLabel || event.elementName || event.elementHtml.slice(0, 80)
  }

  if (event.type === "page_screenshot") {
    return event.title || event.url
  }

  return event.title || event.url
}
