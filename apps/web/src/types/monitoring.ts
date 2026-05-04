export type MonitoringSyncStatus = "connected" | "pending" | "error" | "revoked"

export type MonitoringSubAccount = {
  id: string
  name: string
}

export type MonitoringPairingCode = {
  id: string
  subId: string
  displayCode: string | null
  expiresAt: string
  usedAt: string | null
  revokedAt: string | null
  createdAt: string
}

export type MonitoringDevice = {
  id: string
  subId: string
  subName: string
  name: string
  isActive: boolean
  pairedAt: string
  lastHeartbeatAt: string | null
  lastSeenAt: string | null
  extensionVersion: string | null
  syncStatus: MonitoringSyncStatus
  pendingItems: number
  lastError: string | null
  revokedAt: string | null
}

export type MonitoringVisitedPage = {
  id: string
  eventType: "page_visit" | "element_click"
  deviceId: string | null
  deviceName: string
  subId: string
  subName: string
  url: string
  title: string
  occurredAt: string
  durationMs: number | null
  incognito: boolean
  elementHtml: string | null
  elementHref: string | null
  elementTagName: string | null
  elementText: string | null
}

export type MonitoringFormActivity = {
  activityKind: "blur" | "change" | "enter"
  deviceId: string | null
  deviceName: string
  elementHtml: string | null
  elementLabel: string | null
  elementName: string | null
  elementTagName: string | null
  elementType: string | null
  id: string
  incognito: boolean
  occurredAt: string
  subId: string
  subName: string
  title: string
  url: string
  valueLength: number | null
  valuePreview: string | null
  valueRedacted: boolean
}

export type MonitoringScreenshot = {
  deviceId: string | null
  deviceName: string
  driveFileId: string
  filename: string
  id: string
  imageUrl: string
  incognito: boolean
  mimeType: string
  occurredAt: string
  quality: number | null
  sizeBytes: number | null
  subId: string
  subName: string
  thumbnailUrl: string
  title: string
  url: string
}

export type MonitoringData = {
  activeWindowMinutes: number
  heartbeatIntervalMinutes: number
  generatedCode?: {
    code: string
    expiresAt: string
  }
  subAccounts: MonitoringSubAccount[]
  pairingCodes: MonitoringPairingCode[]
  devices: MonitoringDevice[]
  formActivities: MonitoringFormActivity[]
  screenshots: MonitoringScreenshot[]
  visitedPages: MonitoringVisitedPage[]
}
