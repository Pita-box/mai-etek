/******/ (() => { // webpackBootstrap
/******/ 	"use strict";

;// ./src/shared/config.ts
const API_BASE_URL = "https://maietek.maiweb.zip/api".replace(/\/+$/, "");
const EXTENSION_VERSION = "1.0.0";
const HEARTBEAT_ALARM_NAME = "mmm-heartbeat";

;// ./src/shared/api-client.ts
/* unused harmony import specifier */ var api_client_EXTENSION_VERSION;

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
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
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
            extensionVersion: EXTENSION_VERSION,
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
            extensionVersion: EXTENSION_VERSION,
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
            extensionVersion: api_client_EXTENSION_VERSION,
            events,
        }),
    });
}

;// ./src/shared/auth-storage.ts
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

;// ./src/shared/event-buffer.ts
/* unused harmony import specifier */ var event_buffer_updateSession;

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
    await event_buffer_updateSession((session) => ({
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
    await event_buffer_updateSession((session) => ({
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

;// ./src/popup/popup.ts



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
    await clearSession();
    await clearMonitoringEventBuffer();
}
async function renderPaired(session) {
    const [capture, queuedEvents] = await Promise.all([
        getLastCapture(),
        getQueuedEvents(),
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
    const session = await getSession();
    if (session) {
        await chrome.runtime.sendMessage({ type: "mmm:heartbeat" }).catch(() => null);
        const latestSession = await getSession();
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
        const response = await pairDevice(code);
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
        await saveSession(session);
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
    const session = await getSession();
    if (!session) {
        renderPairing();
        return;
    }
    setBusy(true);
    setMessage("Odesílám heartbeat...");
    try {
        const response = await sendHeartbeat(session.deviceToken, {
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
        await saveSession(nextSession);
        await renderPaired(nextSession);
        setMessage("Heartbeat odeslán.");
    }
    catch (error) {
        if (isRevokedRequestError(error)) {
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

/******/ })()
;