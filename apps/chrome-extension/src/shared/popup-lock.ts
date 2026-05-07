const POPUP_LOCK_KEY = "mmm_popup_lock_state"
const POPUP_UNLOCK_DURATION_MS = 60_000
export const DEFAULT_POPUP_PASSWORD = "1Conduongdai"

type PopupLockState = {
  unlockedUntil: number | null
}

function toState(value: unknown): PopupLockState | null {
  if (!value || typeof value !== "object") return null

  const unlockedUntil = (value as { unlockedUntil?: unknown }).unlockedUntil
  if (unlockedUntil !== null && typeof unlockedUntil !== "number") return null

  return {
    unlockedUntil: unlockedUntil ?? null,
  }
}

async function getPopupLockState() {
  const result = await chrome.storage.local.get(POPUP_LOCK_KEY)
  return toState(result[POPUP_LOCK_KEY])
}

async function savePopupLockState(state: PopupLockState) {
  await chrome.storage.local.set({ [POPUP_LOCK_KEY]: state })
}

export async function isPopupUnlocked() {
  const state = await getPopupLockState()
  return Boolean(state?.unlockedUntil && state.unlockedUntil > Date.now())
}

export async function unlockPopup(password: string) {
  if (password !== DEFAULT_POPUP_PASSWORD) return false

  await savePopupLockState({
    unlockedUntil: Date.now() + POPUP_UNLOCK_DURATION_MS,
  })

  return true
}

export async function extendPopupUnlockWindow() {
  const state = await getPopupLockState()
  if (!state?.unlockedUntil || state.unlockedUntil <= Date.now()) return false

  await savePopupLockState({
    unlockedUntil: Date.now() + POPUP_UNLOCK_DURATION_MS,
  })

  return true
}

export async function lockPopup() {
  await savePopupLockState({
    unlockedUntil: Date.now() + POPUP_UNLOCK_DURATION_MS,
  })
}
