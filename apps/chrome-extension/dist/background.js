/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/background/browser-activity.ts"
/*!********************************************!*\
  !*** ./src/background/browser-activity.ts ***!
  \********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   captureCurrentActiveTab: () => (/* binding */ captureCurrentActiveTab),
/* harmony export */   captureTabVisit: () => (/* binding */ captureTabVisit),
/* harmony export */   registerBrowserActivityTracking: () => (/* binding */ registerBrowserActivityTracking)
/* harmony export */ });
/* harmony import */ var _shared_auth_storage__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../shared/auth-storage */ "./src/shared/auth-storage.ts");
/* harmony import */ var _shared_event_buffer__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../shared/event-buffer */ "./src/shared/event-buffer.ts");


const ACTIVE_PAGE_KEY = "mmm_active_page";
const SCREENSHOT_QUALITY = 70;
const SCREENSHOT_CAPTURE_DELAY_MS = 1200;
const SCREENSHOT_MIN_INTERVAL_MS = 60_000;
const SCREENSHOT_MAX_DATA_URL_LENGTH = 1_800_000;
let lastScreenshotCapture = null;
function createEventId() {
    if (typeof crypto.randomUUID === "function")
        return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function canTrackUrl(url) {
    return Boolean(url?.startsWith("http://") || url?.startsWith("https://"));
}
function canCaptureScreenshot(url) {
    if (!canTrackUrl(url))
        return false;
    const normalizedUrl = url?.toLowerCase() || "";
    return !/login|signin|sign-in|password|heslo|token|otp|pin|checkout|payment|billing|bank/.test(normalizedUrl);
}
function normalizeTitle(title) {
    const normalizedTitle = title?.trim();
    return normalizedTitle || null;
}
async function getActivePage() {
    const result = await chrome.storage.local.get(ACTIVE_PAGE_KEY);
    return result[ACTIVE_PAGE_KEY] || null;
}
async function setActivePage(page) {
    if (!page) {
        await chrome.storage.local.remove(ACTIVE_PAGE_KEY);
        return;
    }
    await chrome.storage.local.set({ [ACTIVE_PAGE_KEY]: page });
}
function toVisitEvent(page, durationMs) {
    return {
        eventId: page.eventId,
        type: "page_visit",
        url: page.url,
        title: page.title,
        occurredAt: page.startedAt,
        durationMs,
        incognito: page.incognito,
    };
}
function toScreenshotEvent(page, screenshotDataUrl) {
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
    };
}
async function queuePageScreenshot(page, onQueueChanged) {
    if (!canCaptureScreenshot(page.url))
        return;
    const now = Date.now();
    if (lastScreenshotCapture?.url === page.url &&
        now - lastScreenshotCapture.at < SCREENSHOT_MIN_INTERVAL_MS) {
        return;
    }
    lastScreenshotCapture = { at: now, url: page.url };
    setTimeout(() => {
        void getActivePage()
            .then(async (currentPage) => {
            if (!currentPage ||
                currentPage.eventId !== page.eventId ||
                currentPage.url !== page.url) {
                return;
            }
            const screenshotDataUrl = await chrome.tabs.captureVisibleTab(page.windowId, {
                format: "jpeg",
                quality: SCREENSHOT_QUALITY,
            });
            if (!screenshotDataUrl.startsWith("data:image/jpeg;base64,") ||
                screenshotDataUrl.length > SCREENSHOT_MAX_DATA_URL_LENGTH) {
                return;
            }
            await (0,_shared_event_buffer__WEBPACK_IMPORTED_MODULE_1__.queueMonitoringEvent)(toScreenshotEvent(currentPage, screenshotDataUrl));
            onQueueChanged?.();
        })
            .catch(() => null);
    }, SCREENSHOT_CAPTURE_DELAY_MS);
}
async function finishActivePage(now = Date.now()) {
    const activePage = await getActivePage();
    if (!activePage)
        return;
    const startedAt = new Date(activePage.startedAt).getTime();
    const durationMs = Number.isFinite(startedAt)
        ? Math.max(0, now - startedAt)
        : null;
    await (0,_shared_event_buffer__WEBPACK_IMPORTED_MODULE_1__.queueMonitoringEvent)(toVisitEvent(activePage, durationMs));
    await setActivePage(null);
}
async function captureTabVisit(tab, onQueueChanged, shouldCaptureScreenshot = true) {
    const session = await (0,_shared_auth_storage__WEBPACK_IMPORTED_MODULE_0__.getSession)();
    if (!session || !tab.id)
        return;
    if (!canTrackUrl(tab.url)) {
        await finishActivePage();
        return;
    }
    const activePage = await getActivePage();
    const title = normalizeTitle(tab.title);
    if (activePage?.tabId === tab.id && activePage.url === tab.url) {
        const nextPage = {
            ...activePage,
            title: title || activePage.title,
        };
        await setActivePage(nextPage);
        await (0,_shared_event_buffer__WEBPACK_IMPORTED_MODULE_1__.queueMonitoringEvent)(toVisitEvent(nextPage, null));
        if (shouldCaptureScreenshot) {
            await queuePageScreenshot(nextPage, onQueueChanged);
        }
        return;
    }
    await finishActivePage();
    const nextPage = {
        eventId: createEventId(),
        tabId: tab.id,
        windowId: tab.windowId,
        url: tab.url || "",
        title,
        startedAt: new Date().toISOString(),
        incognito: tab.incognito === true,
    };
    await setActivePage(nextPage);
    await (0,_shared_event_buffer__WEBPACK_IMPORTED_MODULE_1__.queueMonitoringEvent)(toVisitEvent(nextPage, null));
    if (shouldCaptureScreenshot) {
        await queuePageScreenshot(nextPage, onQueueChanged);
    }
}
async function captureCurrentActiveTab() {
    const tabs = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
    });
    const tab = tabs[0];
    if (tab)
        await captureTabVisit(tab);
}
function registerBrowserActivityTracking(onQueueChanged) {
    chrome.tabs.onActivated.addListener((activeInfo) => {
        void chrome.tabs
            .get(activeInfo.tabId)
            .then((tab) => captureTabVisit(tab, onQueueChanged))
            .then(onQueueChanged)
            .catch(() => null);
    });
    chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
        if (!tab.active || (!changeInfo.url && changeInfo.status !== "complete")) {
            return;
        }
        void captureTabVisit(tab, onQueueChanged, changeInfo.status === "complete")
            .then(onQueueChanged)
            .catch(() => null);
    });
    chrome.windows.onFocusChanged.addListener((windowId) => {
        if (windowId === chrome.windows.WINDOW_ID_NONE) {
            void finishActivePage()
                .then(onQueueChanged)
                .catch(() => null);
            return;
        }
        void chrome.tabs
            .query({ active: true, windowId })
            .then((tabs) => tabs[0])
            .then((tab) => {
            if (tab)
                return captureTabVisit(tab, onQueueChanged);
            return finishActivePage();
        })
            .then(onQueueChanged)
            .catch(() => null);
    });
}


/***/ },

/***/ "./src/shared/api-client.ts"
/*!**********************************!*\
  !*** ./src/shared/api-client.ts ***!
  \**********************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   isRevokedRequestError: () => (/* binding */ isRevokedRequestError),
/* harmony export */   pairDevice: () => (/* binding */ pairDevice),
/* harmony export */   sendHeartbeat: () => (/* binding */ sendHeartbeat),
/* harmony export */   syncMonitoringEvents: () => (/* binding */ syncMonitoringEvents)
/* harmony export */ });
/* harmony import */ var _config__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./config */ "./src/shared/config.ts");

const REQUEST_TIMEOUT_MS = 10000;
class ApiRequestError extends Error {
    revoked;
    status;
    constructor(message, status, revoked) {
        super(message);
        this.name = "ApiRequestError";
        this.revoked = revoked;
        this.status = status;
    }
}
function isRevokedRequestError(error) {
    return error instanceof ApiRequestError && error.revoked;
}
async function requestJson(endpoint, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const headers = new Headers(options.headers);
    if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }
    try {
        const response = await fetch(`${_config__WEBPACK_IMPORTED_MODULE_0__.API_BASE_URL}${endpoint}`, {
            ...options,
            headers,
            signal: controller.signal,
        });
        const data = (await response.json().catch(() => ({})));
        if (!response.ok) {
            throw new ApiRequestError(data.error || "Požadavek selhal.", response.status, data.revoked === true);
        }
        return data;
    }
    catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
            throw new Error("Požadavek vypršel. Zkontroluj připojení k web API.");
        }
        if (error instanceof TypeError) {
            throw new Error("Web API není dostupné. Zkontroluj EXTENSION_API_BASE_URL a znovu načti extension.");
        }
        if (error instanceof Error) {
            throw error;
        }
        throw new Error("Požadavek selhal.");
    }
    finally {
        clearTimeout(timeout);
    }
}
async function pairDevice(code) {
    return requestJson("/monitoring/extension/pair", {
        method: "POST",
        body: JSON.stringify({
            code,
            extensionVersion: _config__WEBPACK_IMPORTED_MODULE_0__.EXTENSION_VERSION,
        }),
    });
}
async function sendHeartbeat(deviceToken, input) {
    return requestJson("/monitoring/extension/heartbeat", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${deviceToken}`,
        },
        body: JSON.stringify({
            extensionVersion: _config__WEBPACK_IMPORTED_MODULE_0__.EXTENSION_VERSION,
            syncStatus: input?.syncStatus || "connected",
            pendingItems: input?.pendingItems || 0,
            lastError: input?.lastError || null,
        }),
    });
}
async function syncMonitoringEvents(deviceToken, events) {
    return requestJson("/monitoring/extension/sync", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${deviceToken}`,
        },
        body: JSON.stringify({
            extensionVersion: _config__WEBPACK_IMPORTED_MODULE_0__.EXTENSION_VERSION,
            events,
        }),
    });
}


/***/ },

/***/ "./src/shared/auth-storage.ts"
/*!************************************!*\
  !*** ./src/shared/auth-storage.ts ***!
  \************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   clearSession: () => (/* binding */ clearSession),
/* harmony export */   getSession: () => (/* binding */ getSession),
/* harmony export */   saveSession: () => (/* binding */ saveSession),
/* harmony export */   updateSession: () => (/* binding */ updateSession)
/* harmony export */ });
const SESSION_KEY = "mmm_monitoring_session";
async function getSession() {
    const result = await chrome.storage.local.get(SESSION_KEY);
    return result[SESSION_KEY] || null;
}
async function saveSession(session) {
    await chrome.storage.local.set({ [SESSION_KEY]: session });
}
async function clearSession() {
    await chrome.storage.local.remove(SESSION_KEY);
}
async function updateSession(updater) {
    const session = await getSession();
    if (!session)
        return null;
    const nextSession = updater(session);
    await saveSession(nextSession);
    return nextSession;
}


/***/ },

/***/ "./src/shared/config.ts"
/*!******************************!*\
  !*** ./src/shared/config.ts ***!
  \******************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   API_BASE_URL: () => (/* binding */ API_BASE_URL),
/* harmony export */   EXTENSION_VERSION: () => (/* binding */ EXTENSION_VERSION),
/* harmony export */   HEARTBEAT_ALARM_NAME: () => (/* binding */ HEARTBEAT_ALARM_NAME)
/* harmony export */ });
const API_BASE_URL = "https://maietek.maiweb.zip/api".replace(/\/+$/, "");
const EXTENSION_VERSION = "1.0.0";
const HEARTBEAT_ALARM_NAME = "mmm-heartbeat";


/***/ },

/***/ "./src/shared/event-buffer.ts"
/*!************************************!*\
  !*** ./src/shared/event-buffer.ts ***!
  \************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   clearMonitoringEventBuffer: () => (/* binding */ clearMonitoringEventBuffer),
/* harmony export */   getLastCapture: () => (/* binding */ getLastCapture),
/* harmony export */   getQueuedEventBatch: () => (/* binding */ getQueuedEventBatch),
/* harmony export */   getQueuedEvents: () => (/* binding */ getQueuedEvents),
/* harmony export */   queueMonitoringEvent: () => (/* binding */ queueMonitoringEvent),
/* harmony export */   removeQueuedEvents: () => (/* binding */ removeQueuedEvents),
/* harmony export */   saveLastCapture: () => (/* binding */ saveLastCapture)
/* harmony export */ });
/* harmony import */ var _auth_storage__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./auth-storage */ "./src/shared/auth-storage.ts");

const EVENT_BUFFER_KEY = "mmm_monitoring_event_buffer";
const LAST_CAPTURE_KEY = "mmm_monitoring_last_capture";
const MAX_BUFFER_EVENTS = 1000;
const MAX_BUFFER_BYTES = 8_000_000;
const MAX_SYNC_EVENTS = 100;
const MAX_SYNC_BYTES = 2_500_000;
async function getQueuedEvents() {
    const result = await chrome.storage.local.get(EVENT_BUFFER_KEY);
    return result[EVENT_BUFFER_KEY] || [];
}
async function getQueuedEventBatch() {
    const events = await getQueuedEvents();
    const batch = [];
    let bytes = 2;
    for (const event of events) {
        if (batch.length >= MAX_SYNC_EVENTS)
            break;
        const eventBytes = getEventByteSize(event);
        if (batch.length > 0 && bytes + eventBytes > MAX_SYNC_BYTES)
            break;
        batch.push(event);
        bytes += eventBytes;
    }
    return batch;
}
async function getLastCapture() {
    const result = await chrome.storage.local.get(LAST_CAPTURE_KEY);
    return result[LAST_CAPTURE_KEY] || null;
}
async function saveLastCapture(capture) {
    await chrome.storage.local.set({ [LAST_CAPTURE_KEY]: capture });
}
async function clearMonitoringEventBuffer() {
    await chrome.storage.local.remove([EVENT_BUFFER_KEY, LAST_CAPTURE_KEY]);
}
async function queueMonitoringEvent(event) {
    const events = await getQueuedEvents();
    const nextEvents = trimEventBuffer([
        ...events.filter((queuedEvent) => queuedEvent.eventId !== event.eventId),
        event,
    ]);
    await chrome.storage.local.set({ [EVENT_BUFFER_KEY]: nextEvents });
    await saveLastCapture({
        at: new Date().toISOString(),
        label: getEventLabel(event),
        status: "queued",
    });
    await (0,_auth_storage__WEBPACK_IMPORTED_MODULE_0__.updateSession)((session) => ({
        ...session,
        pendingItems: nextEvents.length,
        syncStatus: nextEvents.length > 0 ? "pending" : session.syncStatus,
    }));
}
function isSameEvent(firstEvent, secondEvent) {
    return JSON.stringify(firstEvent) === JSON.stringify(secondEvent);
}
async function removeQueuedEvents(syncedEvents) {
    const syncedEventsById = new Map(syncedEvents.map((event) => [event.eventId, event]));
    const events = await getQueuedEvents();
    const nextEvents = events.filter((event) => {
        const syncedEvent = syncedEventsById.get(event.eventId);
        return !syncedEvent || !isSameEvent(event, syncedEvent);
    });
    await chrome.storage.local.set({ [EVENT_BUFFER_KEY]: nextEvents });
    if (syncedEvents.length > 0) {
        await saveLastCapture({
            at: new Date().toISOString(),
            label: getEventLabel(syncedEvents[0]),
            status: "synced",
        });
    }
    await (0,_auth_storage__WEBPACK_IMPORTED_MODULE_0__.updateSession)((session) => ({
        ...session,
        pendingItems: nextEvents.length,
        syncStatus: nextEvents.length > 0 ? "pending" : "connected",
    }));
    return nextEvents.length;
}
function getEventByteSize(event) {
    return JSON.stringify(event).length;
}
function getEventsByteSize(events) {
    return events.reduce((size, event) => size + getEventByteSize(event), 2);
}
function trimEventBuffer(events) {
    const nextEvents = events.slice(-MAX_BUFFER_EVENTS);
    while (nextEvents.length > 1 &&
        getEventsByteSize(nextEvents) > MAX_BUFFER_BYTES) {
        nextEvents.shift();
    }
    return nextEvents;
}
function getEventLabel(event) {
    if (event.type === "element_click") {
        return event.elementText || event.elementHtml.slice(0, 80);
    }
    if (event.type === "form_activity") {
        return event.elementLabel || event.elementName || event.elementHtml.slice(0, 80);
    }
    if (event.type === "page_screenshot") {
        return event.title || event.url;
    }
    return event.title || event.url;
}


/***/ },

/***/ "./src/shared/sync-backoff.ts"
/*!************************************!*\
  !*** ./src/shared/sync-backoff.ts ***!
  \************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   canAttemptSync: () => (/* binding */ canAttemptSync),
/* harmony export */   clearSyncBackoff: () => (/* binding */ clearSyncBackoff),
/* harmony export */   getSyncBackoffState: () => (/* binding */ getSyncBackoffState),
/* harmony export */   recordSyncFailure: () => (/* binding */ recordSyncFailure)
/* harmony export */ });
const SYNC_BACKOFF_KEY = "mmm_monitoring_sync_backoff";
const BASE_DELAY_MS = 15_000;
const MAX_DELAY_MS = 5 * 60_000;
async function getSyncBackoffState() {
    const result = await chrome.storage.local.get(SYNC_BACKOFF_KEY);
    return result[SYNC_BACKOFF_KEY] || null;
}
async function clearSyncBackoff() {
    await chrome.storage.local.remove(SYNC_BACKOFF_KEY);
}
async function canAttemptSync() {
    const state = await getSyncBackoffState();
    if (!state)
        return true;
    const nextRetryAt = new Date(state.nextRetryAt).getTime();
    if (!Number.isFinite(nextRetryAt))
        return true;
    return Date.now() >= nextRetryAt;
}
async function recordSyncFailure() {
    const current = await getSyncBackoffState();
    const failureCount = Math.min((current?.failureCount || 0) + 1, 10);
    const delay = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** Math.max(0, failureCount - 1));
    await chrome.storage.local.set({
        [SYNC_BACKOFF_KEY]: {
            failureCount,
            nextRetryAt: new Date(Date.now() + delay).toISOString(),
        },
    });
}


/***/ }

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		if (!(moduleId in __webpack_modules__)) {
/******/ 			delete __webpack_module_cache__[moduleId];
/******/ 			var e = new Error("Cannot find module '" + moduleId + "'");
/******/ 			e.code = 'MODULE_NOT_FOUND';
/******/ 			throw e;
/******/ 		}
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
/*!******************************************!*\
  !*** ./src/background/service-worker.ts ***!
  \******************************************/
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   runHeartbeat: () => (/* binding */ runHeartbeat)
/* harmony export */ });
/* harmony import */ var _shared_auth_storage__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../shared/auth-storage */ "./src/shared/auth-storage.ts");
/* harmony import */ var _shared_config__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../shared/config */ "./src/shared/config.ts");
/* harmony import */ var _shared_api_client__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../shared/api-client */ "./src/shared/api-client.ts");
/* harmony import */ var _shared_event_buffer__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../shared/event-buffer */ "./src/shared/event-buffer.ts");
/* harmony import */ var _shared_sync_backoff__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../shared/sync-backoff */ "./src/shared/sync-backoff.ts");
/* harmony import */ var _browser_activity__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./browser-activity */ "./src/background/browser-activity.ts");






let syncQueuedEventsInFlight = null;
async function scheduleHeartbeat(intervalSeconds) {
    await chrome.alarms.create(_shared_config__WEBPACK_IMPORTED_MODULE_1__.HEARTBEAT_ALARM_NAME, {
        periodInMinutes: Math.max(1, intervalSeconds / 60),
    });
}
async function clearHeartbeat() {
    await chrome.alarms.clear(_shared_config__WEBPACK_IMPORTED_MODULE_1__.HEARTBEAT_ALARM_NAME);
}
async function clearRevokedSession() {
    await (0,_shared_auth_storage__WEBPACK_IMPORTED_MODULE_0__.clearSession)();
    await (0,_shared_event_buffer__WEBPACK_IMPORTED_MODULE_3__.clearMonitoringEventBuffer)();
    await (0,_shared_sync_backoff__WEBPACK_IMPORTED_MODULE_4__.clearSyncBackoff)();
    await clearHeartbeat();
}
async function syncQueuedEventsOnce() {
    const session = await (0,_shared_auth_storage__WEBPACK_IMPORTED_MODULE_0__.getSession)();
    if (!session)
        return;
    const queuedEvents = await (0,_shared_event_buffer__WEBPACK_IMPORTED_MODULE_3__.getQueuedEvents)();
    if (queuedEvents.length === 0)
        return;
    if (!(await (0,_shared_sync_backoff__WEBPACK_IMPORTED_MODULE_4__.canAttemptSync)())) {
        await (0,_shared_auth_storage__WEBPACK_IMPORTED_MODULE_0__.updateSession)((current) => ({
            ...current,
            pendingItems: queuedEvents.length,
            syncStatus: "pending",
        }));
        return;
    }
    const events = await (0,_shared_event_buffer__WEBPACK_IMPORTED_MODULE_3__.getQueuedEventBatch)();
    if (events.length === 0)
        return;
    try {
        const response = await (0,_shared_api_client__WEBPACK_IMPORTED_MODULE_2__.syncMonitoringEvents)(session.deviceToken, events);
        if (response.revoked || !response.success) {
            await clearRevokedSession();
            return;
        }
        const pendingItems = await (0,_shared_event_buffer__WEBPACK_IMPORTED_MODULE_3__.removeQueuedEvents)(events);
        await (0,_shared_sync_backoff__WEBPACK_IMPORTED_MODULE_4__.clearSyncBackoff)();
        await (0,_shared_auth_storage__WEBPACK_IMPORTED_MODULE_0__.updateSession)((current) => ({
            ...current,
            deviceName: response.deviceName || current.deviceName,
            heartbeatIntervalSeconds: response.heartbeatIntervalSeconds || current.heartbeatIntervalSeconds,
            lastHeartbeatAt: new Date().toISOString(),
            pendingItems,
            syncStatus: pendingItems > 0 ? "pending" : "connected",
        }));
    }
    catch (error) {
        if ((0,_shared_api_client__WEBPACK_IMPORTED_MODULE_2__.isRevokedRequestError)(error)) {
            await clearRevokedSession();
            return;
        }
        await (0,_shared_sync_backoff__WEBPACK_IMPORTED_MODULE_4__.recordSyncFailure)();
        await (0,_shared_event_buffer__WEBPACK_IMPORTED_MODULE_3__.saveLastCapture)({
            at: new Date().toISOString(),
            label: getEventLabel(events[0]),
            status: "sync-error",
        });
        await (0,_shared_auth_storage__WEBPACK_IMPORTED_MODULE_0__.updateSession)((current) => ({
            ...current,
            pendingItems: queuedEvents.length,
            syncStatus: "error",
        }));
    }
}
async function syncQueuedEvents() {
    if (syncQueuedEventsInFlight)
        return syncQueuedEventsInFlight;
    syncQueuedEventsInFlight = syncQueuedEventsOnce().finally(() => {
        syncQueuedEventsInFlight = null;
    });
    return syncQueuedEventsInFlight;
}
async function runHeartbeat() {
    const session = await (0,_shared_auth_storage__WEBPACK_IMPORTED_MODULE_0__.getSession)();
    if (!session) {
        await clearHeartbeat();
        return;
    }
    try {
        await syncQueuedEvents();
        const nextSession = await (0,_shared_auth_storage__WEBPACK_IMPORTED_MODULE_0__.getSession)();
        if (!nextSession)
            return;
        const response = await (0,_shared_api_client__WEBPACK_IMPORTED_MODULE_2__.sendHeartbeat)(session.deviceToken, {
            syncStatus: nextSession.syncStatus,
            pendingItems: nextSession.pendingItems,
        });
        if (response.revoked || !response.success) {
            await clearRevokedSession();
            return;
        }
        const queuedEvents = await (0,_shared_event_buffer__WEBPACK_IMPORTED_MODULE_3__.getQueuedEvents)();
        const pendingItems = queuedEvents.length;
        await (0,_shared_auth_storage__WEBPACK_IMPORTED_MODULE_0__.updateSession)((current) => ({
            ...current,
            deviceName: response.deviceName || current.deviceName,
            heartbeatIntervalSeconds: response.heartbeatIntervalSeconds || current.heartbeatIntervalSeconds,
            lastHeartbeatAt: new Date().toISOString(),
            syncStatus: pendingItems > 0 ? "pending" : "connected",
            pendingItems,
        }));
        await scheduleHeartbeat(response.heartbeatIntervalSeconds || session.heartbeatIntervalSeconds);
    }
    catch (error) {
        if ((0,_shared_api_client__WEBPACK_IMPORTED_MODULE_2__.isRevokedRequestError)(error)) {
            await clearRevokedSession();
            return;
        }
        await (0,_shared_auth_storage__WEBPACK_IMPORTED_MODULE_0__.updateSession)((current) => ({
            ...current,
            syncStatus: "error",
            lastHeartbeatAt: current.lastHeartbeatAt,
        }));
    }
}
(0,_browser_activity__WEBPACK_IMPORTED_MODULE_5__.registerBrowserActivityTracking)(() => {
    void syncQueuedEvents();
});
chrome.runtime.onInstalled.addListener(() => {
    void (0,_shared_auth_storage__WEBPACK_IMPORTED_MODULE_0__.getSession)().then((session) => {
        if (session)
            void scheduleHeartbeat(session.heartbeatIntervalSeconds);
    });
});
chrome.runtime.onStartup.addListener(() => {
    void (0,_shared_auth_storage__WEBPACK_IMPORTED_MODULE_0__.getSession)().then((session) => {
        if (session)
            void scheduleHeartbeat(session.heartbeatIntervalSeconds);
    });
});
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === _shared_config__WEBPACK_IMPORTED_MODULE_1__.HEARTBEAT_ALARM_NAME) {
        void runHeartbeat();
    }
});
function getEventLabel(event) {
    if (event.type === "element_click") {
        return event.elementText || event.elementHtml.slice(0, 80);
    }
    if (event.type === "form_activity") {
        return event.elementLabel || event.elementName || event.elementHtml.slice(0, 80);
    }
    if (event.type === "page_screenshot") {
        return event.title || event.url;
    }
    return event.title || event.url;
}
function queueContentEvent(event) {
    return (0,_shared_auth_storage__WEBPACK_IMPORTED_MODULE_0__.getSession)()
        .then((session) => {
        if (!session || !event)
            return null;
        return (0,_shared_event_buffer__WEBPACK_IMPORTED_MODULE_3__.queueMonitoringEvent)(event);
    })
        .then(() => syncQueuedEvents());
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "mmm:element-click") {
        const event = message.event;
        if (event?.type !== "element_click") {
            sendResponse({ success: false, error: "Neplatný monitoring event." });
            return false;
        }
        void (0,_shared_auth_storage__WEBPACK_IMPORTED_MODULE_0__.getSession)()
            .then((session) => {
            if (!session)
                return null;
            return (0,_shared_event_buffer__WEBPACK_IMPORTED_MODULE_3__.queueMonitoringEvent)({
                ...event,
                incognito: sender.tab?.incognito === true,
            });
        })
            .then(() => syncQueuedEvents())
            .then(() => sendResponse({ success: true }))
            .catch((error) => sendResponse({
            success: false,
            error: error instanceof Error
                ? error.message
                : "Kliknutí se nepodařilo uložit.",
        }));
        return true;
    }
    if (message?.type === "mmm:form-activity") {
        const event = message.event;
        if (event?.type !== "form_activity") {
            sendResponse({ success: false, error: "Neplatný monitoring event." });
            return false;
        }
        void queueContentEvent({
            ...event,
            incognito: sender.tab?.incognito === true,
        })
            .then(() => sendResponse({ success: true }))
            .catch((error) => sendResponse({
            success: false,
            error: error instanceof Error
                ? error.message
                : "Formulářovou aktivitu se nepodařilo uložit.",
        }));
        return true;
    }
    if (message?.type !== "mmm:heartbeat")
        return false;
    void runHeartbeat()
        .then(async () => {
        await (0,_browser_activity__WEBPACK_IMPORTED_MODULE_5__.captureCurrentActiveTab)().catch(() => null);
        sendResponse({ success: true });
    })
        .catch((error) => sendResponse({
        success: false,
        error: error instanceof Error ? error.message : "Heartbeat selhal.",
    }));
    return true;
});

})();

/******/ })()
;