export type MonitoringSession = {
  deviceToken: string
  deviceId: string
  deviceName: string
  heartbeatIntervalSeconds: number
  pairedAt: string
  lastHeartbeatAt: string | null
  syncStatus: "connected" | "pending" | "error"
  pendingItems: number
}

export type MonitoringPageVisitEvent = {
  eventId: string
  type: "page_visit"
  url: string
  title: string | null
  occurredAt: string
  durationMs: number | null
  incognito: boolean
}

export type MonitoringPageScreenshotEvent = {
  eventId: string
  type: "page_screenshot"
  pageVisitEventId: string
  url: string
  title: string | null
  occurredAt: string
  incognito: boolean
  screenshotDataUrl: string
  mimeType: "image/jpeg"
  quality: number
}

export type MonitoringElementClickEvent = {
  elementHtml: string
  elementHref: string | null
  elementTagName: string
  elementText: string | null
  eventId: string
  incognito: boolean
  occurredAt: string
  pageUrl: string
  title: string | null
  type: "element_click"
}

export type MonitoringFormActivityEvent = {
  activityKind: "blur" | "change" | "enter"
  elementHtml: string
  elementLabel: string | null
  elementName: string | null
  elementTagName: string
  elementType: string | null
  eventId: string
  incognito: boolean
  occurredAt: string
  pageUrl: string
  title: string | null
  type: "form_activity"
  valueLength: number | null
  valuePreview: string | null
  valueRedacted: boolean
}

export type MonitoringEvent =
  | MonitoringElementClickEvent
  | MonitoringFormActivityEvent
  | MonitoringPageScreenshotEvent
  | MonitoringPageVisitEvent

export type PairingResponse = {
  success: boolean
  deviceToken?: string
  deviceId?: string
  deviceName?: string
  heartbeatIntervalSeconds?: number
  error?: string
}

export type SyncResponse = {
  success: boolean
  active?: boolean
  revoked?: boolean
  acceptedCount?: number
  deviceId?: string
  deviceName?: string
  heartbeatIntervalSeconds?: number
  error?: string
}

export type HeartbeatResponse = {
  success: boolean
  active?: boolean
  revoked?: boolean
  deviceId?: string
  deviceName?: string
  heartbeatIntervalSeconds?: number
  error?: string
}
