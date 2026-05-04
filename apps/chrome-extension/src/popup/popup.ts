import {
  isRevokedRequestError,
  pairDevice,
  sendHeartbeat,
} from "../shared/api-client"
import { clearSession, getSession, saveSession } from "../shared/auth-storage"
import {
  clearMonitoringEventBuffer,
  getLastCapture,
  getQueuedEvents,
} from "../shared/event-buffer"
import type { MonitoringSession } from "../shared/types"

const statusPill = document.querySelector<HTMLSpanElement>("#statusPill")!
const pairingView = document.querySelector<HTMLElement>("#pairingView")!
const connectedView = document.querySelector<HTMLElement>("#connectedView")!
const pairingCodeInput = document.querySelector<HTMLInputElement>("#pairingCode")!
const pairButton = document.querySelector<HTMLButtonElement>("#pairButton")!
const heartbeatButton =
  document.querySelector<HTMLButtonElement>("#heartbeatButton")!
const deviceName = document.querySelector<HTMLElement>("#deviceName")!
const lastCapture = document.querySelector<HTMLElement>("#lastCapture")!
const lastHeartbeat = document.querySelector<HTMLElement>("#lastHeartbeat")!
const syncStatus = document.querySelector<HTMLElement>("#syncStatus")!
const message = document.querySelector<HTMLElement>("#message")!

const dateFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

function setMessage(value: string, isError = false) {
  message.textContent = value
  message.classList.toggle("error", isError)
}

function formatDateTime(value: string | null) {
  if (!value) return "Zatím nikdy"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Neznámé"
  return dateFormatter.format(date)
}

function setBusy(isBusy: boolean) {
  pairButton.disabled = isBusy
  heartbeatButton.disabled = isBusy
}

async function clearRevokedSession() {
  await clearSession()
  await clearMonitoringEventBuffer()
}

async function renderPaired(session: MonitoringSession) {
  const [capture, queuedEvents] = await Promise.all([
    getLastCapture(),
    getQueuedEvents(),
  ])

  statusPill.textContent = "Aktivní"
  statusPill.classList.add("active")
  pairingView.classList.add("hidden")
  connectedView.classList.remove("hidden")
  deviceName.textContent = session.deviceName
  lastHeartbeat.textContent = formatDateTime(session.lastHeartbeatAt)
  syncStatus.textContent =
    queuedEvents.length > 0
      ? `Data čekají na odesílání (${queuedEvents.length})`
      : "Připojeno"
  lastCapture.textContent = capture
    ? `${capture.status}: ${capture.label}`
    : "Zatím nic"
}

function renderPairing() {
  statusPill.textContent = "Nespárováno"
  statusPill.classList.remove("active")
  connectedView.classList.add("hidden")
  pairingView.classList.remove("hidden")
}

async function refresh() {
  const session = await getSession()
  if (session) {
    await chrome.runtime.sendMessage({ type: "mmm:heartbeat" }).catch(() => null)
    const latestSession = await getSession()
    if (!latestSession) {
      renderPairing()
      setMessage("Extension byla zneplatněna. Je potřeba nové párování.", true)
      return
    }

    await renderPaired(latestSession)
    return
  }
  renderPairing()
}

async function pair() {
  const code = pairingCodeInput.value.trim()
  if (!code) {
    setMessage("Zadej párovací kód.", true)
    return
  }

  setBusy(true)
  setMessage("Páruji extension...")

  try {
    const response = await pairDevice(code)
    if (!response.success || !response.deviceToken || !response.deviceId) {
      throw new Error(response.error || "Párování se nepodařilo.")
    }

    const session: MonitoringSession = {
      deviceToken: response.deviceToken,
      deviceId: response.deviceId,
      deviceName: response.deviceName || "Zařízení 1",
      heartbeatIntervalSeconds: response.heartbeatIntervalSeconds || 300,
      pairedAt: new Date().toISOString(),
      lastHeartbeatAt: new Date().toISOString(),
      syncStatus: "connected",
      pendingItems: 0,
    }

    await saveSession(session)
    await chrome.runtime.sendMessage({ type: "mmm:heartbeat" }).catch(() => null)
    setMessage("Extension je spárovaná.")
    await renderPaired(session)
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "Párování selhalo.", true)
  } finally {
    setBusy(false)
  }
}

async function heartbeat() {
  const session = await getSession()
  if (!session) {
    renderPairing()
    return
  }

  setBusy(true)
  setMessage("Odesílám heartbeat...")

  try {
    const response = await sendHeartbeat(session.deviceToken, {
      syncStatus: session.syncStatus,
      pendingItems: session.pendingItems,
    })

    if (response.revoked || !response.success) {
      await clearRevokedSession()
      renderPairing()
      setMessage("Extension byla zneplatněna. Je potřeba nové párování.", true)
      return
    }

    const nextSession: MonitoringSession = {
      ...session,
      deviceName: response.deviceName || session.deviceName,
      heartbeatIntervalSeconds:
        response.heartbeatIntervalSeconds || session.heartbeatIntervalSeconds,
      lastHeartbeatAt: new Date().toISOString(),
      syncStatus: "connected",
      pendingItems: 0,
    }
    await saveSession(nextSession)
    await renderPaired(nextSession)
    setMessage("Heartbeat odeslán.")
  } catch (error) {
    if (isRevokedRequestError(error)) {
      await clearRevokedSession()
      renderPairing()
      setMessage("Extension byla zneplatněna. Je potřeba nové párování.", true)
      return
    }

    setMessage(
      error instanceof Error ? error.message : "Heartbeat se nepodařilo odeslat.",
      true,
    )
  } finally {
    setBusy(false)
  }
}

pairButton.addEventListener("click", () => void pair())
heartbeatButton.addEventListener("click", () => void heartbeat())
pairingCodeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault()
    void pair()
  }
})

void refresh()
window.setInterval(() => void refresh(), 5000)
