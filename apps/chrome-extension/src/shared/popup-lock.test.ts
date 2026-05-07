import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { installChromeStorageMock } from "../../test/chrome-storage"
import {
  DEFAULT_POPUP_PASSWORD,
  extendPopupUnlockWindow,
  isPopupUnlocked,
  lockPopup,
  unlockPopup,
} from "./popup-lock"

describe("popup lock", () => {
  beforeEach(() => {
    installChromeStorageMock()
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-05-04T12:00:00.000Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("rejects an invalid password", async () => {
    await expect(unlockPopup("wrong")).resolves.toBe(false)
    await expect(isPopupUnlocked()).resolves.toBe(false)
  })

  it("unlocks with the default password for one minute", async () => {
    await expect(unlockPopup(DEFAULT_POPUP_PASSWORD)).resolves.toBe(true)
    await expect(isPopupUnlocked()).resolves.toBe(true)

    vi.setSystemTime(new Date("2026-05-04T12:00:59.000Z"))
    await expect(isPopupUnlocked()).resolves.toBe(true)

    vi.setSystemTime(new Date("2026-05-04T12:01:01.000Z"))
    await expect(isPopupUnlocked()).resolves.toBe(false)
  })

  it("extends the unlock window while the popup is open", async () => {
    await unlockPopup(DEFAULT_POPUP_PASSWORD)

    vi.setSystemTime(new Date("2026-05-04T12:00:50.000Z"))
    await expect(extendPopupUnlockWindow()).resolves.toBe(true)

    vi.setSystemTime(new Date("2026-05-04T12:01:40.000Z"))
    await expect(isPopupUnlocked()).resolves.toBe(true)
  })

  it("locks again after closing the popup", async () => {
    await unlockPopup(DEFAULT_POPUP_PASSWORD)

    await lockPopup()

    vi.setSystemTime(new Date("2026-05-04T12:00:30.000Z"))
    await expect(isPopupUnlocked()).resolves.toBe(true)

    vi.setSystemTime(new Date("2026-05-04T12:01:01.000Z"))
    await expect(isPopupUnlocked()).resolves.toBe(false)
  })
})
