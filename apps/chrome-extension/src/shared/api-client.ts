import { API_BASE_URL, EXTENSION_VERSION } from "./config"
import type {
  HeartbeatResponse,
  MonitoringEvent,
  PairingResponse,
  SyncResponse,
} from "./types"

const REQUEST_TIMEOUT_MS = 10000

class ApiRequestError extends Error {
  revoked: boolean
  status: number

  constructor(message: string, status: number, revoked: boolean) {
    super(message)
    this.name = "ApiRequestError"
    this.revoked = revoked
    this.status = status
  }
}

export function isRevokedRequestError(error: unknown) {
  return error instanceof ApiRequestError && error.revoked
}

async function requestJson<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const headers = new Headers(options.headers)

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal,
    })
    const data = (await response.json().catch(() => ({}))) as T & {
      error?: string
      revoked?: boolean
    }

    if (!response.ok) {
      throw new ApiRequestError(
        data.error || "Požadavek selhal.",
        response.status,
        data.revoked === true,
      )
    }

    return data
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Požadavek vypršel. Zkontroluj připojení k web API.")
    }
    if (error instanceof TypeError) {
      throw new Error(
        "Web API není dostupné. Zkontroluj EXTENSION_API_BASE_URL a znovu načti extension.",
      )
    }
    if (error instanceof Error) {
      throw error
    }
    throw new Error("Požadavek selhal.")
  } finally {
    clearTimeout(timeout)
  }
}

export async function pairDevice(code: string) {
  return requestJson<PairingResponse>("/monitoring/extension/pair", {
    method: "POST",
    body: JSON.stringify({
      code,
      extensionVersion: EXTENSION_VERSION,
    }),
  })
}

export async function sendHeartbeat(
  deviceToken: string,
  input?: {
    syncStatus?: "connected" | "pending" | "error"
    pendingItems?: number
    lastError?: string | null
  },
) {
  return requestJson<HeartbeatResponse>("/monitoring/extension/heartbeat", {
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
  })
}

export async function syncMonitoringEvents(
  deviceToken: string,
  events: MonitoringEvent[],
) {
  return requestJson<SyncResponse>("/monitoring/extension/sync", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${deviceToken}`,
    },
    body: JSON.stringify({
      extensionVersion: EXTENSION_VERSION,
      events,
    }),
  })
}
