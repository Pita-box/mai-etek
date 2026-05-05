import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveSession } from "./auth-storage";
import {
  getQueuedEventBatch,
  getQueuedEvents,
  queueMonitoringEvent,
  removeQueuedEvents,
} from "./event-buffer";
import { installChromeStorageMock } from "../../test/chrome-storage";
import type { MonitoringEvent, MonitoringSession } from "./types";

function createSession(): MonitoringSession {
  return {
    deviceId: "device-1",
    deviceName: "MacBook",
    deviceToken: "device-token",
    heartbeatIntervalSeconds: 30,
    lastHeartbeatAt: null,
    pairedAt: "2026-05-04T12:00:00.000Z",
    pendingItems: 0,
    syncStatus: "connected",
  };
}

function createPageVisitEvent(eventId: string): MonitoringEvent {
  return {
    durationMs: null,
    eventId,
    incognito: false,
    occurredAt: "2026-05-04T12:00:00.000Z",
    title: "Example",
    type: "page_visit",
    url: `https://example.com/${eventId}`,
  };
}

describe("event buffer", () => {
  beforeEach(() => {
    installChromeStorageMock();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-04T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("queues events and replaces duplicates by event id", async () => {
    await saveSession(createSession());
    await queueMonitoringEvent(createPageVisitEvent("event-1"));
    await queueMonitoringEvent({
      ...createPageVisitEvent("event-1"),
      title: "Updated",
    });

    const events = await getQueuedEvents();

    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("Updated");
  });

  it("returns sync batches capped at 100 events", async () => {
    await saveSession(createSession());

    for (let index = 0; index < 105; index += 1) {
      await queueMonitoringEvent(createPageVisitEvent(`event-${index}`));
    }

    const batch = await getQueuedEventBatch();

    expect(batch).toHaveLength(100);
    expect(batch[0].eventId).toBe("event-0");
  });

  it("removes only synced events that still match their queued payload", async () => {
    await saveSession(createSession());
    const firstEvent = createPageVisitEvent("event-1");
    const secondEvent = createPageVisitEvent("event-2");
    await queueMonitoringEvent(firstEvent);
    await queueMonitoringEvent(secondEvent);

    const remainingCount = await removeQueuedEvents([
      firstEvent,
      { ...secondEvent, title: "stale payload" },
    ]);

    const events = await getQueuedEvents();

    expect(remainingCount).toBe(1);
    expect(events.map((event) => event.eventId)).toEqual(["event-2"]);
  });
});
