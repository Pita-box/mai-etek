import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  canAttemptSync,
  clearSyncBackoff,
  getSyncBackoffState,
  recordSyncFailure,
} from "./sync-backoff";
import { installChromeStorageMock } from "../../test/chrome-storage";

describe("sync backoff", () => {
  beforeEach(() => {
    installChromeStorageMock();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-04T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows sync when no backoff is stored", async () => {
    expect(await canAttemptSync()).toBe(true);
  });

  it("records exponential retry delay and clears it", async () => {
    await recordSyncFailure();

    expect(await getSyncBackoffState()).toEqual({
      failureCount: 1,
      nextRetryAt: "2026-05-04T12:00:15.000Z",
    });
    expect(await canAttemptSync()).toBe(false);

    vi.setSystemTime(new Date("2026-05-04T12:00:15.000Z"));
    expect(await canAttemptSync()).toBe(true);

    await clearSyncBackoff();
    expect(await getSyncBackoffState()).toBeNull();
  });
});
