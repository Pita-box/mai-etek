const SYNC_BACKOFF_KEY = "mmm_monitoring_sync_backoff"
const BASE_DELAY_MS = 15_000
const MAX_DELAY_MS = 5 * 60_000

type SyncBackoffState = {
  failureCount: number
  nextRetryAt: string
}

export async function getSyncBackoffState() {
  const result = await chrome.storage.local.get(SYNC_BACKOFF_KEY)
  return (result[SYNC_BACKOFF_KEY] as SyncBackoffState | undefined) || null
}

export async function clearSyncBackoff() {
  await chrome.storage.local.remove(SYNC_BACKOFF_KEY)
}

export async function canAttemptSync() {
  const state = await getSyncBackoffState()
  if (!state) return true

  const nextRetryAt = new Date(state.nextRetryAt).getTime()
  if (!Number.isFinite(nextRetryAt)) return true

  return Date.now() >= nextRetryAt
}

export async function recordSyncFailure() {
  const current = await getSyncBackoffState()
  const failureCount = Math.min((current?.failureCount || 0) + 1, 10)
  const delay = Math.min(
    MAX_DELAY_MS,
    BASE_DELAY_MS * 2 ** Math.max(0, failureCount - 1),
  )

  await chrome.storage.local.set({
    [SYNC_BACKOFF_KEY]: {
      failureCount,
      nextRetryAt: new Date(Date.now() + delay).toISOString(),
    } satisfies SyncBackoffState,
  })
}
