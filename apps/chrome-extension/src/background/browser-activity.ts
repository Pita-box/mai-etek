import { getSession } from "../shared/auth-storage"
import { queueMonitoringEvent } from "../shared/event-buffer"
import type {
  MonitoringPageScreenshotEvent,
  MonitoringPageVisitEvent,
} from "../shared/types"

const ACTIVE_PAGE_KEY = "mmm_active_page"
const SCREENSHOT_QUALITY = 70
const SCREENSHOT_CAPTURE_DELAY_MS = 1200
const SCREENSHOT_MIN_INTERVAL_MS = 60_000
const SCREENSHOT_MAX_DATA_URL_LENGTH = 1_800_000

type ActivePageState = {
  eventId: string
  tabId: number
  windowId: number
  url: string
  title: string | null
  startedAt: string
  incognito: boolean
}

let lastScreenshotCapture: { at: number; url: string } | null = null

function createEventId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function canTrackUrl(url: string | undefined) {
  return Boolean(url?.startsWith("http://") || url?.startsWith("https://"))
}

function canCaptureScreenshot(url: string | undefined) {
  if (!canTrackUrl(url)) return false
  const normalizedUrl = url?.toLowerCase() || ""
  return !/login|signin|sign-in|password|heslo|token|otp|pin|checkout|payment|billing|bank/.test(
    normalizedUrl,
  )
}

function normalizeTitle(title: string | undefined) {
  const normalizedTitle = title?.trim()
  return normalizedTitle || null
}

async function getActivePage() {
  const result = await chrome.storage.local.get(ACTIVE_PAGE_KEY)
  return (result[ACTIVE_PAGE_KEY] as ActivePageState | undefined) || null
}

async function setActivePage(page: ActivePageState | null) {
  if (!page) {
    await chrome.storage.local.remove(ACTIVE_PAGE_KEY)
    return
  }

  await chrome.storage.local.set({ [ACTIVE_PAGE_KEY]: page })
}

function toVisitEvent(
  page: ActivePageState,
  durationMs: number | null,
): MonitoringPageVisitEvent {
  return {
    eventId: page.eventId,
    type: "page_visit",
    url: page.url,
    title: page.title,
    occurredAt: page.startedAt,
    durationMs,
    incognito: page.incognito,
  }
}

function toScreenshotEvent(
  page: ActivePageState,
  screenshotDataUrl: string,
): MonitoringPageScreenshotEvent {
  return {
    eventId: `${page.eventId}:screenshot`,
    type: "page_screenshot",
    pageVisitEventId: page.eventId,
    url: page.url,
    title: page.title,
    occurredAt: new Date().toISOString(),
    incognito: page.incognito,
    screenshotDataUrl,
    mimeType: "image/jpeg",
    quality: SCREENSHOT_QUALITY,
  }
}

async function queuePageScreenshot(
  page: ActivePageState,
  onQueueChanged?: () => void,
) {
  if (!canCaptureScreenshot(page.url)) return

  const now = Date.now()
  if (
    lastScreenshotCapture?.url === page.url &&
    now - lastScreenshotCapture.at < SCREENSHOT_MIN_INTERVAL_MS
  ) {
    return
  }

  lastScreenshotCapture = { at: now, url: page.url }

  setTimeout(() => {
    void getActivePage()
      .then(async (currentPage) => {
        if (
          !currentPage ||
          currentPage.eventId !== page.eventId ||
          currentPage.url !== page.url
        ) {
          return
        }

        const screenshotDataUrl = await chrome.tabs.captureVisibleTab(page.windowId, {
          format: "jpeg",
          quality: SCREENSHOT_QUALITY,
        })

        if (
          !screenshotDataUrl.startsWith("data:image/jpeg;base64,") ||
          screenshotDataUrl.length > SCREENSHOT_MAX_DATA_URL_LENGTH
        ) {
          return
        }

        await queueMonitoringEvent(toScreenshotEvent(currentPage, screenshotDataUrl))
        onQueueChanged?.()
      })
      .catch(() => null)
  }, SCREENSHOT_CAPTURE_DELAY_MS)
}

async function finishActivePage(now = Date.now()) {
  const activePage = await getActivePage()
  if (!activePage) return

  const startedAt = new Date(activePage.startedAt).getTime()
  const durationMs = Number.isFinite(startedAt)
    ? Math.max(0, now - startedAt)
    : null

  await queueMonitoringEvent(toVisitEvent(activePage, durationMs))
  await setActivePage(null)
}

export async function captureTabVisit(
  tab: chrome.tabs.Tab,
  onQueueChanged?: () => void,
  shouldCaptureScreenshot = true,
) {
  const session = await getSession()
  if (!session || !tab.id) return
  if (!canTrackUrl(tab.url)) {
    await finishActivePage()
    return
  }

  const activePage = await getActivePage()
  const title = normalizeTitle(tab.title)

  if (activePage?.tabId === tab.id && activePage.url === tab.url) {
    const nextPage = {
      ...activePage,
      title: title || activePage.title,
    }

    await setActivePage(nextPage)
    await queueMonitoringEvent(toVisitEvent(nextPage, null))
    if (shouldCaptureScreenshot) {
      await queuePageScreenshot(nextPage, onQueueChanged)
    }
    return
  }

  await finishActivePage()

  const nextPage: ActivePageState = {
    eventId: createEventId(),
    tabId: tab.id,
    windowId: tab.windowId,
    url: tab.url || "",
    title,
    startedAt: new Date().toISOString(),
    incognito: tab.incognito === true,
  }

  await setActivePage(nextPage)
  await queueMonitoringEvent(toVisitEvent(nextPage, null))
  if (shouldCaptureScreenshot) {
    await queuePageScreenshot(nextPage, onQueueChanged)
  }
}

export async function captureCurrentActiveTab() {
  const tabs = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  })

  const tab = tabs[0]
  if (tab) await captureTabVisit(tab)
}

export function registerBrowserActivityTracking(onQueueChanged: () => void) {
  chrome.tabs.onActivated.addListener((activeInfo) => {
    void chrome.tabs
      .get(activeInfo.tabId)
      .then((tab) => captureTabVisit(tab, onQueueChanged))
      .then(onQueueChanged)
      .catch(() => null)
  })

  chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
    if (!tab.active || (!changeInfo.url && changeInfo.status !== "complete")) {
      return
    }

    void captureTabVisit(tab, onQueueChanged, changeInfo.status === "complete")
      .then(onQueueChanged)
      .catch(() => null)
  })

  chrome.windows.onFocusChanged.addListener((windowId) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
      void finishActivePage()
        .then(onQueueChanged)
        .catch(() => null)
      return
    }

    void chrome.tabs
      .query({ active: true, windowId })
      .then((tabs) => tabs[0])
      .then((tab) => {
        if (tab) return captureTabVisit(tab, onQueueChanged)
        return finishActivePage()
      })
      .then(onQueueChanged)
      .catch(() => null)
  })
}
