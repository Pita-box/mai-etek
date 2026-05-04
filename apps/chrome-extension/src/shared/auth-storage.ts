import type { MonitoringSession } from "./types"

const SESSION_KEY = "mmm_monitoring_session"

export async function getSession() {
  const result = await chrome.storage.local.get(SESSION_KEY)
  return (result[SESSION_KEY] as MonitoringSession | undefined) || null
}

export async function saveSession(session: MonitoringSession) {
  await chrome.storage.local.set({ [SESSION_KEY]: session })
}

export async function clearSession() {
  await chrome.storage.local.remove(SESSION_KEY)
}

export async function updateSession(
  updater: (session: MonitoringSession) => MonitoringSession,
) {
  const session = await getSession()
  if (!session) return null
  const nextSession = updater(session)
  await saveSession(nextSession)
  return nextSession
}
