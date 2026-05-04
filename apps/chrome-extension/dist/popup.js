/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

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
const API_BASE_URL = "http://localhost:3000/api".replace(/\/+$/, "");
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
/*!****************************!*\
  !*** ./src/popup/popup.ts ***!
  \****************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _shared_api_client__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../shared/api-client */ "./src/shared/api-client.ts");
/* harmony import */ var _shared_auth_storage__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../shared/auth-storage */ "./src/shared/auth-storage.ts");
/* harmony import */ var _shared_event_buffer__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../shared/event-buffer */ "./src/shared/event-buffer.ts");



const statusPill = document.querySelector("#statusPill");
const pairingView = document.querySelector("#pairingView");
const connectedView = document.querySelector("#connectedView");
const pairingCodeInput = document.querySelector("#pairingCode");
const pairButton = document.querySelector("#pairButton");
const heartbeatButton = document.querySelector("#heartbeatButton");
const deviceName = document.querySelector("#deviceName");
const lastCapture = document.querySelector("#lastCapture");
const lastHeartbeat = document.querySelector("#lastHeartbeat");
const syncStatus = document.querySelector("#syncStatus");
const message = document.querySelector("#message");
const dateFormatter = new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
});
function setMessage(value, isError = false) {
    message.textContent = value;
    message.classList.toggle("error", isError);
}
function formatDateTime(value) {
    if (!value)
        return "Zatím nikdy";
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return "Neznámé";
    return dateFormatter.format(date);
}
function setBusy(isBusy) {
    pairButton.disabled = isBusy;
    heartbeatButton.disabled = isBusy;
}
async function clearRevokedSession() {
    await (0,_shared_auth_storage__WEBPACK_IMPORTED_MODULE_1__.clearSession)();
    await (0,_shared_event_buffer__WEBPACK_IMPORTED_MODULE_2__.clearMonitoringEventBuffer)();
}
async function renderPaired(session) {
    const [capture, queuedEvents] = await Promise.all([
        (0,_shared_event_buffer__WEBPACK_IMPORTED_MODULE_2__.getLastCapture)(),
        (0,_shared_event_buffer__WEBPACK_IMPORTED_MODULE_2__.getQueuedEvents)(),
    ]);
    statusPill.textContent = "Aktivní";
    statusPill.classList.add("active");
    pairingView.classList.add("hidden");
    connectedView.classList.remove("hidden");
    deviceName.textContent = session.deviceName;
    lastHeartbeat.textContent = formatDateTime(session.lastHeartbeatAt);
    syncStatus.textContent =
        queuedEvents.length > 0
            ? `Data čekají na odesílání (${queuedEvents.length})`
            : "Připojeno";
    lastCapture.textContent = capture
        ? `${capture.status}: ${capture.label}`
        : "Zatím nic";
}
function renderPairing() {
    statusPill.textContent = "Nespárováno";
    statusPill.classList.remove("active");
    connectedView.classList.add("hidden");
    pairingView.classList.remove("hidden");
}
async function refresh() {
    const session = await (0,_shared_auth_storage__WEBPACK_IMPORTED_MODULE_1__.getSession)();
    if (session) {
        await chrome.runtime.sendMessage({ type: "mmm:heartbeat" }).catch(() => null);
        const latestSession = await (0,_shared_auth_storage__WEBPACK_IMPORTED_MODULE_1__.getSession)();
        if (!latestSession) {
            renderPairing();
            setMessage("Extension byla zneplatněna. Je potřeba nové párování.", true);
            return;
        }
        await renderPaired(latestSession);
        return;
    }
    renderPairing();
}
async function pair() {
    const code = pairingCodeInput.value.trim();
    if (!code) {
        setMessage("Zadej párovací kód.", true);
        return;
    }
    setBusy(true);
    setMessage("Páruji extension...");
    try {
        const response = await (0,_shared_api_client__WEBPACK_IMPORTED_MODULE_0__.pairDevice)(code);
        if (!response.success || !response.deviceToken || !response.deviceId) {
            throw new Error(response.error || "Párování se nepodařilo.");
        }
        const session = {
            deviceToken: response.deviceToken,
            deviceId: response.deviceId,
            deviceName: response.deviceName || "Zařízení 1",
            heartbeatIntervalSeconds: response.heartbeatIntervalSeconds || 300,
            pairedAt: new Date().toISOString(),
            lastHeartbeatAt: new Date().toISOString(),
            syncStatus: "connected",
            pendingItems: 0,
        };
        await (0,_shared_auth_storage__WEBPACK_IMPORTED_MODULE_1__.saveSession)(session);
        await chrome.runtime.sendMessage({ type: "mmm:heartbeat" }).catch(() => null);
        setMessage("Extension je spárovaná.");
        await renderPaired(session);
    }
    catch (error) {
        setMessage(error instanceof Error ? error.message : "Párování selhalo.", true);
    }
    finally {
        setBusy(false);
    }
}
async function heartbeat() {
    const session = await (0,_shared_auth_storage__WEBPACK_IMPORTED_MODULE_1__.getSession)();
    if (!session) {
        renderPairing();
        return;
    }
    setBusy(true);
    setMessage("Odesílám heartbeat...");
    try {
        const response = await (0,_shared_api_client__WEBPACK_IMPORTED_MODULE_0__.sendHeartbeat)(session.deviceToken, {
            syncStatus: session.syncStatus,
            pendingItems: session.pendingItems,
        });
        if (response.revoked || !response.success) {
            await clearRevokedSession();
            renderPairing();
            setMessage("Extension byla zneplatněna. Je potřeba nové párování.", true);
            return;
        }
        const nextSession = {
            ...session,
            deviceName: response.deviceName || session.deviceName,
            heartbeatIntervalSeconds: response.heartbeatIntervalSeconds || session.heartbeatIntervalSeconds,
            lastHeartbeatAt: new Date().toISOString(),
            syncStatus: "connected",
            pendingItems: 0,
        };
        await (0,_shared_auth_storage__WEBPACK_IMPORTED_MODULE_1__.saveSession)(nextSession);
        await renderPaired(nextSession);
        setMessage("Heartbeat odeslán.");
    }
    catch (error) {
        if ((0,_shared_api_client__WEBPACK_IMPORTED_MODULE_0__.isRevokedRequestError)(error)) {
            await clearRevokedSession();
            renderPairing();
            setMessage("Extension byla zneplatněna. Je potřeba nové párování.", true);
            return;
        }
        setMessage(error instanceof Error ? error.message : "Heartbeat se nepodařilo odeslat.", true);
    }
    finally {
        setBusy(false);
    }
}
pairButton.addEventListener("click", () => void pair());
heartbeatButton.addEventListener("click", () => void heartbeat());
pairingCodeInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        void pair();
    }
});
void refresh();
window.setInterval(() => void refresh(), 5000);

})();

/******/ })()
;