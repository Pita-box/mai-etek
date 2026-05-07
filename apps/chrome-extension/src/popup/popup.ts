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
import {
  extendPopupUnlockWindow,
  isPopupUnlocked,
  lockPopup,
  unlockPopup,
} from "../shared/popup-lock"
import type { MonitoringSession } from "../shared/types"

const statusPill = document.querySelector<HTMLSpanElement>("#statusPill")!
const lockView = document.querySelector<HTMLElement>("#lockView")!
const lockPasswordInput = document.querySelector<HTMLInputElement>("#lockPassword")!
const unlockButton = document.querySelector<HTMLButtonElement>("#unlockButton")!
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
const REFRESH_INTERVAL_MS = 5_000
const LOCK_REFRESH_INTERVAL_MS = 10_000

const dateFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

let isUnlocked = false
let refreshTimerId: number | null = null
let lockRefreshTimerId: number | null = null

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
  unlockButton.disabled = isBusy
  pairButton.disabled = isBusy
  heartbeatButton.disabled = isBusy
}

async function clearRevokedSession() {
  await clearSession()
  await clearMonitoringEventBuffer()
}

function clearTimers() {
  if (refreshTimerId !== null) {
    window.clearInterval(refreshTimerId)
    refreshTimerId = null
  }

  if (lockRefreshTimerId !== null) {
    window.clearInterval(lockRefreshTimerId)
    lockRefreshTimerId = null
  }
}

function renderLocked() {
  statusPill.textContent = "Zamčeno"
  statusPill.classList.remove("active")
  statusPill.classList.add("locked")
  lockView.classList.remove("hidden")
  pairingView.classList.add("hidden")
  connectedView.classList.add("hidden")
  clearTimers()
  isUnlocked = false
}

function renderUnlocked() {
  statusPill.classList.remove("locked")
  lockView.classList.add("hidden")
  startUnlockedTimers()
}

function startUnlockedTimers() {
  clearTimers()

  refreshTimerId = window.setInterval(() => {
    void refresh()
  }, REFRESH_INTERVAL_MS)

  lockRefreshTimerId = window.setInterval(() => {
    void extendPopupUnlockWindow().catch(() => null)
  }, LOCK_REFRESH_INTERVAL_MS)
}

async function renderPaired(session: MonitoringSession) {
  const [capture, queuedEvents] = await Promise.all([
    getLastCapture(),
    getQueuedEvents(),
  ])

  statusPill.textContent = "Aktivní"
  statusPill.classList.add("active")
  statusPill.classList.remove("locked")
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
  statusPill.classList.remove("locked")
  connectedView.classList.add("hidden")
  pairingView.classList.remove("hidden")
}

async function refresh() {
  if (!isUnlocked) return

  await extendPopupUnlockWindow().catch(() => null)

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

async function unlock() {
  const password = lockPasswordInput.value.trim()
  if (!password) {
    setMessage("Zadej heslo.", true)
    return
  }

  setBusy(true)
  setMessage("Odemykám extension...")

  try {
    const unlocked = await unlockPopup(password)
    if (!unlocked) {
      setMessage("Nesprávné heslo.", true)
      return
    }

    isUnlocked = true
    lockPasswordInput.value = ""
    setMessage("Extension je odemknutá.")
    renderUnlocked()
    await refresh()
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "Odemknutí selhalo.", true)
  } finally {
    setBusy(false)
  }
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

async function initialize() {
  isUnlocked = await isPopupUnlocked()

  if (!isUnlocked) {
    renderLocked()
    return
  }

  renderUnlocked()
  await refresh()
}

unlockButton.addEventListener("click", () => void unlock())
pairButton.addEventListener("click", () => void pair())
heartbeatButton.addEventListener("click", () => void heartbeat())
pairingCodeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault()
    void pair()
  }
})

lockPasswordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault()
    void unlock()
  }
})

window.addEventListener("beforeunload", () => {
  if (isUnlocked) {
    void lockPopup().catch(() => null)
  }
})

window.addEventListener("pagehide", () => {
  if (isUnlocked) {
    void lockPopup().catch(() => null)
  }
})

void initialize()
