import "server-only";

import { getApiBaseUrl } from "./api-url";

function normalizeApiUrl(apiUrl: string) {
  const normalizedUrl = apiUrl.replace(/\/+$/, "");
  return normalizedUrl.endsWith("/api") ? normalizedUrl : `${normalizedUrl}/api`;
}

export function getServerApiBaseUrl() {
  const internalApiUrl =
    process.env.INTERNAL_API_URL?.trim() || process.env.SERVER_API_URL?.trim();

  return internalApiUrl ? normalizeApiUrl(internalApiUrl) : getApiBaseUrl();
}
