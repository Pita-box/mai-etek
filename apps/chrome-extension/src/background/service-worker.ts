import { clearSession, getSession, updateSession } from "../shared/auth-storage"
import { HEARTBEAT_ALARM_NAME } from "../shared/config"
import {
  isRevokedRequestError,
  sendHeartbeat,
  syncMonitoringEvents,
} from "../shared/api-client"
import {
  clearMonitoringEventBuffer,
  getQueuedEventBatch,
  getQueuedEvents,
  queueMonitoringEvent,
  removeQueuedEvents,
  saveLastCapture,
} from "../shared/event-buffer"
import {
  canAttemptSync,
  clearSyncBackoff,
  recordSyncFailure,
} from "../shared/sync-backoff"
import type { MonitoringElementClickEvent, MonitoringEvent } from "../shared/types"
import {
  captureCurrentActiveTab,
  registerBrowserActivityTracking,
} from "./browser-activity"

let syncQueuedEventsInFlight: Promise<void> | null = null

async function scheduleHeartbeat(intervalSeconds: number) {
  await chrome.alarms.create(HEARTBEAT_ALARM_NAME, {
    periodInMinutes: Math.max(1, intervalSeconds / 60),
  })
}

async function clearHeartbeat() {
  await chrome.alarms.clear(HEARTBEAT_ALARM_NAME)
}

async function clearRevokedSession() {
  await clearSession()
  await clearMonitoringEventBuffer()
  await clearSyncBackoff()
  await clearHeartbeat()
}

async function syncQueuedEventsOnce() {
  const session = await getSession()
  if (!session) return

  const queuedEvents = await getQueuedEvents()
  if (queuedEvents.length === 0) return
  if (!(await canAttemptSync())) {
    await updateSession((current) => ({
      ...current,
      pendingItems: queuedEvents.length,
      syncStatus: "pending",
    }))
    return
  }

  const events = await getQueuedEventBatch()
  if (events.length === 0) return

  try {
    const response = await syncMonitoringEvents(session.deviceToken, events)

    if (response.revoked || !response.success) {
      await clearRevokedSession()
      return
    }

    const pendingItems = await removeQueuedEvents(events)
    await clearSyncBackoff()

    await updateSession((current) => ({
      ...current,
      deviceName: response.deviceName || current.deviceName,
      heartbeatIntervalSeconds:
        response.heartbeatIntervalSeconds || current.heartbeatIntervalSeconds,
      lastHeartbeatAt: new Date().toISOString(),
      pendingItems,
      syncStatus: pendingItems > 0 ? "pending" : "connected",
    }))
  } catch (error) {
    if (isRevokedRequestError(error)) {
      await clearRevokedSession()
      return
    }

    await recordSyncFailure()
    await saveLastCapture({
      at: new Date().toISOString(),
      label: getEventLabel(events[0]),
      status: "sync-error",
    })
    await updateSession((current) => ({
      ...current,
      pendingItems: queuedEvents.length,
      syncStatus: "error",
    }))
  }
}

async function syncQueuedEvents() {
  if (syncQueuedEventsInFlight) return syncQueuedEventsInFlight

  syncQueuedEventsInFlight = syncQueuedEventsOnce().finally(() => {
    syncQueuedEventsInFlight = null
  })

  return syncQueuedEventsInFlight
}

export async function runHeartbeat() {
  const session = await getSession()
  if (!session) {
    await clearHeartbeat()
    return
  }

  try {
    await syncQueuedEvents()
    const nextSession = await getSession()
    if (!nextSession) return

    const response = await sendHeartbeat(session.deviceToken, {
      syncStatus: nextSession.syncStatus,
      pendingItems: nextSession.pendingItems,
    })

    if (response.revoked || !response.success) {
      await clearRevokedSession()
      return
    }

    const queuedEvents = await getQueuedEvents()
    const pendingItems = queuedEvents.length

    await updateSession((current) => ({
      ...current,
      deviceName: response.deviceName || current.deviceName,
      heartbeatIntervalSeconds:
        response.heartbeatIntervalSeconds || current.heartbeatIntervalSeconds,
      lastHeartbeatAt: new Date().toISOString(),
      syncStatus: pendingItems > 0 ? "pending" : "connected",
      pendingItems,
    }))
    await scheduleHeartbeat(
      response.heartbeatIntervalSeconds || session.heartbeatIntervalSeconds,
    )
  } catch (error) {
    if (isRevokedRequestError(error)) {
      await clearRevokedSession()
      return
    }

    await updateSession((current) => ({
      ...current,
      syncStatus: "error",
      lastHeartbeatAt: current.lastHeartbeatAt,
    }))
  }
}

registerBrowserActivityTracking(() => {
  void syncQueuedEvents()
})

chrome.runtime.onInstalled.addListener(() => {
  void getSession().then((session) => {
    if (session) void scheduleHeartbeat(session.heartbeatIntervalSeconds)
  })
})

chrome.runtime.onStartup.addListener(() => {
  void getSession().then((session) => {
    if (session) void scheduleHeartbeat(session.heartbeatIntervalSeconds)
  })
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === HEARTBEAT_ALARM_NAME) {
    void runHeartbeat()
  }
})

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

function queueContentEvent(event: MonitoringEvent | undefined) {
  return getSession()
    .then((session) => {
      if (!session || !event) return null
      return queueMonitoringEvent(event)
    })
    .then(() => syncQueuedEvents())
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "mmm:element-click") {
    const event = message.event as MonitoringElementClickEvent | undefined

    if (event?.type !== "element_click") {
      sendResponse({ success: false, error: "Neplatný monitoring event." })
      return false
    }

    void getSession()
      .then((session) => {
        if (!session) return null
        return queueMonitoringEvent({
          ...event,
          incognito: sender.tab?.incognito === true,
        })
      })
      .then(() => syncQueuedEvents())
      .then(() => sendResponse({ success: true }))
      .catch((error) =>
        sendResponse({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Kliknutí se nepodařilo uložit.",
        }),
      )

    return true
  }

  if (message?.type === "mmm:form-activity") {
    const event = message.event as MonitoringEvent | undefined

    if (event?.type !== "form_activity") {
      sendResponse({ success: false, error: "Neplatný monitoring event." })
      return false
    }

    void queueContentEvent({
      ...event,
      incognito: sender.tab?.incognito === true,
    })
      .then(() => sendResponse({ success: true }))
      .catch((error) =>
        sendResponse({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Formulářovou aktivitu se nepodařilo uložit.",
        }),
      )

    return true
  }

  if (message?.type !== "mmm:heartbeat") return false

  void runHeartbeat()
    .then(async () => {
      await captureCurrentActiveTab().catch(() => null)
      sendResponse({ success: true })
    })
    .catch((error) =>
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : "Heartbeat selhal.",
      }),
    )

  return true
})
