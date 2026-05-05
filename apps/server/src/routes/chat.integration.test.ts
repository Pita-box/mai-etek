import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const supabase = {
    from: vi.fn(),
  };

  return {
    deleteCacheByPattern: vi.fn(),
    getAuthenticatedUserFromAuthorizationHeader: vi.fn(),
    getCachedJson: vi.fn(),
    getIO: vi.fn(),
    isUserOnline: vi.fn(),
    sendTelegramNotification: vi.fn(),
    setCachedJson: vi.fn(),
    supabase,
  };
});

vi.mock("@maietek/db", () => ({
  createAdminClient: () => mocks.supabase,
}));

vi.mock("../utils/auth", () => ({
  getAuthenticatedUserFromAuthorizationHeader:
    mocks.getAuthenticatedUserFromAuthorizationHeader,
}));

vi.mock("../utils/redis-cache", () => ({
  deleteCacheByPattern: mocks.deleteCacheByPattern,
  getCachedJson: mocks.getCachedJson,
  setCachedJson: mocks.setCachedJson,
}));

vi.mock("../socket", () => ({
  getIO: mocks.getIO,
  isUserOnline: mocks.isUserOnline,
}));

vi.mock("../services/notifications", () => ({
  sendTelegramNotification: mocks.sendTelegramNotification,
}));

import chatRoutes from "./chat";

type SupabaseResult = {
  data: unknown;
  error: { message: string } | null;
};

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/chat", chatRoutes);
  return app;
}

function createQuery(result: Partial<SupabaseResult>) {
  const resolved: SupabaseResult = {
    data: result.data ?? null,
    error: result.error ?? null,
  };
  const resolve = () => Promise.resolve(resolved);
  const query: Record<string, unknown> = {
    delete: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    insert: vi.fn(() => query),
    limit: vi.fn(() => query),
    lt: vi.fn(() => query),
    neq: vi.fn(() => query),
    not: vi.fn(() => query),
    order: vi.fn(() => query),
    range: vi.fn(resolve),
    select: vi.fn(() => query),
    single: vi.fn(resolve),
    update: vi.fn(() => query),
    then: (
      onFulfilled?: (value: SupabaseResult) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => resolve().then(onFulfilled, onRejected),
  };

  return query;
}

function queueSupabaseResults(...results: Partial<SupabaseResult>[]) {
  const queue = [...results];
  mocks.supabase.from.mockImplementation(() =>
    createQuery(queue.shift() ?? { data: null, error: null }),
  );
}

const domProfile = {
  id: "dom-1",
  full_name: "Dom",
  role: "dom",
  dom_id: null,
};

const messageRow = {
  id: "message-1",
  sender_id: "dom-1",
  type: "text",
  content: "Ahoj světe",
  media_url: null,
  media_thumbnail_url: null,
  reply_to_message_id: null,
  is_read: false,
  read_at: null,
  created_at: "2026-05-04T12:00:00.000Z",
};

describe("chat API integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedUserFromAuthorizationHeader.mockResolvedValue({
      user: { id: "dom-1" },
      error: null,
      status: 200,
    });
    mocks.getIO.mockReturnValue({ of: () => ({ emit: vi.fn() }) });
    mocks.isUserOnline.mockReturnValue(true);
  });

  it("serves chat search from Redis cache with HIT header", async () => {
    const cachedResponse = { messages: [] };
    mocks.getCachedJson.mockResolvedValue(cachedResponse);
    queueSupabaseResults(
      { data: domProfile },
      { data: [{ id: "sub-1" }] },
    );

    const response = await request(createTestApp())
      .get("/api/chat/messages/search")
      .query({ q: "ahoj" })
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(200);
    expect(response.header["x-cache"]).toBe("HIT");
    expect(response.body).toEqual(cachedResponse);
    expect(mocks.setCachedJson).not.toHaveBeenCalled();
  });

  it("stores uncached chat search responses with MISS header", async () => {
    mocks.getCachedJson.mockResolvedValue(null);
    queueSupabaseResults(
      { data: domProfile },
      { data: [{ id: "sub-1" }] },
      { data: [messageRow] },
      { data: [] },
      {
        data: [
          {
            id: "dom-1",
            full_name: "Dom",
            role: "dom",
            last_online_at: null,
          },
        ],
      },
    );

    const response = await request(createTestApp())
      .get("/api/chat/messages/search")
      .query({ q: "ahoj" })
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(200);
    expect(response.header["x-cache"]).toBe("MISS");
    expect(response.body.messages).toHaveLength(1);
    expect(response.body.messages[0]).toMatchObject({
      id: "message-1",
      text: "Ahoj světe",
    });
    expect(mocks.setCachedJson).toHaveBeenCalledWith(
      expect.stringMatching(/^chat:search:v1:dom-1:/),
      response.body,
      30,
    );
  });

  it("invalidates participant search cache after creating a message", async () => {
    queueSupabaseResults(
      { data: domProfile },
      { data: [{ id: "sub-1" }] },
      { data: messageRow },
      { data: [] },
      {
        data: [
          {
            id: "dom-1",
            full_name: "Dom",
            role: "dom",
            last_online_at: null,
          },
        ],
      },
    );

    const response = await request(createTestApp())
      .post("/api/chat/messages")
      .set("Authorization", "Bearer test-token")
      .send({ type: "text", text: "Ahoj světe" });

    expect(response.status).toBe(201);
    expect(response.body.message).toMatchObject({
      id: "message-1",
      text: "Ahoj světe",
    });
    expect(mocks.deleteCacheByPattern).toHaveBeenCalledWith(
      "chat:search:v1:dom-1:*",
    );
    expect(mocks.deleteCacheByPattern).toHaveBeenCalledWith(
      "chat:search:v1:sub-1:*",
    );
  });
});
